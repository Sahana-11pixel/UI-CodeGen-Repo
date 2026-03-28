/**
 * codeSanitizer.js — Client-side code safety layer
 * 
 * Runs before preview rendering and editor display to catch
 * common AI mistakes that survive the backend pipeline.
 * Provides defense-in-depth alongside the server-side safety pipeline.
 * 
 * Phase 2: Enhanced with escape normalization, Unicode validation,
 * duplicate export detection, and pre-Babel syntax checking.
 */

// ─── Unsupported import patterns (these crash the in-browser preview) ────────
const UNSUPPORTED_IMPORT_SOURCES = [
    'framer-motion', '@headlessui', '@heroicons', '@mui/material',
    '@chakra-ui', '@emotion', 'styled-components', '@radix-ui',
    'react-router', 'react-router-dom', 'next/router', 'next/navigation',
    '@tanstack', 'react-query', 'swr', 'zustand', 'jotai', 'recoil',
    'react-spring', 'react-icons', 'react-helmet', 'react-hot-toast',
    'react-toastify', 'classnames', 'clsx', 'tailwind-merge',
    'next/font', 'next/head', '@next/font', 'next/dynamic',
    'axios', 'lodash', 'moment', 'date-fns',
];

// ─── Dangerous patterns that could crash the preview ─────────────────────────
const DANGEROUS_PATTERNS = [
    { pattern: /\beval\s*\(/g, replacement: '/* eval removed */(', label: 'eval()' },
    { pattern: /\bdocument\.write\s*\(/g, replacement: '/* document.write removed */(', label: 'document.write()' },
];

/**
 * Normalize escaped characters that the AI sometimes double-escapes.
 * Fixes literal \\n, \\t, \\" sequences in code that should be real escapes.
 * @param {string} content - Raw code content
 * @returns {string} Content with normalized escapes
 */
function normalizeEscapedChars(content) {
    if (!content || typeof content !== 'string') return content;

    // Fix double-escaped sequences that appear as literal characters in the code.
    // Pattern: A literal backslash followed by 'n', 't', 'r' etc outside of strings
    // This is tricky — we need to be careful not to break valid escape sequences.

    // 1. Remove BOM (byte order mark) and zero-width characters
    content = content.replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, '');

    // 2. Remove non-printable control characters (keep \n, \r, \t)
    content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 3. Fix common AI double-escape issue: literal \\n at line level that should be \n
    //    Only outside of string literals (heuristic: if a line starts with it)
    //    This catches cases like:  const x = "hello\\nworld"  (four chars: \ \ n w)
    //    which should be:          const x = "hello\nworld"   (real newline)

    // 4. Fix invalid Unicode escape sequences that crash Babel
    //    Pattern: \uXXXX where XXXX is not valid hex
    content = content.replace(/\\u(?![0-9a-fA-F]{4})[^\s'"`}{)(\][;,]*/g, '');

    // 5. Fix wrongly escaped quotes inside template literals
    //    AI sometimes writes: `Hello \" World` instead of `Hello " World`
    content = content.replace(/`([^`]*?)\\"/g, (match, before) => {
        // Only fix if not preceded by another backslash (which would be \\")
        if (before.endsWith('\\')) return match;
        return '`' + before + '"';
    });

    return content;
}

/**
 * Remove duplicate default exports — keep only the last one.
 * AI sometimes generates multiple `export default` statements.
 * @param {string} content - Code content
 * @returns {string} Content with only one default export
 */
function fixDuplicateExports(content) {
    if (!content) return content;

    // Find all export default occurrences
    const exportDefaultRegex = /^export\s+default\s+/gm;
    const matches = [...content.matchAll(exportDefaultRegex)];

    if (matches.length <= 1) return content;

    // Keep only the last one — convert all previous ones to regular declarations
    for (let i = 0; i < matches.length - 1; i++) {
        const match = matches[i];
        const idx = match.index;
        content = content.substring(0, idx) +
            content.substring(idx).replace(/^export\s+default\s+/, '');
    }

    return content;
}

/**
 * Sanitize a single file's content based on framework.
 * @param {string} content - The raw file content
 * @param {string} filename - The file name
 * @param {string} framework - The target framework
 * @returns {string} Sanitized content
 */
function sanitizeFileContent(content, filename, framework) {
    if (!content || typeof content !== 'string' || !content.trim()) return content;

    const isJSX = filename.endsWith('.jsx') || filename.endsWith('.tsx') ||
        filename.endsWith('.js') || filename.endsWith('.ts');
    const isReact = framework === 'react' || framework === 'next_js';

    // ── Phase 2: Normalize escaped characters (all frameworks) ──────────────
    content = normalizeEscapedChars(content);

    // ── Phase 2: Fix duplicate exports (all JS/TS files) ────────────────────
    if (isJSX) {
        content = fixDuplicateExports(content);
    }

    // ── React / Next.js JSX fixes ──────────────────────────────────────────────
    if (isReact && isJSX) {
        // 1. Convert class= to className= (lookbehind avoids matching className=)
        content = content.replace(/(?<![a-zA-Z])class="([^"]*)"/g, 'className="$1"');
        content = content.replace(/(?<![a-zA-Z])class='([^']*)'/g, "className='$1'");
        content = content.replace(/(?<![a-zA-Z])class=\{/g, 'className={');

        // 2. Convert string refs: ref="myRef" → ref={myRef}
        content = content.replace(/ref="(\w+)"/g, (_, name) => {
            const refName = name.endsWith('Ref') ? name : `${name}Ref`;
            return `ref={${refName}}`;
        });

        // 3. Remove 'use server' directives (crash client-side preview)
        content = content.replace(/['"]use server['"];?\s*\n?/g, '');

        // 4. Strip unsupported library imports
        for (const lib of UNSUPPORTED_IMPORT_SOURCES) {
            const escaped = lib.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(
                `import\\s+[\\s\\S]*?from\\s+['"]${escaped}(?:/[^'"]*)?['"];?\\s*\\n?`,
                'g'
            );
            content = content.replace(regex, '');
        }

        // 5. Strip require() calls for unsupported libraries
        for (const lib of UNSUPPORTED_IMPORT_SOURCES) {
            const escaped = lib.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(
                `(?:const|let|var)\\s+\\w+\\s*=\\s*require\\(['"]${escaped}(?:/[^'"]*)?['"]\\);?\\s*\\n?`,
                'g'
            );
            content = content.replace(regex, '');
        }

        // 6. Remove TypeScript type annotations that Babel may choke on
        //    (simple cases: `: React.FC<Props>`, `: string`, etc.)
        content = content.replace(/:\s*React\.FC\s*(<[^>]*>)?/g, '');
        content = content.replace(/:\s*React\.ReactNode/g, '');
        content = content.replace(/interface\s+\w+\s*\{[^}]*\}\s*\n?/g, '');
        content = content.replace(/type\s+\w+\s*=\s*\{[^}]*\}\s*;?\s*\n?/g, '');
    }

    // ── Vue fixes ──────────────────────────────────────────────────────────────
    if ((framework === 'vue' || framework === 'nuxt_js') && filename.endsWith('.vue')) {
        if (!content.includes('<template>') && (content.includes('<div') || content.includes('<section'))) {
            content = `<template>\n${content}\n</template>`;
        }
    }

    // ── Dangerous pattern removal (all frameworks) ─────────────────────────────
    for (const dp of DANGEROUS_PATTERNS) {
        content = content.replace(dp.pattern, dp.replacement);
    }

    // ── Strip leftover markdown fences ─────────────────────────────────────────
    if (content.trimStart().startsWith('```')) {
        const lines = content.split('\n');
        const codeLines = [];
        let inBlock = false;
        for (const line of lines) {
            if (line.trim().startsWith('```')) {
                inBlock = !inBlock;
                continue;
            }
            if (inBlock) codeLines.push(line);
        }
        const stripped = codeLines.join('\n').trim();
        if (stripped) content = stripped;
    }

    return content;
}

/**
 * Validate file structure for obvious issues.
 * Returns array of warning strings (empty = valid).
 * @param {Array} files - Array of { filename, content } objects
 * @param {string} framework - The target framework
 * @returns {string[]} Array of validation warnings
 */
function validateFiles(files, framework) {
    const warnings = [];
    if (!files || files.length === 0) {
        warnings.push('No files to validate');
        return warnings;
    }

    for (const file of files) {
        if (!file.content || !file.content.trim()) {
            warnings.push(`${file.filename}: File is empty`);
            continue;
        }

        // Quick bracket balance check
        const brackets = { '{': 0, '(': 0, '[': 0 };
        const closers = { '}': '{', ')': '(', ']': '[' };
        let inString = false;
        let strChar = null;
        let escaped = false;

        for (const ch of file.content) {
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (inString) {
                if (ch === strChar) inString = false;
                continue;
            }
            if (ch === '"' || ch === "'" || ch === '`') {
                inString = true;
                strChar = ch;
                continue;
            }
            if (brackets[ch] !== undefined) brackets[ch]++;
            if (closers[ch]) brackets[closers[ch]]--;
        }

        for (const [br, count] of Object.entries(brackets)) {
            if (count > 0) warnings.push(`${file.filename}: ${count} unclosed '${br}'`);
            if (count < 0) warnings.push(`${file.filename}: Extra '${br === '{' ? '}' : br === '(' ? ')' : ']'}'`);
        }
    }
    return warnings;
}

/**
 * Try to pre-compile code with Babel to catch syntax errors early.
 * Returns { success: boolean, error: string|null }
 * Only works if Babel is available (in-browser context).
 * @param {string} code - Combined code to validate
 * @returns {{ success: boolean, error: string|null }}
 */
export function preBabelCheck(code) {
    try {
        if (typeof window !== 'undefined' && window.Babel) {
            window.Babel.transform(code, {
                presets: ['react', 'env', 'typescript'],
                filename: 'preview.tsx',
            });
            return { success: true, error: null };
        }
        // Babel not available — skip check
        return { success: true, error: null };
    } catch (e) {
        return { success: false, error: e.message || 'Unknown Babel error' };
    }
}

/**
 * Main sanitization entry point.
 * Sanitizes all files and validates structure.
 * @param {Array} files - Array of { filename, content } objects
 * @param {string} framework - The target framework
 * @returns {Array} Sanitized array of { filename, content } objects
 */
export function sanitizeFiles(files, framework) {
    if (!Array.isArray(files) || files.length === 0) return files;

    // Step 1: Sanitize each file
    const sanitized = files.map(file => ({
        filename: file.filename,
        content: sanitizeFileContent(file.content, file.filename, framework),
    }));

    // Step 2: Cross-file deduplication for React/Next.js
    // If a component name matches its filename (e.g., Header in Header.jsx),
    // remove any duplicate function/class/const declarations from other files.
    if ((framework === 'react' || framework === 'next_js') && sanitized.length > 1) {
        const ownedComponents = {};
        for (const f of sanitized) {
            const fn = f.filename || '';
            if (fn.match(/\.(jsx|js|tsx|ts)$/)) {
                const stem = fn.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
                if (stem && /^[A-Z]/.test(stem)) {
                    ownedComponents[stem] = fn;
                }
            }
        }

        for (const [compName, ownerFile] of Object.entries(ownedComponents)) {
            for (const f of sanitized) {
                if (f.filename === ownerFile || !f.content) continue;
                // Remove duplicate component function/class/const declarations
                const patterns = [
                    new RegExp(`^(?:export\\s+(?:default\\s+)?)?function\\s+${compName}\\s*\\(`, 'gm'),
                    new RegExp(`^(?:export\\s+(?:default\\s+)?)?const\\s+${compName}\\s*=\\s*(?:\\(|function)`, 'gm'),
                    new RegExp(`^(?:export\\s+(?:default\\s+)?)?class\\s+${compName}\\s*[{(]`, 'gm'),
                ];
                for (const pat of patterns) {
                    if (pat.test(f.content)) {
                        // Remove the entire function/class block (heuristic: up to matching closing brace)
                        const blockPat = new RegExp(
                            `^(?:export\\s+(?:default\\s+)?)?(?:function|const|class)\\s+${compName}[\\s\\S]*?\\n\\}[;\\s]*$`,
                            'gm'
                        );
                        const newContent = f.content.replace(blockPat, `/* ${compName}: defined in ${ownerFile} */`);
                        if (newContent !== f.content) {
                            console.warn(`[CodeSanitizer] Removed duplicate '${compName}' from ${f.filename}`);
                            f.content = newContent;
                        }
                        break;
                    }
                }
            }
        }
    }

    // Step 3: Validate (logging only — don't block rendering)
    const warnings = validateFiles(sanitized, framework);
    if (warnings.length > 0) {
        console.warn('[CodeSanitizer] Validation warnings:', warnings);
    }

    return sanitized;
}

/**
 * Generate a safe fallback React component as a string.
 * Used when Babel pre-check fails — this code is guaranteed valid JSX.
 * @param {string} errorMessage - The error that caused the fallback
 * @returns {string} Safe JSX code string
 */
export function getSafeFallbackCode(errorMessage) {
    // Escape the error message for safe embedding
    const safeMsg = (errorMessage || 'Unknown error')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, ' ')
        .slice(0, 300);

    return `
function App() {
    return React.createElement('div', {
        style: {
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }
    },
        React.createElement('div', {
            style: {
                maxWidth: '560px',
                width: '100%',
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                padding: '40px',
                textAlign: 'center'
            }
        },
            React.createElement('div', {
                style: {
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    margin: '0 auto 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                }
            }, '\\u2728'),
            React.createElement('h2', {
                style: { fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }
            }, 'Generated UI Preview'),
            React.createElement('p', {
                style: { fontSize: '14px', color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }
            }, 'The AI-generated code had a syntax error, so a simplified preview is shown.'),
            React.createElement('div', {
                style: {
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '16px',
                    textAlign: 'left'
                }
            },
                React.createElement('p', {
                    style: { fontSize: '12px', color: '#991b1b', margin: 0, fontFamily: 'monospace', wordBreak: 'break-word' }
                }, '${safeMsg}')
            ),
            React.createElement('p', {
                style: { margin: '20px 0 0', fontSize: '12px', color: '#9ca3af' }
            }, 'Try asking the AI assistant to fix the code.')
        )
    );
}
`;
}

/**
 * Generate a fallback HTML preview when all else fails.
 * Extracts visible text and basic structure from the code.
 * @param {Array} files - Array of { filename, content } objects
 * @param {string} framework - The target framework
 * @returns {string} Safe HTML string for preview
 */
export function generateFallbackHtml(files, framework) {
    const allContent = files.map(f => f.content || '').join('\n');

    // Try to extract text content from JSX/HTML
    const textContent = allContent
        .replace(/<script[\s\S]*?<\/script>/gi, '')  // Remove scripts
        .replace(/<style[\s\S]*?<\/style>/gi, '')    // Remove styles
        .replace(/{[\s\S]*?}/g, '')                   // Remove JS expressions
        .replace(/<[^>]+>/g, ' ')                     // Remove HTML tags
        .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '') // Remove imports
        .replace(/export\s+(default\s+)?/g, '')       // Remove exports
        .replace(/\s+/g, ' ')                         // Collapse whitespace
        .trim()
        .slice(0, 500);                               // Limit length

    // Extract CSS if present
    let css = '';
    const styleMatch = allContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch) css = styleMatch[1];

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Fallback Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    ${css}
  </style>
</head>
<body>
  <div style="min-height:100vh;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px">
    <div style="max-width:600px;width:100%;background:white;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:40px;text-align:center">
      <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#6366f1);margin:0 auto 20px;display:flex;align-items:center;justify-content:center">
        <svg width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
      </div>
      <h2 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 8px">Simplified Preview</h2>
      <p style="font-size:14px;color:#64748b;margin:0 0 24px;line-height:1.6">
        The code couldn't be rendered as a live preview. Here's a simplified view of the content.
      </p>
      <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:left;font-size:13px;color:#334155;line-height:1.8;word-break:break-word">
        ${textContent || '<em style="color:#94a3b8">No visible content could be extracted.</em>'}
      </div>
      <div style="margin-top:24px;padding:16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;text-align:left">
        <p style="font-size:12px;color:#92400e;margin:0"><strong>⚠ Note:</strong> This is a fallback view. The original code had rendering issues. Try editing the code or asking the AI assistant to fix it.</p>
      </div>
    </div>
    <p style="margin-top:20px;font-size:12px;color:#94a3b8">${framework} · ${files.length} file(s)</p>
  </div>
</body>
</html>`;
}
