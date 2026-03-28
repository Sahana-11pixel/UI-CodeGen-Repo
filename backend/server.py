from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Depends, Header, Request
from fastapi.responses import JSONResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import base64
import random
import tempfile
import io
from google import genai
from google.genai import types
from PIL import Image
import bcrypt
import jwt
import cv2
import numpy as np
import firebase_admin
from firebase_admin import credentials as firebase_credentials, auth as firebase_auth
import requests
import cloudinary
import cloudinary.uploader
import cloudinary.api


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
print(os.getenv("FIREBASE_CREDENTIALS"))  # optional: check it load
api_key = os.getenv("GEMINI_API_KEY")
# NOTE: Never print API keys — they appear in deployment logs


# MongoDB connection
mongo_uri = os.environ.get('MONGO_URI')
if not mongo_uri:
    # Fallback to local if URI is missing
    mongo_uri = os.environ.get('LOCAL_MONGO_URL', "mongodb://localhost:27017")
    print("WARNING: MONGO_URI not found, falling back to LOCAL_MONGO_URL")

client = AsyncIOMotorClient(mongo_uri)
db = client[os.environ['DB_NAME']]

# Gemini Configuration
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")
gemini_client = genai.Client(api_key=GEMINI_API_KEY)
def safe_gemini_generate(model_name, contents, config=None):
    """Wrapper for Gemini generate_content with friendly error handling"""
    try:
        adapted_contents = contents
        if isinstance(contents, dict) and 'parts' in contents:
            adapted_contents = []
            for part in contents['parts']:
                if 'text' in part:
                    adapted_contents.append(part['text'])
                elif 'inline_data' in part:
                    mime_type = part['inline_data']['mime_type']
                    data = base64.b64decode(part['inline_data']['data'])
                    adapted_contents.append(
                        types.Part.from_bytes(data=data, mime_type=mime_type)
                    )
        
        kwargs = {}
        if config:
            kwargs['config'] = config
            
        return gemini_client.models.generate_content(
            model=model_name,
            contents=adapted_contents,
            **kwargs
        )
    except Exception as e:
        error_msg = str(e)
        # Log the full technical error for developers
        logger.error(f"Gemini API Exception: {error_msg}")
        
        # Map technical errors to user-friendly messages
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg or "quota" in error_msg.lower():
            raise HTTPException(
                status_code=429, 
                detail="The AI model is currently busy or has reached its limit. Please wait a moment and try again."
            )
        elif "503" in error_msg or "504" in error_msg or "UNAVAILABLE" in error_msg:
            raise HTTPException(
                status_code=503, 
                detail="The AI service is temporarily overloaded. Please try again in a few seconds."
            )
        elif "400" in error_msg or "INVALID_ARGUMENT" in error_msg:
            raise HTTPException(
                status_code=400, 
                detail="The request was too large or complex for the AI. Try a simpler image or a shorter message."
            )
        
        # Generic fallback that doesn't leak raw JSON
        raise HTTPException(
            status_code=500, 
            detail="AI processing encountered an unexpected issue. Please try again."
        )

# Unsplash Configuration
UNSPLASH_ACCESS_KEY = os.environ.get('UNSPLASH_ACCESS_KEY')

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET or len(JWT_SECRET) < 32:
    raise ValueError("JWT_SECRET must be set in .env and be at least 32 characters long")
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET')

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True
    )
    print("Cloudinary configured successfully")
else:
    print("WARNING: Cloudinary credentials not fully configured in .env")

# In-memory temporary cache for images between upload and generation
# Format: { "image_id": <binary_data> }
_image_cache = {}

# Temporary storage for uploaded images
UPLOAD_DIR = Path(tempfile.gettempdir()) / "ui_screenshots"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Firebase Admin SDK initialization
# In production (Render), set FIREBASE_CREDENTIALS to the full JSON string of your service account key.
FIREBASE_CREDENTIALS_JSON = os.environ.get('FIREBASE_CREDENTIALS')

if FIREBASE_CREDENTIALS_JSON:
    if not firebase_admin._apps:
        try:
            import json
            cred_dict = json.loads(FIREBASE_CREDENTIALS_JSON)
            cred = firebase_credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK initialized successfully from environment variable")
        except json.JSONDecodeError:
            raise ValueError("FIREBASE_CREDENTIALS environment variable is not valid JSON")
        except Exception as e:
            raise ValueError(f"Failed to initialize Firebase from FIREBASE_CREDENTIALS: {str(e)}")
else:
    raise ValueError("FIREBASE_CREDENTIALS environment variable is completely missing or empty! Please create it in your Render Environment Variables precisely as 'FIREBASE_CREDENTIALS'.")

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Rate Limiting — protects expensive endpoints from abuse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== PYDANTIC MODELS ====================

class UserSignup(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

ALLOWED_FRAMEWORKS = {"html_css", "react", "next_js", "nuxt_js", "svelte", "vue", "tailwind", "bootstrap", "vanilla_js"}

class GenerateRequest(BaseModel):
    image_id: str
    framework: str = Field(..., description="Target framework")
    image_url: Optional[str] = None

    @staticmethod
    def _validate_fw(v):
        if v not in ALLOWED_FRAMEWORKS:
            raise ValueError(f"Invalid framework. Allowed: {', '.join(sorted(ALLOWED_FRAMEWORKS))}")
        return v

    def __init__(self, **data):
        super().__init__(**data)
        self._validate_fw(self.framework)

class ChatRequest(BaseModel):
    code: str
    message: str = Field(..., max_length=4000)
    framework: str
    project_id: Optional[str] = None
    chat_history: Optional[List[dict]] = None

# class GenerateResponse(BaseModel):
#     code: str
#     framework: str
#     message: str

class GenerateResponse(BaseModel):
    code: str
    preview_html: str  # ✅ ADD THIS LINE
    framework: str
    message: str

# class ChatResponse(BaseModel):
#     code: str
#     message: str

class ChatResponse(BaseModel):
    code: str
    preview_html: str  # ✅ ADD THIS LINE
    message: str

class ProjectCreate(BaseModel):
    title: str
    framework: str
    generated_code: str
    updated_code: Optional[str] = None
    chat_messages: Optional[List[dict]] = None
    versions: Optional[List[dict]] = None
    image_url: Optional[str] = None

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    updated_code: Optional[str] = None
    chat_messages: Optional[List[dict]] = None
    versions: Optional[List[dict]] = None
    image_url: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class ProjectResponse(BaseModel):
    id: str
    user_id: str
    title: str
    framework: str
    generated_code: str
    updated_code: Optional[str] = None
    chat_messages: Optional[List[dict]] = None
    versions: Optional[List[dict]] = None
    image_url: Optional[str] = None
    created_at: str
    updated_at: str

class AdminStats(BaseModel):
    total_users: int
    total_projects: int
    total_api_calls: int
    recent_users: List[dict]
    recent_projects: List[dict]
    users_growth: List[dict]
    framework_stats: List[dict]

class UserListResponse(BaseModel):
    users: List[UserResponse]
    total_count: int
    page: int
    limit: int

class UserDetailsResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: str
    total_projects: int
    total_api_calls: int
    last_active: Optional[str] = None
    is_deleted: bool = False

class AdminProjectResponse(BaseModel):
    id: str
    user_id: str
    owner_email: str
    owner_name: str = "Unknown"
    title: str = "Untitled Project"
    framework: str = "unknown"
    created_at: str
    updated_at: Optional[str] = None

class AdminProjectListResponse(BaseModel):
    projects: List[AdminProjectResponse]
    total_count: int
    page: int
    limit: int

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str, role: str) -> str:
    """Create a JWT token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(authorization: str = Header(None)):
    """Dependency to get current user from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        token = authorization.replace('Bearer ', '')
        payload = decode_jwt_token(token)
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

def generate_random_colors():
    """Generate a random modern color palette"""
    palettes = [
        {"primary": "#6366f1", "secondary": "#4f46e5", "accent": "#818cf8", "bg": "#0f172a", "text": "#f8fafc"},
        {"primary": "#ec4899", "secondary": "#db2777", "accent": "#f472b6", "bg": "#18181b", "text": "#fafafa"},
        {"primary": "#06b6d4", "secondary": "#0891b2", "accent": "#22d3ee", "bg": "#020617", "text": "#f1f5f9"},
        {"primary": "#10b981", "secondary": "#059669", "accent": "#34d399", "bg": "#050505", "text": "#ffffff"}
    ]
    return random.choice(palettes)

def validate_image_ui(img: Image.Image) -> bool:
    """
    Perform a minimalist check to reject ONLY truly blank or solid-color images.
    Returns True if the image has any visual variance indicating content/design, False otherwise.
    Note: Blur, sharpness, and background complexity are NOT rejection criteria.
    """
    # 1. Resolution Check (Min 250x250)
    width, height = img.size
    if width < 100 or height < 100: # Overly small images are likely noise
        return False

    # 2. Convert to Grayscale
    if img.mode != 'L':
        img = img.convert('L')
    gray_array = np.array(img)

    # 3. Solid Color Check (The only reason to reject pre-validation)
    # If 99.9% of pixels are identical, it's virtually blank.
    counts, _ = np.histogram(gray_array, bins=256, range=(0, 256))
    max_count = np.max(counts)
    total_pixels = width * height
    
    if max_count / total_pixels > 0.999:
        return False

    # Otherwise, pass it. We allow blurred, low-contrast, and minimal designs.
    return True

def create_similarity_prompt(framework: str) -> str:
    """Create a prompt that enforces similarity (not exact copy)"""
    colors = generate_random_colors()
    
    base_prompt = f"""
You are a UI to code generator. Analyze the screenshot and generate SIMILAR (not identical) code.

Design Requirements:
1. Preserve layout structure and component hierarchy (header, sections, footer, etc.).
2. Maintain similar functionality and user flow.
    - You MUST modify at least 30% of visual styling choices (spacing, typography scale, border radius, alignment, section ordering where reasonable).
    - Do NOT replicate identical spacing, font sizes, or exact layout proportions.
    - Slightly restructure sections where possible (e.g., convert stacked layout to grid, change alignment left ↔ center when appropriate).
3. - You MUST NOT reuse any exact phrases from the original UI.
   - Rewrite all headings, paragraphs, and button labels with new wording.
   - If the screenshot contains brand names, replace them with fictional generic brands.
   - Never copy text verbatim from the image.
4. Use only relative layouts (Flexbox/Grid). Avoid absolute positioning.
5. Slightly vary spacing and typography while maintaining visual balance.
6. If the UI is complex (dashboard, multi-column, image-heavy, etc.), SIMPLIFY:
   - Use a maximum of 3-4 sub-component files. Combine smaller sections rather than creating many files.
   - Approximate complex charts/graphs with simple placeholder divs showing sample data.
   - Prioritize clean, ERROR-FREE, runnable code over pixel-perfect accuracy.
   - NEVER generate truncated or incomplete code. If running out of space, simplify the design.
7. The result should feel like a redesign of the same product by a different company.
8. Keep the output clean, fully responsive, syntactically valid, and ALWAYS runnable without errors.
9. NEVER import libraries not explicitly listed as supported in the framework rules.

UI Validation Rule
- Reject the image only if it is completely blank, corrupted, or contains no identifiable UI elements.
- Do not reject due to blur, low resolution, glassmorphism effects, minimal design, or complex backgrounds.
- If any functional UI components are visible (buttons, text, inputs, cards, containers, etc.), generate the code.
- Only respond with "No UI detected in the image." when absolutely no UI structure is present.

Framework: {framework}
"""
    # Multi-file frameworks return JSON array, single-file return raw code
    multi_file_output = """

OUTPUT FORMAT: Return a JSON array of files. Each object has "filename" and "content" keys.
The FIRST file must be the main entry point. Break complex UIs into logical components.
Example: [{"filename": "App.jsx", "content": "import React..."}, {"filename": "Header.jsx", "content": "..."}]
Return ONLY the raw JSON array. No markdown, no explanation.
"""

    single_file_output = """

OUTPUT FORMAT: Return ONLY the raw code. No markdown, no explanations, no wrapping.
First character = code start, last character = code end.
"""

    framework_specific = {
        "html_css":  """
Generate a complete <!DOCTYPE html> page with all CSS in a <style> tag.
Semantic HTML5, Flexbox/Grid layout, responsive media queries, functional form elements.
If the screenshot includes images, implement them using:
- Standard <img> tags with https://picsum.photos/WIDTH/HEIGHT (no /id/ paths) as placeholders.
- Explicit width and height attributes
- No CSS background-image
COLOR RULE:
Use this new color palette (do NOT reuse original colors):
- Primary: {colors['primary']}
- Secondary: {colors['secondary']}
- Accent: {colors['accent']}
- Background: {colors['bg']}
- Text: {colors['text']}
""" + single_file_output,

        "react": """
Generate React functional components.
Split into multiple files: main App.jsx + separate component files (max 3-4 component files).
Each component file should import React and export default.
App.jsx should import and compose all sub-components.

STRICT RULES:
1. ONLY use Tailwind CSS utility classes. Do not use inline styles unless absolutely necessary.
2. ALWAYS use `className=` instead of `class=`.
3. ONLY use standard DOM elements (div, span, button, etc.).
4. DO NOT import any third-party UI libraries (framer-motion, radix, MUI, recharts, etc.).
5. If you need icons, ONLY import from 'lucide-react'.
6. Keep components SIMPLE — use only `useState` and `useEffect`. Do NOT use `useReducer`, `createContext`, `forwardRef`, `memo`, `useCallback`, `useMemo` unless essential.
7. Do NOT use TypeScript — use plain .jsx files only.
8. Do NOT use `'use client'` or `'use server'` directives.
9. If the screenshot includes images, use <img> tags with https://picsum.photos/WIDTH/HEIGHT.
10. CRITICAL — NO DUPLICATE DECLARATIONS:
- Each component must be defined EXACTLY ONCE, in its own file.
- App.jsx must ONLY import and use sub-components.
COLOR RULE:
- Select a random primary color family from:
 red, green, purple, orange, teal, pink, indigo, emerald, amber.
- Use one dominant primary color family consistently.
- Do NOT create custom class names like bg-background or text-text.
""" + multi_file_output,

        "bootstrap": """
Generate a complete <!DOCTYPE html> page with Bootstrap 5 CDN.
Use Bootstrap grid, components, and custom CSS overrides in <style> tag.
If the screenshot includes images, implement them using:
- Standard <img> tags with https://picsum.photos/WIDTH/HEIGHT (no /id/ paths) as placeholders.
- Explicit width and height attributes
- No CSS background-image
COLOR RULE:
Use this new color palette (do NOT reuse original colors):
- Primary: {colors['primary']}
- Secondary: {colors['secondary']}
- Accent: {colors['accent']}
- Background: {colors['bg']}
- Text: {colors['text']}
""" + single_file_output,

        "tailwind": """
Generate a complete <!DOCTYPE html> page with Tailwind CDN.
Use Tailwind utility classes and responsive breakpoints.
If the screenshot includes images, implement them using:
- Standard <img> tags with https://picsum.photos/WIDTH/HEIGHT (no /id/ paths) as placeholders.
- Explicit width and height attributes
- No CSS background-image
COLOR RULE:
- Select a random primary color family from:
 red, green, purple, orange, teal, pink, indigo, emerald, amber.
- Use one dominant primary color family consistently.- Do NOT create custom class names like bg-background or text-text.
- Background and text MUST have strong visible contrast.
- If background is light, text must be dark.
- If background is dark, text must be light.
""" + single_file_output,

        "vanilla_js": """
Generate a complete <!DOCTYPE html> page with CSS in <style> and vanilla ES6+ JavaScript in <script>.
Event listeners, DOM manipulation, responsive design.
If the screenshot includes images, implement them using:
- Standard <img> tags with https://picsum.photos/WIDTH/HEIGHT (no /id/ paths) as placeholders.
- Explicit width and height attributes
- No CSS background-image
COLOR RULE:
Use this new color palette (do NOT reuse original colors):
- Primary: {colors['primary']}
- Secondary: {colors['secondary']}
- Accent: {colors['accent']}
- Background: {colors['bg']}
- Text: {colors['text']}
""" + single_file_output,

        "vue": """
Generate Vue 3 components using Composition API and Single File Component structure.
Split into multiple files: main App.vue + separate component .vue files for distinct UI sections.
App.vue should import and use all sub-components.
If the screenshot includes images, implement them using:
- Standard <img> tags with https://picsum.photos/WIDTH/HEIGHT (no /id/ paths) as placeholders.
- Explicit width and height attributes
- No CSS background-image
COLOR RULE:
Use this new color palette (do NOT reuse original colors):
- Primary: {colors['primary']}
- Secondary: {colors['secondary']}
- Accent: {colors['accent']}
- Background: {colors['bg']}
- Text: {colors['text']}
""" + multi_file_output,

        "svelte":  """
Generate Svelte components with reactive statements.
Split into multiple files: main App.svelte + separate .svelte component files.
App.svelte should import and compose all sub-components.
IMPORTANT FILE STRUCTURE:
- ALL .svelte files must be at the ROOT level (no subdirectories like components/).
- Filenames: App.svelte, Header.svelte, UserTable.svelte, etc.
- Imports MUST use flat paths: `import Header from './Header.svelte';` (NOT `./components/Header.svelte`)

STRICT SVELTE RULES:
1. For local component state, use plain `let` variables. Example: `let email = '';`
2. NEVER use the `$` prefix on plain variables. `$variable` syntax ONLY works with Svelte stores.
   - WRONG: `let email = ''; ... {$email}` — CRASHES with "subscribe is not a function"
   - CORRECT: `let email = ''; ... {email}` — use the variable name directly
3. Use `$:` reactive statements for derived values. Example: `$: fullName = firstName + ' ' + lastName;`
4. Use `bind:value` for two-way binding on inputs.
5. Use `on:click`, `on:submit` for event handlers — NOT `onClick` or `onSubmit`.
6. Use `{#if}`, `{#each}`, `{:else}` for control flow — NOT JSX conditionals.
7. Do NOT import React, useState, or any React APIs.
8. CSS should be inside `<style>` tags in each `.svelte` file.
9. Do NOT import anything from 'svelte' or 'svelte/store'. This includes:
   - NO createEventDispatcher (use on:click callbacks passed as props instead)
   - NO onMount, onDestroy, beforeUpdate, afterUpdate
   - NO writable, readable, derived
   - NO tick, setContext, getContext
   Use plain `let` variables, `$:` reactive statements, and direct event handlers only.
10. Keep components simple — max 4 .svelte files total including App.svelte.
11. For parent-child communication: use props (`export let handler`) instead of createEventDispatcher.
12. NEVER use React JSX attributes — Svelte uses plain HTML:
   - WRONG: `className="..."` → CORRECT: `class="..."`
   - WRONG: `onClick={fn}` → CORRECT: `on:click={fn}`
   - WRONG: `onChange={fn}` → CORRECT: `on:change={fn}`
   - WRONG: `onSubmit={fn}` → CORRECT: `on:submit={fn}`
   - WRONG: `htmlFor="id"` → CORRECT: `for="id"`
   - WRONG: `tabIndex={0}` → CORRECT: `tabindex={0}`
   - SVG attributes use kebab-case: `stroke-width`, `fill-opacity`

If the screenshot includes images, implement them using:
- Standard <img> tags with https://picsum.photos/WIDTH/HEIGHT (no /id/ paths) as placeholders.
- Explicit width and height attributes
- No CSS background-image
COLOR RULE:
Use this new color palette (do NOT reuse original colors):
- Primary: {colors['primary']}
- Secondary: {colors['secondary']}
- Accent: {colors['accent']}
- Background: {colors['bg']}
- Text: {colors['text']}
""" + multi_file_output,

        "next_js":  """
Generate Next.js components using standard React functional syntax.
Split into: app/page.jsx (main entry) + max 3 component files.

STRICT RULES:
1. ONLY use Tailwind CSS utility classes.
2. ALWAYS use `className=` instead of `class=`.
3. DO NOT import any external UI libraries (framer-motion, headlessui, recharts, etc.).
4. If you need icons, ONLY import from 'lucide-react'.
5. DO NOT use server-side features: no `metadata`, `'use server'`, `getServerSideProps`, `getStaticProps`.
6. DO NOT use `'use client'` directive.
7. DO NOT use `useRouter`, `usePathname`, `useSearchParams`, or any next/navigation imports.
8. Use .jsx files ONLY — do NOT use TypeScript (.tsx). No type annotations, no interfaces.
9. Each component must be defined EXACTLY ONCE in its own file.
10. Keep components simple — use only `useState` and `useEffect`.
11. If the screenshot includes images, use <img> tags with https://picsum.photos/WIDTH/HEIGHT.
12. Treat this as a pure CLIENT-SIDE React app. No server features.

CRITICAL — THIS IS A REACT APP, NOT VUE:
- Do NOT generate .vue files
- Do NOT use <template>, <script setup>, defineComponent, ref(), reactive()
- Do NOT generate components/icon/*.vue or any Vue-style paths
- ONLY generate .jsx files with React JSX syntax

COLOR RULE:
- Select a random primary color family from:
 red, green, purple, orange, teal, pink, indigo, emerald, amber.
- Use one dominant primary color family consistently.
- Do NOT create custom class names like bg-background or text-text.

CRITICAL: Return FULL code for EVERY component. Never truncate.
""" + multi_file_output,

        "nuxt_js": """
Generate Vue 3 components using Composition API and Single File Component structure.
Split into: main App.vue + max 3 separate .vue component files.
App.vue should import and use all sub-components.

STRICT RULES:
1. Use Vue 3 Composition API with `<script setup>` syntax.
2. Do NOT use Nuxt-specific features: no `useFetch`, `useAsyncData`, `defineNuxtConfig`, `<NuxtPage>`, `<NuxtLink>`.
3. Use standard `<a>` tags for links and `<img>` for images.
4. Do NOT import from 'nuxt/app' or any nuxt modules.
5. Treat this as a standard Vue 3 app.
6. CSS should be in `<style scoped>` blocks.
7. If the screenshot includes images, use <img> tags with https://picsum.photos/WIDTH/HEIGHT.

COLOR RULE:
Use this new color palette (do NOT reuse original colors):
- Primary: {colors['primary']}
- Secondary: {colors['secondary']}
- Accent: {colors['accent']}
- Background: {colors['bg']}
- Text: {colors['text']}
""" + multi_file_output,
    }
    
    return base_prompt + framework_specific.get(framework, framework_specific["html_css"])



def get_default_filename(framework: str) -> str:
    """Get the default filename for a single-file framework output"""
    return {
        "html_css": "index.html",
        "bootstrap": "index.html",
        "tailwind": "index.html",
        "vanilla_js": "index.html",
        "react": "App.jsx",
        "vue": "App.vue",
        "svelte": "App.svelte",
        "next_js": "app/page.tsx",
        "nuxt_js": "app.vue",
    }.get(framework, "index.html")


def parse_generated_output(raw_output: str, framework: str) -> str:
    """Parse Gemini output into JSON-stringified files array.
    Returns JSON string: [{"filename": "...", "content": "..."}, ...]
    """
    import json
    
    cleaned = raw_output.strip()
    
    # Clean markdown code blocks if present
    if "```" in cleaned:
        lines = cleaned.split("\n")
        code_lines = []
        in_code_block = False
        for line in lines:
            if line.strip().startswith("```"):
                in_code_block = not in_code_block
                continue
            if in_code_block:
                code_lines.append(line)
        cleaned = "\n".join(code_lines).strip()
    
    # Try to parse as JSON array (multi-file output)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list) and len(parsed) > 0:
            # Validate structure
            if all(isinstance(f, dict) and "filename" in f and "content" in f for f in parsed):
                return json.dumps(parsed)
        # Handle case where the entire AI response wrapper leaked through
        # e.g., {"intent": "MODIFY", "code": [{...}]}
        elif isinstance(parsed, dict) and "code" in parsed:
            code_field = parsed["code"]
            if isinstance(code_field, list) and len(code_field) > 0:
                if all(isinstance(f, dict) and "filename" in f and "content" in f for f in code_field):
                    return json.dumps(code_field)
            elif isinstance(code_field, str):
                return parse_generated_output(code_field, framework)
    except (json.JSONDecodeError, TypeError):
        pass
    
    # Single file output — wrap in array
    filename = get_default_filename(framework)
    return json.dumps([{"filename": filename, "content": cleaned}])


# ==================== CODE SAFETY PIPELINE ====================

def post_process_code(files_list: list, framework: str) -> list:
    """
    Post-process AI-generated code to fix common mistakes before validation.
    Handles: class→className, string refs→useRef, bad imports, markdown remnants.
    """
    import re

    # Frameworks that use JSX (className required)
    jsx_frameworks = {"react", "next_js"}

    # Libraries that crash the in-browser preview (not available via CDN)
    unsupported_imports = [
        "framer-motion", "@headlessui", "@heroicons", "@mui/material",
        "@chakra-ui", "@emotion", "styled-components", "@radix-ui",
        "react-router", "react-router-dom", "next/router", "next/navigation",
        "@tanstack", "react-query", "swr", "zustand", "jotai", "recoil",
        "react-spring", "react-icons", "react-helmet", "react-hot-toast",
        "react-toastify", "classnames", "clsx", "tailwind-merge",
        "next/font", "next/head", "@next/font", "next/dynamic",
        "axios", "lodash", "moment", "date-fns",
    ]

    processed = []
    for file_obj in files_list:
        filename = file_obj.get("filename", "")
        content = file_obj.get("content", "")

        if not content or not content.strip():
            processed.append(file_obj)
            continue

        # ── Phase 2: Normalize escape characters that crash Babel ──
        # Remove BOM (byte order mark) and zero-width characters
        content = re.sub(r'[\uFEFF\u200B\u200C\u200D\u2060]', '', content)
        # Remove non-printable control characters (keep \n, \r, \t)
        content = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', content)
        # Fix invalid Unicode escape sequences (\uXXXX where XXXX is not valid hex)
        content = re.sub(r'\\u(?![0-9a-fA-F]{4})[^\s\'"`}{)\][\;,]*', '', content)
        # Normalize smart/curly quotes to standard ASCII quotes (AI sometimes generates these)
        content = content.replace('\u201C', '"').replace('\u201D', '"')
        content = content.replace('\u2018', "'").replace('\u2019', "'")
        content = content.replace('\u00AB', '"').replace('\u00BB', '"')

        # ── Strip leftover markdown fences ──
        if content.strip().startswith("```"):
            lines = content.split("\n")
            code_lines = []
            in_block = False
            for line in lines:
                if line.strip().startswith("```"):
                    in_block = not in_block
                    continue
                if in_block or not lines[0].strip().startswith("```"):
                    code_lines.append(line)
            content = "\n".join(code_lines).strip()
            if not content:
                content = file_obj.get("content", "")

        # ── React / Next.js specific fixes ──
        if framework in jsx_frameworks and filename.endswith((".jsx", ".js", ".tsx", ".ts")):
            # 1. Convert class= to className= (only outside of strings/comments)
            #    Match class= not preceded by Name (to avoid className=)
            content = re.sub(
                r'(?<![a-zA-Z])class=(")',
                r'className=\1',
                content
            )
            content = re.sub(
                r"(?<![a-zA-Z])class=(')",
                r"className=\1",
                content
            )
            content = re.sub(
                r'(?<![a-zA-Z])class=\{',
                r'className={',
                content
            )

            # 2. Convert string refs to useRef pattern
            #    ref="something" → ref={someRef}  (user must add useRef themselves)
            string_ref_pattern = re.compile(r'ref="(\w+)"')
            found_refs = string_ref_pattern.findall(content)
            if found_refs:
                for ref_name in set(found_refs):
                    camel_ref = ref_name if ref_name.endswith("Ref") else f"{ref_name}Ref"
                    content = content.replace(f'ref="{ref_name}"', f'ref={{{camel_ref}}}')
                    # Add useRef declaration if not already present
                    if f"const {camel_ref}" not in content and f"let {camel_ref}" not in content:
                        # Insert after the last import or at the top of the component
                        ref_decl = f"  const {camel_ref} = useRef(null);\n"
                        # Try to insert after 'const [' or 'return (' lines
                        fn_match = re.search(r'((?:const|function)\s+\w+\s*=?\s*\(?[^)]*\)?\s*(?:=>)?\s*\{)', content)
                        if fn_match:
                            insert_pos = fn_match.end()
                            content = content[:insert_pos] + "\n" + ref_decl + content[insert_pos:]

            # 3. Remove 'use server' / 'use client' directives (crashes client-side preview)
            content = re.sub(r"['\"]use server['\"];?\s*\n?", "", content)
            content = re.sub(r"['\"]use client['\"];?\s*\n?", "", content)

            # 3b. Strip next/navigation and next/router imports (already mocked in preview)
            content = re.sub(
                r"import\s+[\s\S]*?from\s+['\"](?:next/navigation|next/router)['\"];?\s*\n?",
                "",
                content
            )

            # 3c. Strip TypeScript type annotations that crash Babel in non-TS mode
            # Remove `: TypeName` parameter annotations (but not object colon assignments)
            content = re.sub(r':\s*(?:string|number|boolean|void|any|null|undefined|never|unknown|React\.FC|React\.ReactNode|React\.ReactElement|JSX\.Element)\b', '', content)
            # Remove TypeScript interface and type declarations
            content = re.sub(r'\binterface\s+\w+\s*\{[^}]*\}\s*', '', content, flags=re.DOTALL)
            content = re.sub(r'\btype\s+\w+\s*=\s*[^;]+;', '', content)
            # Remove `as Type` casts (but not JSX!)
            content = re.sub(r'\bas\s+(?:string|number|boolean|any|unknown|never)\b', '', content)

            # 4. Strip unsupported library imports
            for lib in unsupported_imports:
                # Remove full import lines for this library
                content = re.sub(
                    rf"import\s+[\s\S]*?from\s+['\"]({re.escape(lib)}(?:/[^'\"]*)?)['\"];?\s*\n?",
                    "",
                    content
                )

            # 5. Ensure React hooks are not called conditionally (basic check)

            #    This is a best-effort heuristic, not a full AST analysis
            #    We just make sure useState/useEffect are at the top level

        # ── Vue specific fixes ──
        elif framework in {"vue", "nuxt_js"} and filename.endswith(".vue"):
            # Ensure <template> root exists
            if "<template>" not in content:
                # Wrap content in template if it looks like HTML but missing wrapper
                if "<div" in content or "<section" in content:
                    content = f"<template>\n{content}\n</template>"

        # ── Svelte specific fixes ──
        elif framework == "svelte" and filename.endswith(".svelte"):
            # Fix $variable misuse: if a variable is declared with `let` (not a store),
            # strip the $ prefix from template references.
            # Find all `let varName` declarations in <script> blocks
            script_match = re.search(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
            if script_match:
                script_content = script_match.group(1)
                # Find let-declared variables (these are NOT stores)
                let_vars = set(re.findall(r'\blet\s+(\w+)\b', script_content))
                # Find writable/readable store variables (these ARE stores — keep $)
                store_vars = set(re.findall(r'\bconst\s+(\w+)\s*=\s*(?:writable|readable|derived)\s*\(', script_content))
                # Variables that are let-declared but NOT stores — strip $ prefix
                non_store_vars = let_vars - store_vars
                for var in non_store_vars:
                    # Replace {$var} with {var} and $var with var in template context
                    content = re.sub(rf'\$({re.escape(var)})\b', r'\1', content)
            # Remove calls to svelte lifecycle functions whose imports were stripped.
            # These would cause ReferenceError: createEventDispatcher is not defined.
            svelte_fns = [
                'createEventDispatcher', 'onMount', 'onDestroy', 'beforeUpdate',
                'afterUpdate', 'tick', 'setContext', 'getContext'
            ]
            for fn in svelte_fns:
                # Remove: const dispatch = createEventDispatcher();
                content = re.sub(
                    rf'\bconst\s+\w+\s*=\s*{re.escape(fn)}\s*\([^)]*\)\s*;?\s*\n?', '', content
                )
                # Remove bare call: createEventDispatcher();
                content = re.sub(
                    rf'\b{re.escape(fn)}\s*\([^)]*\)\s*;?\s*\n?', '', content
                )
            # ── Convert React JSX attributes → proper HTML/Svelte attributes ──
            # "ValidationError: unknown attribute" is caused by React-style attributes.
            # 1. className= → class=
            content = re.sub(r'\bclassName=', 'class=', content)
            # 2. React event props → Svelte on: directives
            react_to_svelte_events = {
                'onClick':    'on:click',
                'onChange':   'on:change',
                'onSubmit':   'on:submit',
                'onInput':    'on:input',
                'onFocus':    'on:focus',
                'onBlur':     'on:blur',
                'onKeyDown':  'on:keydown',
                'onKeyUp':    'on:keyup',
                'onKeyPress': 'on:keypress',
                'onMouseEnter': 'on:mouseenter',
                'onMouseLeave': 'on:mouseleave',
                'onMouseDown':  'on:mousedown',
                'onMouseUp':    'on:mouseup',
                'onScroll':   'on:scroll',
                'onLoad':     'on:load',
                'onError':    'on:error',
            }
            for react_attr, svelte_attr in react_to_svelte_events.items():
                content = re.sub(rf'\b{re.escape(react_attr)}=', f'{svelte_attr}=', content)
            # 3. htmlFor= → for=
            content = re.sub(r'\bhtmlFor=', 'for=', content)
            # 4. tabIndex= → tabindex=
            content = re.sub(r'\btabIndex=', 'tabindex=', content)
            # 5. camelCase SVG attributes → kebab-case (Svelte passes these to DOM)
            svg_attr_map = {
                'strokeWidth':       'stroke-width',
                'strokeLinecap':     'stroke-linecap',
                'strokeLinejoin':    'stroke-linejoin',
                'strokeDasharray':   'stroke-dasharray',
                'strokeDashoffset':  'stroke-dashoffset',
                'strokeMiterlimit':  'stroke-miterlimit',
                'strokeOpacity':     'stroke-opacity',
                'fillOpacity':       'fill-opacity',
                'fillRule':          'fill-rule',
                'clipRule':          'clip-rule',
                'clipPath':          'clip-path',
                'viewBox':           'viewBox',   # keep as-is (SVG spec)
                'preserveAspectRatio': 'preserveAspectRatio',  # keep as-is
                'stopColor':         'stop-color',
                'stopOpacity':       'stop-opacity',
                'fontFamily':        'font-family',
                'fontSize':          'font-size',
                'fontWeight':        'font-weight',
                'fontStyle':         'font-style',
                'textAnchor':        'text-anchor',
                'dominantBaseline':  'dominant-baseline',
                'xHeight':           'x-height',
            }
            for camel, kebab in svg_attr_map.items():
                if camel != kebab:  # skip ones that should stay the same
                    content = re.sub(rf'\b{re.escape(camel)}=', f'{kebab}=', content)
            # Flatten import paths: ./components/Header.svelte → ./Header.svelte
            content = re.sub(
                r"""(import\s+\w+\s+from\s+['"])\.?/?(?:components|lib|utils|src)/([^'"]+['"])""",
                r'\1./\2',
                content
            )
            # Flatten filename: components/Header.svelte → Header.svelte
            if '/' in filename:
                filename = filename.rsplit('/', 1)[-1]

        # ── Next.js: reject Vue-style files hallucinated by the AI ──
        if framework == 'next_js' and filename.endswith('.vue'):
            # AI generated a .vue file for a Next.js project — replace with an empty stub
            stem = filename.rsplit('/', 1)[-1].replace('.vue', '')
            filename = f"{stem}.jsx"
            content = f"// Auto-converted from incorrectly generated {stem}.vue\nexport default function {stem}() {{ return null; }}\n"
        # Remove trailing text after last closing tag or brace
        content = content.rstrip()

        processed.append({"filename": filename, "content": content})

    # ── Cross-file deduplication for React/Next.js ──
    # If a component name matches its filename (e.g., Header in Header.jsx),
    # remove any duplicate function/class declarations of that name from other files.
    if framework in jsx_frameworks and len(processed) > 1:
        # Build a map of "owned" component names: filename stem → component name
        owned_components = {}
        for file_obj in processed:
            fn = file_obj.get("filename", "")
            if fn.endswith((".jsx", ".js", ".tsx", ".ts")):
                stem = fn.rsplit("/", 1)[-1].rsplit(".", 1)[0]  # Header.jsx → Header
                if stem and stem[0].isupper():
                    owned_components[stem] = fn

        # Remove duplicate declarations from files that don't own the component
        for comp_name, owner_file in owned_components.items():
            for file_obj in processed:
                if file_obj.get("filename") == owner_file:
                    continue  # Skip the owner file
                content = file_obj.get("content", "")
                if not content:
                    continue
                # Remove: function CompName(  /  const CompName =  /  class CompName
                # These are duplicate definitions that should be imports
                patterns = [
                    rf'^(export\s+default\s+)?function\s+{re.escape(comp_name)}\s*\([^)]*\)\s*\{{[\s\S]*?^\}}',
                    rf'^(export\s+default\s+)?const\s+{re.escape(comp_name)}\s*=\s*\([^)]*\)\s*=>\s*\{{[\s\S]*?^\}}',
                    rf'^(export\s+default\s+)?const\s+{re.escape(comp_name)}\s*=\s*\([^)]*\)\s*=>\s*\(',
                ]
                for pattern in patterns:
                    new_content = re.sub(pattern, f'/* {comp_name}: defined in {owner_file} */', content, flags=re.MULTILINE)
                    if new_content != content:
                        file_obj["content"] = new_content
                        content = new_content
                        logger.info(f"Removed duplicate '{comp_name}' from {file_obj.get('filename')}")
                        break

    return processed


def validate_generated_code(files_list: list, framework: str) -> tuple:
    """
    Static validation of generated code. Catches common structural issues.
    Returns (is_valid: bool, errors: list[str])
    """
    errors = []

    if not files_list or len(files_list) == 0:
        return False, ["No files generated"]

    jsx_frameworks = {"react", "next_js"}

    for file_obj in files_list:
        filename = file_obj.get("filename", "unknown")
        content = file_obj.get("content", "")

        if not content or not content.strip():
            errors.append(f"{filename}: File is empty")
            continue

        # ── Balanced brackets check ──
        bracket_pairs = {"{": "}", "(": ")", "[": "]"}
        stack = []
        in_string = False
        string_char = None
        escaped = False

        for ch in content:
            if escaped:
                escaped = False
                continue
            if ch == "\\":
                escaped = True
                continue
            if in_string:
                if ch == string_char:
                    in_string = False
                continue
            if ch in ('"', "'", "`"):
                in_string = True
                string_char = ch
                continue
            if ch in bracket_pairs:
                stack.append(bracket_pairs[ch])
            elif ch in bracket_pairs.values():
                if not stack or stack[-1] != ch:
                    errors.append(f"{filename}: Unbalanced bracket '{ch}'")
                    break
                stack.pop()

        if stack:
            errors.append(f"{filename}: {len(stack)} unclosed bracket(s)")

        # ── Framework-specific checks ──
        if framework in jsx_frameworks and filename.endswith((".jsx", ".js", ".tsx", ".ts")):
            # Check for remaining class= (should have been fixed by post-processor)
            import re
            class_matches = re.findall(r'(?<![a-zA-Z])class="', content)
            if class_matches:
                errors.append(f"{filename}: Found {len(class_matches)} instance(s) of class= (should be className=)")

            # Check for string refs
            if 'ref="' in content:
                errors.append(f"{filename}: Found string ref pattern (should use useRef)")

        elif framework in {"vue", "nuxt_js"} and filename.endswith(".vue"):
            if "<template>" not in content:
                errors.append(f"{filename}: Missing <template> block in Vue component")

    # ── Cross-file duplicate declaration check (React/Next.js) ──
    if framework in jsx_frameworks and len(files_list) > 1:
        import re as re_mod
        all_declarations = {}  # name → list of filenames
        for file_obj in files_list:
            fn = file_obj.get("filename", "")
            content = file_obj.get("content", "")
            if not content or not fn.endswith((".jsx", ".js", ".tsx", ".ts")):
                continue
            # Find top-level function/class/const component declarations
            for m in re_mod.finditer(r'^(?:export\s+(?:default\s+)?)?(?:function|class|const)\s+([A-Z][a-zA-Z0-9_$]*)\s*[=(\{]', content, re_mod.MULTILINE):
                name = m.group(1)
                if name not in all_declarations:
                    all_declarations[name] = []
                all_declarations[name].append(fn)
        for name, filenames in all_declarations.items():
            if len(filenames) > 1:
                errors.append(f"Duplicate component '{name}' declared in: {', '.join(filenames)}")

    is_valid = len(errors) == 0
    return is_valid, errors


def repair_code_with_ai(files_list: list, framework: str, errors: list) -> list:
    """
    Send broken code to a second AI pass for repair.
    Returns the repaired files list (or original if repair fails).
    Max 1 repair attempt.
    """
    import json

    try:
        # Build the repair prompt
        files_text = ""
        for f in files_list:
            files_text += f"\n--- FILE: {f['filename']} ---\n{f['content']}\n"

        error_list = "\n".join(f"- {e}" for e in errors)

        repair_prompt = f"""You are a code repair assistant. Fix ALL of the following errors in the {framework} code below.

ERRORS FOUND:
{error_list}

CRITICAL RULE FOR DUPLICATE DECLARATIONS:
If the error mentions "Duplicate component", you MUST remove the duplicate definition.
Each component must be defined EXACTLY ONCE in its own file. App.jsx should only IMPORT and USE components, never re-define them.
For example, if Header is defined in Header.jsx, remove any `function Header()` or `const Header =` from App.jsx.

CURRENT CODE:
{files_text}

RULES:
1. Fix every listed error.
2. For React/Next.js: ensure className is used (not class), no string refs, all hooks at top level.
3. For Vue: ensure <template> block exists.
4. Ensure all brackets, braces, and parentheses are balanced.
5. Keep the same filenames and overall structure.
6. Return a JSON array of file objects: [{{"filename": "...", "content": "..."}}]
7. Return ONLY the raw JSON array. No markdown, no explanation.
8. Every file must contain COMPLETE code — no placeholders or abbreviations.
"""

        logger.info(f"Attempting AI repair for {len(errors)} error(s)...")

        response = safe_gemini_generate(
            model_name='gemini-2.5-flash',
            contents=repair_prompt,
            config={"response_mime_type": "application/json"}
        )

        if response and response.text:
            repaired_raw = response.text.strip()

            # Try to parse the repaired output
            try:
                repaired = json.loads(repaired_raw)
                if isinstance(repaired, list) and len(repaired) > 0:
                    if all(isinstance(f, dict) and "filename" in f and "content" in f for f in repaired):
                        # Re-validate the repaired code
                        is_valid, new_errors = validate_generated_code(repaired, framework)
                        if is_valid:
                            logger.info("AI repair succeeded — code is now valid")
                            return repaired
                        else:
                            logger.warning(f"AI repair reduced errors from {len(errors)} to {len(new_errors)}, using repaired version anyway")
                            # Return repaired version even if not 100% valid (it's better than original)
                            return repaired
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(f"Failed to parse AI repair response: {e}")

    except Exception as e:
        logger.error(f"AI repair failed: {e}")

    # Return original if repair fails
    logger.warning("AI repair failed — returning original code")
    return files_list


def detect_framework(files_list: list) -> str:
    """
    Auto-detect framework from code patterns.
    Returns detected framework string or 'unknown'.
    """
    all_code = " ".join(f.get("content", "") for f in files_list)
    all_filenames = [f.get("filename", "") for f in files_list]

    # Check filenames first (most reliable)
    has_jsx = any(fn.endswith((".jsx", ".tsx")) for fn in all_filenames)
    has_vue = any(fn.endswith(".vue") for fn in all_filenames)
    has_svelte = any(fn.endswith(".svelte") for fn in all_filenames)
    has_html = any(fn.endswith(".html") for fn in all_filenames)

    # Check code patterns
    has_react_import = "import React" in all_code or "from 'react'" in all_code or 'from "react"' in all_code
    has_use_state = "useState" in all_code or "useEffect" in all_code
    has_vue_template = "<template>" in all_code and "<script" in all_code
    has_svelte_script = "<script>" in all_code and ("$:" in all_code or "on:" in all_code)
    has_next_patterns = "next/image" in all_code or "next/link" in all_code or "app/page" in " ".join(all_filenames)

    if has_next_patterns or (has_jsx and has_react_import and "next/" in all_code):
        return "next_js"
    elif has_vue or has_vue_template:
        return "vue"
    elif has_svelte:
        return "svelte"
    elif has_jsx or has_react_import or has_use_state:
        return "react"
    elif has_html or "<!DOCTYPE" in all_code.upper():
        # Try to distinguish HTML variants
        if "bootstrap" in all_code.lower():
            return "bootstrap"
        elif "tailwind" in all_code.lower():
            return "tailwind"
        return "html_css"
    else:
        return "unknown"


def run_code_safety_pipeline(files_json: str, framework: str) -> str:
    """
    Master pipeline: post-process → validate → repair → detect framework.
    Takes JSON string of files, returns cleaned JSON string.
    """
    import json

    try:
        files_list = json.loads(files_json)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Failed to parse files_json in safety pipeline, returning as-is")
        return files_json

    if not isinstance(files_list, list):
        return files_json

    if not files_list:
        return json.dumps([])

    # Step 1: Post-process (fix common mistakes)
    files_list = post_process_code(files_list, framework)
    logger.info(f"Post-processing complete for {len(files_list)} file(s)")

    # Step 2: Validate
    is_valid, errors = validate_generated_code(files_list, framework)

    if not is_valid:
        logger.warning(f"Validation found {len(errors)} error(s): {errors}")

        # Step 3: AI Repair (only if validation fails)
        files_list = repair_code_with_ai(files_list, framework, errors)

        # Re-run post-processor on repaired code
        files_list = post_process_code(files_list, framework)

    # Step 4: Framework detection (logging only — don't change the framework)
    detected = detect_framework(files_list)
    if detected != "unknown" and detected != framework:
        logger.info(f"Framework detection note: requested '{framework}', detected '{detected}'")

    return json.dumps(files_list)


def create_chat_prompt(code: str, message: str, framework: str, image_url: str = None, chat_history: list = None) -> str:
    """Create a focused prompt for AI chat that produces contextual, helpful responses."""
    import json
    
    # Format files for the prompt
    try:
        files = json.loads(code)
        if isinstance(files, list):
            files_text = ""
            for f in files:
                files_text += f"\n--- FILE: {f['filename']} ---\n{f['content']}\n"
        else:
            files_text = f"\n{code}\n"
    except (json.JSONDecodeError, TypeError):
        files_text = f"\n{code}\n"
    
    # Determine if multi-file
    is_multi_file = framework in ["react", "vue", "svelte", "next_js", "nuxt_js"]
    
    if is_multi_file:
        code_format_instruction = """- "code" MUST be a JSON array: [{"filename": "...", "content": "..."}]
- Include ALL files (modified + unmodified). Never omit files.
- Each file's "content" must be COMPLETE, never partial."""
    else:
        code_format_instruction = """- "code" MUST be the COMPLETE source code as a single string.
- Never return partial snippets or placeholders."""
    
    # Format conversation history (last 5 messages)
    history_text = ""
    if chat_history and len(chat_history) > 0:
        recent = chat_history[-5:]
        history_text = "\n## RECENT CONVERSATION\n"
        for msg in recent:
            role = msg.get('role', 'user').upper()
            content = msg.get('content', '')
            history_text += f"{role}: {content}\n"
    
    prompt = f"""You are a helpful AI coding assistant for a {framework} project. You help users understand and modify their code.

## CURRENT PROJECT FILES
{files_text}
{history_text}
## USER MESSAGE
"{message}"

## HOW TO RESPOND

Classify the user's intent and respond with a single JSON object:

{{
    "intent": "MODIFY" | "CLARIFY" | "EXPLAIN" | "UNRELATED",
    "message": "your response",
    "code": <modified code or null>
}}

### Intent Guide:

**MODIFY** — User wants a code change (add, fix, update, remove, change, make, create).
{code_format_instruction}
- Change ONLY what the user asked for. Do NOT touch unrelated code.
- Do NOT add libraries or dependencies not already in the project.
- "message" MUST clearly explain what you changed and why. Never reply with just "Code updated." — describe the specific changes.
- If the user asks to fix an error but doesn't provide the error message, use CLARIFY instead.
- Preserve all existing files, components, and structure.

**CLARIFY** — You need more information before you can help. Use this when:
- User asks to "fix the error" but didn't paste the error message
- User asks to add images but didn't provide URLs or specify what images
- User's request is ambiguous and could mean multiple things
- "code" MUST be null for CLARIFY.
- "message" should ask a specific question to get the info you need. Be friendly and direct.

**EXPLAIN** — User asks a question about the code without requesting changes.
- "code" MUST be null.
- Give a clear, well-structured explanation. Use bullet points and backticks for code terms.

**UNRELATED** — Message has nothing to do with coding or the project.
- "code" MUST be null.
- "message": "I can only help with understanding or modifying your {framework} project code. What would you like to do?"

### Image Requests:
If the user asks to add, change, or replace images:
- ALWAYS use CLARIFY intent. Ask the user to provide the exact image URL(s) they want.
- Do NOT insert placeholder images, random URLs, or any image API URLs.
- Example response: "Sure! Please provide the image URL you'd like me to use, and I'll update the code for you."
- Only use MODIFY with an image if the user has already provided a specific URL in this message or in the recent conversation.

## OUTPUT RULES
1. Return ONLY the raw JSON object. No markdown, no code fences.
2. Must be parseable by json.loads().
3. "code" must be valid code or null — never an empty string.
"""
    return prompt

def create_react_preview_html(react_code: str) -> str:
    """Convert React JSX to renderable HTML for iframe preview"""
    # Remove import statements
    component_code = react_code
    if "import" in component_code:
        lines = component_code.split('\n')
        component_code = '\n'.join([line for line in lines if not line.strip().startswith('import')])
    
    # Handle export patterns without breaking component definitions
    # Case 1: "export default App;" or "export default App" (standalone export line)
    lines = component_code.split('\n')
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        # Remove standalone export lines like "export default App;" 
        if stripped.startswith('export default') and (stripped.endswith(';') or stripped.replace('export default', '').strip().isidentifier()):
            continue
        # Convert "export default function App()" -> "function App()"
        elif stripped.startswith('export default function'):
            cleaned_lines.append(line.replace('export default function', 'function'))
        # Convert "export default const App" -> "const App"
        elif stripped.startswith('export default const'):
            cleaned_lines.append(line.replace('export default const', 'const'))
        # Convert "export default () =>" -> "const App = () =>"
        elif stripped.startswith('export default ()') or stripped.startswith('export default (props)'):
            cleaned_lines.append(line.replace('export default', 'const App ='))
        else:
            cleaned_lines.append(line)
    component_code = '\n'.join(cleaned_lines)
    
    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>React Preview</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }}
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        {component_code}
        
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>"""
    return html_template


def create_vue_preview_html(vue_code: str) -> str:
    """Convert Vue SFC to renderable HTML"""
    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vue Preview</title>
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    </style>
</head>
<body>
    <div id="app"></div>
    <script>
        const {{ createApp }} = Vue;
        {vue_code}
        createApp(App).mount('#app');
    </script>
</body>
</html>"""
    return html_template


def create_svelte_preview_html(svelte_code: str) -> str:
    """Convert Svelte to renderable HTML"""
    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Svelte Preview</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    </style>
</head>
<body>
    <div id="app"></div>
    <script type="module">
        {svelte_code}
    </script>
</body>
</html>"""
    return html_template
# ==================== AUTH ROUTES ====================


@app.get("/")
def root():
    return {"status": "Backend is running!"}
    
class FirebaseLoginRequest(BaseModel):
    id_token: str
    name: Optional[str] = None

@api_router.post("/auth/firebase-login", response_model=LoginResponse)
async def firebase_login(request: FirebaseLoginRequest):
    """Verify Firebase ID token, check email_verified, upsert user in MongoDB, return JWT."""
    try:
        # 1. Verify Firebase ID token
        decoded_token = firebase_auth.verify_id_token(request.id_token)

        firebase_uid = decoded_token['uid']
        email = decoded_token.get('email', '')

        # Check email verification using the real-time user record from Firebase,
        # NOT the token's cached claims. Token claims can be stale for a few seconds
        # after the user clicks the verification link, causing spurious rejections.
        try:
            firebase_user_record = firebase_auth.get_user(firebase_uid)
            email_verified = firebase_user_record.email_verified
        except Exception:
            # Fallback to token claim if get_user fails for any reason
            email_verified = decoded_token.get('email_verified', False)

        if not email_verified:
            raise HTTPException(status_code=403, detail="Email not verified. Please verify your email before logging in.")

        # 2. Find or create user in MongoDB
        existing_user = await db.users.find_one({"email": email})

        if existing_user:
            # Block login for soft-deleted accounts
            if existing_user.get("is_deleted"):
                raise HTTPException(
                    status_code=403,
                    detail="This account has been deactivated. Please contact support if you believe this is a mistake."
                )
            # Update last login and firebase_uid
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "last_login": datetime.now(timezone.utc).isoformat(),
                    "firebase_uid": firebase_uid
                }}
            )
            user_id = existing_user["id"]
            user_name = existing_user["name"]
            user_role = existing_user.get("role", "user")
            user_created_at = existing_user["created_at"]
        else:
            # Create new user from Firebase profile
            user_id = str(uuid.uuid4())
            user_name = request.name or decoded_token.get('name', email.split('@')[0])
            user_role = "user"
            now = datetime.now(timezone.utc).isoformat()

            user_doc = {
                "id": user_id,
                "firebase_uid": firebase_uid,
                "name": user_name,
                "email": email,
                "password_hash": "",
                "role": user_role,
                "created_at": now,
                "last_login": now
            }
            await db.users.insert_one(user_doc)
            user_created_at = now
            logger.info(f"New Firebase user created: {email}")

        # 3. Generate your existing JWT
        token = create_jwt_token(user_id, email, user_role)

        user_response = UserResponse(
            id=user_id,
            name=user_name,
            email=email,
            role=user_role,
            created_at=user_created_at
        )

        logger.info(f"Firebase login successful: {email}")
        return LoginResponse(token=token, user=user_response)

    except firebase_admin.exceptions.FirebaseError as e:
        logger.error(f"Firebase token verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firebase login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Firebase login failed: {str(e)}")

# ---------------------------------------------------------------------------
# Reset Password (for legacy bcrypt users without Firebase)
# ---------------------------------------------------------------------------
class ResetPasswordRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    """Verify current password and update to new password (bcrypt users only)."""
    try:
        user = await db.users.find_one({"id": current_user["user_id"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify current password
        if not user.get("password_hash") or not verify_password(request.current_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        # Hash and update new password
        new_hash = hash_password(request.new_password)
        await db.users.update_one(
            {"id": current_user["user_id"]},
            {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        logger.info(f"Password reset for user: {current_user['email']}")
        return {"message": "Password updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {str(e)}")

# ---------------------------------------------------------------------------
# Delete Account (soft-delete — retains data for admin, blocks login)
# ---------------------------------------------------------------------------
@api_router.delete("/auth/account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Soft-delete the authenticated user's account (sets is_deleted=True)."""
    try:
        user = await db.users.find_one({"id": current_user["user_id"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        now = datetime.now(timezone.utc).isoformat()

        # Soft-delete: mark user as deleted (data is retained for admin)
        await db.users.update_one(
            {"id": current_user["user_id"]},
            {"$set": {
                "is_deleted": True,
                "deleted_at": now,
                "is_active": False
            }}
        )

        logger.info(f"Account soft-deleted: {current_user['email']}")
        return {"message": "Account deactivated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete account error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")

@api_router.put("/auth/profile")
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update the authenticated user's profile information."""
    try:
        user = await db.users.find_one({"id": current_user["user_id"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Update name in MongoDB
        result = await db.users.update_one(
            {"id": current_user["user_id"]},
            {"$set": {
                "name": request.name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )

        if result.modified_count == 0 and user["name"] == request.name:
            return {"message": "No changes made", "name": request.name}

        logger.info(f"User {current_user['email']} updated name to {request.name}")
        return {"message": "Profile updated successfully", "name": request.name}

    except Exception as e:
        logger.error(f"Update profile error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")

@api_router.post("/auth/signup", response_model=LoginResponse)
@limiter.limit("5/minute")
async def signup(request: Request, user_data: UserSignup):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = await db.users.find_one({"email": user_data.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create new user
        user_id = str(uuid.uuid4())
        hashed_password = hash_password(user_data.password)
        
        user_doc = {
            "id": user_id,
            "name": user_data.name,
            "email": user_data.email,
            "password_hash": hashed_password,
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_doc)
        
        # Generate JWT token
        token = create_jwt_token(user_id, user_data.email, "user")
        
        user_response = UserResponse(
            id=user_id,
            name=user_data.name,
            email=user_data.email,
            role="user",
            created_at=user_doc["created_at"]
        )
        
        logger.info(f"New user registered: {user_data.email}")
        return LoginResponse(token=token, user=user_response)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

@api_router.post("/auth/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, credentials: UserLogin):
    """Login user"""
    try:
        # Find user
        user = await db.users.find_one({"email": credentials.email})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Verify password
        if not verify_password(credentials.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Update last login
        await db.users.update_one(
            {"email": credentials.email},
            {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Generate JWT token
        token = create_jwt_token(user["id"], user["email"], user["role"])
        
        user_response = UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            created_at=user["created_at"]
        )
        
        logger.info(f"User logged in: {credentials.email}")
        return LoginResponse(token=token, user=user_response)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    try:
        user = await db.users.find_one({"id": current_user["user_id"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            created_at=user["created_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== UPLOAD & GENERATE ROUTES ====================

@api_router.post("/upload")
@limiter.limit("10/minute")
async def upload_screenshot(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a UI screenshot - stores in MongoDB and returns an image URL"""
    try:
        # Validate file type
        if not file.content_type in ["image/png", "image/jpeg", "image/jpg"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PNG and JPEG are supported."
            )
        
        # Read and validate file size (max 10MB)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="File too large. Maximum size is 10MB."
            )
        
        # Validate it's a real image and has UI characteristics
        try:
            img = Image.open(io.BytesIO(content))
            img.verify()
            
            # Convert to PNG bytes for consistent storage
            img = Image.open(io.BytesIO(content))  # Re-open after verify() closes it
            if not validate_image_ui(img):
                raise HTTPException(
                    status_code=400,
                    detail="No UI detected. Please upload a valid website or app UI screenshot."
                )
            # Convert to PNG binary for storage
            png_buffer = io.BytesIO()
            img.save(png_buffer, "PNG")
            png_bytes = png_buffer.getvalue()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid image file."
            )
        
        # Generate unique ID for caching
        image_id = str(uuid.uuid4())
        
        # Upload to Cloudinary
        try:
            cloudinary_response = cloudinary.uploader.upload(
                png_bytes,
                folder="ui5_screenshots",
                resource_type="image"
            )
            image_url = cloudinary_response.get("secure_url")
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to upload image to cloud storage.")
        
        # Store securely in memory cache for Gemini (avoid redownloading)
        _image_cache[image_id] = png_bytes
        
        # Set a timer to clean up the cache just in case generate isn't called
        import asyncio
        async def cleanup_cache(id_to_clear: str, delay_seconds: int = 600): # 10 minutes max
            await asyncio.sleep(delay_seconds)
            if id_to_clear in _image_cache:
                del _image_cache[id_to_clear]
                logger.debug(f"Auto-cleaned unused image cache: {id_to_clear}")
        
        asyncio.create_task(cleanup_cache(image_id))
        
        # Log API usage
        await db.api_usage.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["user_id"],
            "action": "upload",
            "framework": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "token_usage": 0
        })
        
        logger.info(f"Uploaded image to Cloudinary: {image_id}")
        
        return JSONResponse(content={
            "image_id": image_id,
            "image_url": image_url,
            "message": "Image uploaded successfully"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@api_router.post("/generate", response_model=GenerateResponse)
@limiter.limit("5/minute")
async def generate_code(
    request: Request,
    gen_request: GenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate UI code from uploaded screenshot"""
    try:
        # Fetch image binary from memory cache (primary)
        image_bytes = None
        if gen_request.image_id in _image_cache:
            image_bytes = _image_cache[gen_request.image_id]
        
        # Fallback: Download from image_url if not in cache (e.g. server restart)
        if not image_bytes and gen_request.image_url:
            try:
                logger.info(f"Cache miss for {gen_request.image_id}, downloading from {gen_request.image_url}")
                import requests
                response = requests.get(gen_request.image_url, timeout=10)
                if response.status_code == 200:
                    image_bytes = response.content
                    # Restore to cache for subsequent calls
                    _image_cache[gen_request.image_id] = image_bytes
            except Exception as e:
                logger.error(f"Fallback download failed: {str(e)}")

        if not image_bytes:
            raise HTTPException(status_code=404, detail="Image session expired. Please upload again.")
        
        
        # Convert binary to base64 for Gemini
        image_data = base64.b64encode(image_bytes).decode('utf-8')
        
        # Create prompt
        prompt = create_similarity_prompt(gen_request.framework)
        
        logger.info(f"Generating code for {gen_request.framework}...")
        
        # Generate code using safe wrapper with friendly error mapping
        response = safe_gemini_generate(
            model_name='gemini-2.5-flash',
            contents={
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": image_data
                        }
                    }
                ]
            }
        )
        
        if not response or not response.text:
            raise HTTPException(status_code=500, detail="Failed to generate code")
        
        # Check for Rejection Text
        if "No UI detected in the image" in response.text:
            raise HTTPException(
                status_code=400, 
                detail="No UI detected in the image. Please upload a valid UI screenshot."
            )

        generated_code = response.text.strip()
        
        # Parse into files array format (handles JSON arrays and single-file wrapping)
        files_json = parse_generated_output(generated_code, gen_request.framework)
        
        # Run code safety pipeline: post-process → validate → repair → detect
        files_json = run_code_safety_pipeline(files_json, gen_request.framework)
        
        # Log API usage
        await db.api_usage.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["user_id"],
            "action": "generate",
            "framework": gen_request.framework,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "token_usage": len(files_json)
        })
        
        logger.info(f"Code generated successfully for {gen_request.framework}")
        
        # Build the public image URL (Not needed here since it was passed from /upload, but keeping for compatibility)
        image_url = f"/api/images/{gen_request.image_id}" # (This line is harmless but unused locally since frontend uses upload URL)
        
        # Clean up image cache
        if gen_request.image_id in _image_cache:
            del _image_cache[gen_request.image_id]
            logger.debug(f"Cleared cache for image: {gen_request.image_id}")
        
        return GenerateResponse(
            code=files_json,
            preview_html="",  # Frontend handles preview rendering
            framework=gen_request.framework,
            message="Code generated successfully"
        )
    
    except HTTPException:
        # Clean up on error too
        if gen_request.image_id in _image_cache:
            del _image_cache[gen_request.image_id]
        raise
    except Exception as e:
        if gen_request.image_id in _image_cache:
            del _image_cache[gen_request.image_id]
        logger.error(f"Generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")

def _fetch_unsplash_url_for_message(message: str) -> str | None:
    """
    Detect if the user's chat message is requesting an image and fetch a URL from Unsplash.
    Returns the image URL string, or None if not an image request or fetch failed.
    """
    import re
    # Keywords that indicate the user wants an image
    image_keywords = [
        r"add(?:\s+an?)?\s+image", r"add(?:\s+an?)?\s+(?:a\s+)?photo", r"add(?:\s+an?)?\s+picture",
        r"replace(?:\s+the)?\s+image", r"change(?:\s+the)?\s+image", r"update(?:\s+the)?\s+image",
        r"insert(?:\s+an?)?\s+image", r"put(?:\s+an?)?\s+image", r"use(?:\s+an?)?\s+image",
        r"show(?:\s+an?)?\s+image", r"set(?:\s+the)?\s+image", r"logo",
        r"banner\s+image", r"background\s+image", r"hero\s+image", r"thumbnail",
    ]
    msg_lower = message.lower()
    is_image_request = any(re.search(kw, msg_lower) for kw in image_keywords)
    if not is_image_request:
        return None

    if not UNSPLASH_ACCESS_KEY:
        logger.warning("Unsplash key not configured — using picsum.photos fallback")
        # Use picsum.photos with a seed-based URL for themed results
        filler = re.compile(
            r"\b(please|add|an?|the|image|photo|picture|of|with|for|and|replace|change|insert|put|use|show|set|a|to|me|on|here|banner|hero|background|thumbnail|logo|update|use|instead|insated|that|random|images|can|u|you|sections?|cards?)\b",
            re.IGNORECASE
        )
        seed = filler.sub("", message).strip()
        seed = re.sub(r"\s+", "-", seed).strip("-").lower() or "nature"
        return f"https://picsum.photos/seed/{seed}/600/400"

    # Extract best query subject from the message
    # Remove filler words and common verbs to isolate the subject
    filler = re.compile(
        r"\b(please|add|an?|the|image|photo|picture|of|with|for|and|replace|change|insert|put|use|show|set|a|to|me|on|here|banner|hero|background|thumbnail|logo|update|use)\b",
        re.IGNORECASE
    )
    query = filler.sub("", message).strip()
    # Collapse whitespace
    query = re.sub(r"\s+", " ", query).strip()
    if not query:
        query = "nature"  # sensible fallback

    try:
        url = f"https://api.unsplash.com/photos/random?query={query}&client_id={UNSPLASH_ACCESS_KEY}"
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            image_url = data["urls"]["regular"]
            logger.info(f"Unsplash image fetched for query '{query}': {image_url[:60]}...")
            return image_url
        else:
            logger.warning(f"Unsplash returned {resp.status_code} for query '{query}'")
            return None
    except Exception as e:
        logger.error(f"Unsplash fetch error: {e}")
        return None


@api_router.post("/chat", response_model=ChatResponse)
@limiter.limit("15/minute")
async def modify_code(
    request: Request,
    chat_request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Modify generated code via AI chat"""
    try:
        # Generate chat prompt (with conversation history)
        prompt = create_chat_prompt(
            chat_request.code,
            chat_request.message,
            chat_request.framework,
            chat_history=chat_request.chat_history
        )
        
        logger.info(f"Processing chat request: {chat_request.message}")
        
        # Generate response using safe wrapper with friendly error mapping
        response = safe_gemini_generate(
            model_name='gemini-2.5-flash',
            contents={"parts": [{"text": prompt}]},
            config={"response_mime_type": "application/json"}
        )
        
        if not response or not response.text:
            raise HTTPException(status_code=500, detail="Failed to get AI response")
            
        try:
            import json
            result = json.loads(response.text)
        except json.JSONDecodeError as e:
            logger.error(f"JSON Decode Error: {e.msg} - Response snippet: {response.text[:200]}")
            # Try to extract a valid code array from the raw response using regex
            import re as re_fallback
            code_match = re_fallback.search(r'"code"\s*:\s*(\[\s*\{.*\}\s*\])', response.text, re_fallback.DOTALL)
            if code_match:
                try:
                    extracted_code = json.loads(code_match.group(1))
                    result = {
                        "intent": "MODIFY",
                        "message": "Code updated.",
                        "code": extracted_code
                    }
                except json.JSONDecodeError:
                    result = {
                        "intent": "MODIFY",
                        "message": "Code updated.",
                        "code": response.text
                    }
            else:
                result = {
                    "intent": "MODIFY",
                    "message": "Code updated.",
                    "code": response.text
                }

        intent = result.get("intent", "MODIFY")
        message = result.get("message", "Request processed.")
        modified_code = result.get("code")

        logger.info(f"Intent classified: {intent}")

        # Handle different intents
        if intent in ("CLARIFY", "EXPLAIN", "UNRELATED", "GREETING", "FRAMEWORK_CHANGE"):
            # For CLARIFY, EXPLAIN, FRAMEWORK_CHANGE, UNRELATED, GREETING
            return ChatResponse(
                code=chat_request.code,  # Return original code unchanged
                preview_html="",
                message=message
            )
        elif intent == "MODIFY" and modified_code:
            import json as json_mod
            
            # Parse modified code into files array format
            if isinstance(modified_code, list):
                # Gemini returned a proper JSON array
                if all(isinstance(f, dict) and "filename" in f and "content" in f for f in modified_code):
                    files_json = json_mod.dumps(modified_code)
                else:
                    files_json = parse_generated_output(str(modified_code), chat_request.framework)
            elif isinstance(modified_code, str):
                files_json = parse_generated_output(modified_code, chat_request.framework)
            else:
                files_json = parse_generated_output(str(modified_code), chat_request.framework)
            
            # Run code safety pipeline: post-process → validate → repair → detect
            files_json = run_code_safety_pipeline(files_json, chat_request.framework)
            
            # ── File-count validation and merging ──
            # Flash models may return only the changed files to save tokens, OR they
            # might try to replace the whole project with a stub.
            # If AI returns fewer files than original, we merge them into the original project.
            try:
                original_files_json = chat_request.code
                original_files = json_mod.loads(original_files_json) if isinstance(original_files_json, str) else original_files_json
                new_files = json_mod.loads(files_json) if isinstance(files_json, str) else files_json
                
                if isinstance(original_files, list) and isinstance(new_files, list) and len(original_files) > 0:
                    merged = False
                    # If new files are fewer or equal, and don't contain all original files, try to merge
                    if len(new_files) < len(original_files):
                        # Create map of original files
                        file_map = {f.get("filename"): f for f in original_files if "filename" in f}
                        
                        # Update map with new files
                        for nf in new_files:
                            if "filename" in nf:
                                file_map[nf["filename"]] = nf
                                
                        # Reconstruct the list preserving original order
                        merged_files = []
                        for original_f in original_files:
                            fname = original_f.get("filename")
                            if fname in file_map:
                                merged_files.append(file_map[fname])
                                del file_map[fname]
                        
                        # Add any entirely new files
                        for nf in file_map.values():
                            merged_files.append(nf)
                            
                        # Double check we didn't just merge a "Welcome" stub App.jsx
                        app_file = next((f for f in merged_files if f.get("filename") in ["App.jsx", "App.tsx", "page.tsx"]), None)
                        if app_file and "Welcome" in app_file.get("content", "") and len(new_files) == 1:
                            # It's a stub reset, reject it
                            message_suffix = ""
                            if any(word in chat_request.message.lower() for word in ["error", "bug", "fix"]):
                                message_suffix = "If you are trying to fix an error, please explicitly paste the error message from the preview."
                            else:
                                message_suffix = "Could you please be more specific in your request?"
                                
                            logger.warning("AI attempted to reset the project with a stub. Rejecting.")
                            return ChatResponse(
                                code=chat_request.code,
                                preview_html="",
                                message=f"I wasn't able to complete your request while preserving the existing project structure. {message_suffix}"
                            )
                        
                        files_json = json_mod.dumps(merged_files)
                        logger.info(f"Merged {len(new_files)} modified file(s) into original {len(original_files)} file(s).")
            except (json_mod.JSONDecodeError, TypeError, Exception) as e:
                logger.warning(f"File count validation failed: {str(e)}")
                pass  # Can't validate — proceed normally

            # Save chat history unconditionally
            try:
                await db.chats.insert_one({
                    "id": str(uuid.uuid4()),
                    "project_id": chat_request.project_id, # Can be None if project is unsaved
                    "user_id": current_user["user_id"],
                    "message": chat_request.message,
                    "response": message,
                    "code_snapshot": files_json,
                    "intent": intent,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            except Exception as e:
                logger.warning(f"Failed to save chat history: {e}")

            return ChatResponse(
                code=files_json,
                preview_html="",  # Frontend handles preview
                message=message
            )
            
        else:
            # For EXPLAIN, FRAMEWORK_CHANGE, UNRELATED
            return ChatResponse(
                code=chat_request.code,  # Return original code unchanged
                preview_html="",
                message=message
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")

# ==================== PROJECT MANAGEMENT ROUTES ====================

@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new project"""
    try:
        project_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Default numbering for Untitled Projects per user
        title = project_data.title
        if not title or title.strip() == "Untitled Project":
            import re
            # Query titles starting with "Untitled Project"
            existing_projects = await db.projects.find(
                {"user_id": current_user["user_id"], "title": {"$regex": "^Untitled Project"}},
                {"title": 1, "_id": 0}
            ).to_list(1000)
            
            max_num = 0
            for proj in existing_projects:
                p_title = proj.get("title", "")
                if p_title == "Untitled Project":
                    # Treat raw "Untitled Project" as base (0)
                    continue
                match = re.search(r"Untitled Project (\d+)$", p_title)
                if match:
                    max_num = max(max_num, int(match.group(1)))
            
            title = f"Untitled Project {max_num + 1}"
        
        project_doc = {
            "id": project_id,
            "user_id": current_user["user_id"],
            "title": title,
            "framework": project_data.framework,
            "generated_code": project_data.generated_code,
            "updated_code": project_data.updated_code or project_data.generated_code,
            "chat_messages": project_data.chat_messages or [],
            "versions": project_data.versions or [],
            "image_url": project_data.image_url,
            "created_at": now,
            "updated_at": now
        }
        
        await db.projects.insert_one(project_doc)
        
        logger.info(f"Project created: {project_id}")
        
        return ProjectResponse(**project_doc)
        
    except Exception as e:
        logger.error(f"Create project error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")

@api_router.get("/projects", response_model=List[ProjectResponse])
async def get_projects(current_user: dict = Depends(get_current_user)):
    """Get all projects for current user"""
    try:
        projects = await db.projects.find(
            {"user_id": current_user["user_id"]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
        
        return [ProjectResponse(**project) for project in projects]
        
    except Exception as e:
        logger.error(f"Get projects error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get projects: {str(e)}")

@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific project"""
    try:
        project = await db.projects.find_one(
            {"id": project_id, "user_id": current_user["user_id"]},
            {"_id": 0}
        )
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return ProjectResponse(**project)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get project error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")

@api_router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a project"""
    try:
        update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
        
        if project_data.title:
            update_fields["title"] = project_data.title
        if project_data.updated_code:
            update_fields["updated_code"] = project_data.updated_code
        if project_data.chat_messages is not None:
            update_fields["chat_messages"] = project_data.chat_messages
        if project_data.versions is not None:
            update_fields["versions"] = project_data.versions
        if project_data.image_url is not None:
            update_fields["image_url"] = project_data.image_url
        
        result = await db.projects.find_one_and_update(
            {"id": project_id, "user_id": current_user["user_id"]},
            {"$set": update_fields},
            return_document=True,
            projection={"_id": 0}
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Project not found")
        
        logger.info(f"Project updated: {project_id}")
        
        return ProjectResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update project error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(e)}")

@api_router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a project"""
    try:
        result = await db.projects.delete_one(
            {"id": project_id, "user_id": current_user["user_id"]}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Delete associated chats
        await db.chats.delete_many({"project_id": project_id})
        
        logger.info(f"Project deleted: {project_id}")
        
        return {"message": "Project deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete project error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/stats", response_model=AdminStats)
async def get_admin_stats(current_user: dict = Depends(get_current_user)):
    """Get admin statistics"""
    try:
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        total_users = await db.users.count_documents({})
        total_projects = await db.projects.count_documents({})
        total_api_calls = await db.api_usage.count_documents({})
        
        recent_users_cursor = db.users.find(
            {},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "created_at": 1}
        ).sort("created_at", -1).limit(10)
        
        recent_users = await recent_users_cursor.to_list(10)

        # Fetch recent projects
        recent_projects_cursor = db.projects.find(
            {},
            {"_id": 0, "id": 1, "title": 1, "framework": 1, "created_at": 1, "user_id": 1}
        ).sort("created_at", -1).limit(10)
        
        recent_projects_raw = await recent_projects_cursor.to_list(10)
        
        # Enrich projects with owner email
        recent_projects = []
        for project in recent_projects_raw:
            user = await db.users.find_one({"id": project["user_id"]}, {"email": 1})
            project["owner_email"] = user["email"] if user else "Unknown"
            recent_projects.append(project)

        # Calculate User Growth (Group by Date)
        users_growth_pipeline = [
            {
                "$group": {
                    "_id": {
                        "$dateToString": { 
                            "format": "%Y-%m-%d", 
                            "date": { "$toDate": "$created_at" } 
                        }
                    },
                    "count": { "$sum": 1 }
                }
            },
            { "$sort": { "_id": 1 } }
        ]
        users_growth_raw = await db.users.aggregate(users_growth_pipeline).to_list(None)
        users_growth = [{"date": item["_id"], "users": item["count"]} for item in users_growth_raw]

        # Calculate Framework Stats
        # framework_stats_pipeline = [
        #     {
        #         "$group": {
        #             "_id": { "$toLower": "$framework" },
        #             "count": { "$sum": 1 }
        #         }
        #     },
        #     { "$sort": { "count": -1 } }
        # ]
        framework_stats_pipeline = [
            # 1. First, normalize the framework field
            {
                "$project": {
                    "normalized_framework": {
                        "$switch": {
                            "branches": [
                                { "case": { "$in": [ { "$toLower": "$framework" }, ["react", "react.js"] ] }, "then": "React" },
                                { "case": { "$in": [ { "$toLower": "$framework" }, ["html/css", "html_css", "html"] ] }, "then": "HTML/CSS" },
                                { "case": { "$in": [ { "$toLower": "$framework" }, ["vue", "vuejs", "vue.js"] ] }, "then": "Vue" },
                                { "case": { "$eq": [ { "$toLower": "$framework" }, "svelte" ] }, "then": "Svelte" },
                                { "case": { "$in": [ { "$toLower": "$framework" }, ["next_js", "nextjs", "next.js"] ] }, "then": "Next.js" },
                                { "case": { "$in": [ { "$toLower": "$framework" }, ["nuxt_js", "nuxtjs", "nuxt.js"] ] }, "then": "Nuxt.js" },
                                { "case": { "$eq": [ { "$toLower": "$framework" }, "tailwind" ] }, "then": "Tailwind" },
                                { "case": { "$in": [ { "$toLower": "$framework" }, ["bootstrap", "bootstrap5"] ] }, "then": "Bootstrap" },
                                { "case": { "$in": [ { "$toLower": "$framework" }, ["vanilla_js", "vanillajs", "vanilla"] ] }, "then": "Vanilla JS" }
                            ],
                            "default": "$framework"
                        }
                    }
                }
            },
            # 2. Filter out angular (per user request)
            {
                "$match": {
                    "normalized_framework": { "$ne": "angular" }
                }
            },
            # 3. Group and count
            {
                "$group": {
                    "_id": "$normalized_framework",
                    "count": { "$sum": 1 }
                }
            },
            { "$sort": { "count": -1 } }
        ]

        framework_stats_raw = await db.projects.aggregate(framework_stats_pipeline).to_list(None)
        framework_stats = [{"framework": item["_id"], "count": item["count"]} for item in framework_stats_raw]
        
        return AdminStats(
            total_users=total_users,
            total_projects=total_projects,
            total_api_calls=total_api_calls,
            recent_users=recent_users,
            recent_projects=recent_projects,
            users_growth=users_growth,
            framework_stats=framework_stats
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get admin stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

@api_router.get("/admin/users", response_model=UserListResponse)
async def get_admin_users(
    page: int = 1,
    limit: int = 10,
    search: Optional[str] = None,
    sortBy: str = "created_at",
    order: str = "desc",
    role: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all users with pagination, search, and filtering"""
    try:
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Build query
        query = {}
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}}
            ]
        
        if role:
            query["role"] = role
            
        # Calculate skip
        skip = (page - 1) * limit
        
        # Determine sort direction
        direction = -1 if order == "desc" else 1
        
        # Fetch users
        users_cursor = db.users.find(query, {"_id": 0})
        users_cursor = users_cursor.sort(sortBy, direction).skip(skip).limit(limit)
        
        users_raw = await users_cursor.to_list(limit)
        
        # Count total matches
        total_count = await db.users.count_documents(query)
        
        # Map to response dicts (include is_deleted for admin UI)
        users = []
        for u in users_raw:
            users.append({
                "id": str(u.get("id", "")),
                "name": u.get("name", "Unknown User"),
                "email": u.get("email", "N/A"),
                "role": u.get("role", "user"),
                "created_at": u.get("created_at", datetime.now(timezone.utc).isoformat()),
                "is_deleted": u.get("is_deleted", False),
            })
            
        return {
            "users": users,
            "total_count": total_count,
            "page": page,
            "limit": limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get admin users error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

@api_router.get("/admin/users/{user_id}/stats", response_model=UserDetailsResponse)
async def get_user_stats(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed statistics for a specific user"""
    try:
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Get user basic info
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Count projects
        total_projects = await db.projects.count_documents({"user_id": user_id})
        
        # Count API calls
        total_api_calls = await db.api_usage.count_documents({"user_id": user_id})
        
        return UserDetailsResponse(
            id=str(user.get("id", "")),
            name=user.get("name", "Unknown User"),
            email=user.get("email", "N/A"),
            role=user.get("role", "user"),
            created_at=user.get("created_at", datetime.now(timezone.utc).isoformat()),
            total_projects=total_projects,
            total_api_calls=total_api_calls,
            last_active=user.get("last_login"),
            is_deleted=user.get("is_deleted", False)  # Include soft-delete status for admin UI
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user stats: {str(e)}")

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Permanently delete a user from MongoDB AND Firebase Auth (hard delete).
    The user cannot log in after this. They can re-register as a new account."""
    try:
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Fetch user record first (we need firebase_uid + email for logging)
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent admin from deleting their own account
        if user_id == current_user["user_id"]:
            raise HTTPException(status_code=400, detail="Cannot delete your own admin account")

        # ── Step 1: Delete from Firebase Authentication ──────────────────────
        # This prevents the user from ever logging in again with that email.
        firebase_uid = user.get("firebase_uid")
        if firebase_uid:
            try:
                firebase_auth.delete_user(firebase_uid)
                logger.info(f"Deleted Firebase Auth user: {firebase_uid} ({user['email']})")
            except firebase_auth.UserNotFoundError:
                # Already deleted from Firebase, continue with MongoDB cleanup
                logger.warning(f"Firebase user {firebase_uid} not found – already removed from Auth")
            except Exception as fb_err:
                # Log but do NOT abort – still clean up MongoDB so the user is blocked
                logger.error(f"Firebase Auth deletion failed for {firebase_uid}: {fb_err}")
        else:
            # No firebase_uid stored (e.g. legacy email/password account).
            # Try to look up by email via Firebase Admin SDK.
            email = user.get("email")
            if email:
                try:
                    fb_user = firebase_auth.get_user_by_email(email)
                    firebase_auth.delete_user(fb_user.uid)
                    logger.info(f"Deleted Firebase Auth user by email: {email}")
                except firebase_auth.UserNotFoundError:
                    logger.warning(f"No Firebase Auth record found for email: {email}")
                except Exception as fb_err:
                    logger.error(f"Firebase Auth deletion by email failed for {email}: {fb_err}")

        # ── Step 2: Cascade delete all MongoDB records ───────────────────────
        await db.projects.delete_many({"user_id": user_id})
        await db.chats.delete_many({"user_id": user_id})
        await db.api_usage.delete_many({"user_id": user_id})

        # ── Step 3: Delete the user document itself ──────────────────────────
        result = await db.users.delete_one({"id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=500, detail="Failed to delete user record")
            
        logger.info(f"Admin {current_user['email']} hard-deleted user {user['email']} and all associated data")
        
        return {"message": f"User {user['email']} permanently deleted from Firebase and database"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin delete user error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")

@api_router.post("/admin/users/{user_id}/reactivate")
async def admin_reactivate_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reactivate a soft-deleted user account (sets is_deleted=False)"""
    try:
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        # Find the user
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not user.get("is_deleted", False):
            raise HTTPException(status_code=400, detail="Account is already active")

        # Reactivate: clear is_deleted flag and deleted_at timestamp
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "is_deleted": False,
                "reactivated_at": datetime.now(timezone.utc).isoformat()
            }, "$unset": {"deleted_at": ""}}
        )

        logger.info(f"Admin {current_user['email']} reactivated user {user['email']}")

        return {"message": f"User {user['email']} has been successfully reactivated"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin reactivate user error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reactivate user: {str(e)}")

@api_router.get("/admin/projects", response_model=AdminProjectListResponse)
async def get_admin_projects(
    page: int = 1,
    limit: int = 10,
    search: Optional[str] = None,
    sortBy: str = "created_at",
    order: str = "desc",
    framework: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve all projects with pagination, filtering, and search (Admin Only)"""
    try:
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Build aggregation pipeline to join with users
        pipeline = [
            {
                "$lookup": {
                    "from": "users",
                    "localField": "user_id",
                    "foreignField": "id",
                    "as": "owner"
                }
            },
            { "$unwind": { "path": "$owner", "preserveNullAndEmptyArrays": True } },
            {
                "$project": {
                    "id": 1,
                    "user_id": 1,
                    "title": { "$ifNull": ["$title", "Untitled Project"] },
                    "framework": { "$ifNull": ["$framework", "unknown"] },
                    "created_at": 1,
                    "updated_at": 1,
                    "owner_name": { "$ifNull": ["$owner.name", "Unknown User"] },
                    "owner_email": { "$ifNull": ["$owner.email", "Unknown"] }
                }
            }
        ]

        # Filtering and Search
        match_query = {}
        if framework and framework.lower() != 'all':
            # Map frontend IDs to potential database values
            id_to_variants = {
                "react": ["react", "React", "react.js"],
                "html_css": ["html/css", "html_css", "HTML/CSS", "html"],
                "vue": ["vue", "Vue", "vuejs", "vue.js"],
                "svelte": ["svelte", "Svelte"],
                "next_js": ["next_js", "nextjs", "next.js", "Next.js"],
                "nuxt_js": ["nuxt_js", "nuxtjs", "nuxt.js", "Nuxt.js"],
                "tailwind": ["tailwind", "Tailwind"],
                "bootstrap": ["bootstrap", "Bootstrap", "bootstrap5"],
                "vanilla_js": ["vanilla_js", "vanillajs", "vanilla", "Vanilla JS"]
            }
            
            variants = id_to_variants.get(framework.lower())
            if variants:
                match_query["framework"] = {"$in": variants}
            else:
                match_query["framework"] = {"$regex": f"^{framework}$", "$options": "i"}

        if search:
            match_query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"owner_email": {"$regex": search, "$options": "i"}}
            ]

        if match_query:
            pipeline.append({ "$match": match_query })

        # Sorting
        direction = -1 if order == "desc" else 1
        sort_map = {
            "name": "title",
            "ownerEmail": "owner_email",
            "createdAt": "created_at"
        }
        db_sort_field = sort_map.get(sortBy, sortBy)

        # Facet for total count and data
        skip = (page - 1) * limit
        facet_pipeline = {
            "$facet": {
                "metadata": [{ "$count": "total" }],
                "data": [
                    { "$sort": { db_sort_field: direction } },
                    { "$skip": skip },
                    { "$limit": limit }
                ]
            }
        }
        pipeline.append(facet_pipeline)

        results = await db.projects.aggregate(pipeline).to_list(1)
        
        if not results:
            return AdminProjectListResponse(projects=[], total_count=0, page=page, limit=limit)
        
        metadata = results[0].get("metadata", [])
        total_count = metadata[0]["total"] if metadata else 0
        projects_raw = results[0].get("data", [])
        
        projects = []
        for p in projects_raw:
            projects.append(AdminProjectResponse(**p))
            
        return AdminProjectListResponse(
            projects=projects,
            total_count=total_count,
            page=page,
            limit=limit
        )

    except Exception as e:
        logger.error(f"Get admin projects error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch projects: {str(e)}")

@api_router.get("/admin/projects/{project_id}", response_model=AdminProjectResponse)
async def get_admin_project_details(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve detailed project information (Admin Only)"""
    try:
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Build aggregation pipeline to join with users
        pipeline = [
            { "$match": { "id": project_id } },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "user_id",
                    "foreignField": "id",
                    "as": "owner"
                }
            },
            { "$unwind": { "path": "$owner", "preserveNullAndEmptyArrays": True } },
            {
                "$project": {
                    "id": 1,
                    "user_id": 1,
                    "title": { "$ifNull": ["$title", "Untitled Project"] },
                    "framework": { "$ifNull": ["$framework", "unknown"] },
                    "created_at": 1,
                    "updated_at": 1,
                    "owner_name": { "$ifNull": ["$owner.name", "Unknown User"] },
                    "owner_email": { "$ifNull": ["$owner.email", "Unknown"] }
                }
            }
        ]

        results = await db.projects.aggregate(pipeline).to_list(1)
        
        if not results:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return AdminProjectResponse(**results[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get admin project details error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch project details: {str(e)}")

@api_router.delete("/admin/projects/{project_id}")
async def admin_delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Administratively delete a project (Admin Only)"""
    try:
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Verify project exists
        project = await db.projects.find_one({"id": project_id})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Cascade delete chats
        await db.chats.delete_many({"project_id": project_id})
        
        # Delete project
        result = await db.projects.delete_one({"id": project_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=500, detail="Failed to delete project record")
            
        logger.info(f"Admin {current_user['email']} deleted project {project_id} '{project.get('title')}'")
        
        return {"message": "Project deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin delete project error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

# ==================== GENERAL ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "UI Screenshot to Code API", "status": "running"}

@api_router.get("/unsplash-image/")
def get_unsplash_image(query: str):
    """
    Fetch a random image from Unsplash based on the query.
    """
    if not UNSPLASH_ACCESS_KEY:
        return {"error": "Unsplash API key not configured"}
        
    url = f"https://api.unsplash.com/photos/random?query={query}&client_id={UNSPLASH_ACCESS_KEY}"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return {"image_url": data["urls"]["regular"]}
        else:
            logger.error(f"Unsplash API error: {resp.status_code} - {resp.text}")
            return {"error": f"Unable to fetch image: {resp.status_code}"}
    except Exception as e:
        logger.error(f"Unsplash request exception: {str(e)}")
        return {"error": "Internal error fetching image"}

# Include router in app
app.include_router(api_router)

# CORS Configuration — reads allowed origins from CORS_ORIGINS env var
cors_origins_raw = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
CORS_ORIGINS = [origin.strip() for origin in cors_origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()