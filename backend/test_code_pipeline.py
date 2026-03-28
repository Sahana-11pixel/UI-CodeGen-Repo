#!/usr/bin/env python3
"""
Unit tests for the Code Safety Pipeline.
Tests post_process_code, validate_generated_code, detect_framework, and run_code_safety_pipeline.
"""
import json
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# We test the pipeline functions directly
from server import (
    post_process_code,
    validate_generated_code,
    detect_framework,
    run_code_safety_pipeline,
)

tests_run = 0
tests_passed = 0
failed_tests = []


def test(name, condition, detail=""):
    global tests_run, tests_passed
    tests_run += 1
    if condition:
        tests_passed += 1
        print(f"  ✅ {name}")
    else:
        failed_tests.append(name)
        print(f"  ❌ {name} — {detail}")


# ==================== post_process_code ====================
print("\n🔧 post_process_code tests")
print("-" * 40)

# Test 1: class= → className= in React JSX
files = [{"filename": "App.jsx", "content": '<div class="container"><span class="text">Hello</span></div>'}]
result = post_process_code(files, "react")
test("class → className in React",
     'className="container"' in result[0]["content"] and 'className="text"' in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 2: Should NOT convert className= to classNameName=
files = [{"filename": "App.jsx", "content": '<div className="container">Hello</div>'}]
result = post_process_code(files, "react")
test("Preserves existing className",
     'className="container"' in result[0]["content"] and 'classNameName' not in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 3: String refs to useRef
files = [{"filename": "App.jsx", "content": 'const App = () => {\n  return <input ref="myInput" />;\n};'}]
result = post_process_code(files, "react")
test("String ref → useRef",
     'ref={myInputRef}' in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 4: Strip unsupported imports
files = [{"filename": "App.jsx", "content": "import { motion } from 'framer-motion';\nimport React from 'react';\nconst App = () => <div>Hello</div>;"}]
result = post_process_code(files, "react")
test("Strip framer-motion import",
     "framer-motion" not in result[0]["content"] and "React" in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 5: Remove 'use server'
files = [{"filename": "App.jsx", "content": "'use server';\nconst App = () => <div>Hello</div>;"}]
result = post_process_code(files, "react")
test("Remove 'use server'",
     "'use server'" not in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 6: Vue — add <template> if missing
files = [{"filename": "App.vue", "content": "<div>Hello</div>"}]
result = post_process_code(files, "vue")
test("Vue: add <template> wrapper",
     "<template>" in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 7: Don't modify HTML files for React fixes
files = [{"filename": "index.html", "content": '<div class="container">Hello</div>'}]
result = post_process_code(files, "react")
test("Skip class→className for HTML files",
     'class="container"' in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 8: Strip markdown fences
files = [{"filename": "App.jsx", "content": "```jsx\nconst App = () => <div>Hello</div>;\n```"}]
result = post_process_code(files, "react")
test("Strip markdown fences",
     "```" not in result[0]["content"] and "Hello" in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 9: Multiple unsupported imports
files = [{"filename": "App.jsx", "content": "import { motion } from 'framer-motion';\nimport { Button } from '@chakra-ui/react';\nconst App = () => <div>Hello</div>;"}]
result = post_process_code(files, "react")
test("Strip multiple unsupported imports",
     "framer-motion" not in result[0]["content"] and "@chakra-ui" not in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 10: class= in Next.js
files = [{"filename": "page.tsx", "content": '<div class="container">Hello</div>'}]
result = post_process_code(files, "next_js")
test("class → className in Next.js",
     'className="container"' in result[0]["content"],
     f"Got: {result[0]['content']}")


# ==================== validate_generated_code ====================
print("\n🔍 validate_generated_code tests")
print("-" * 40)

# Test 11: Valid React code passes
files = [{"filename": "App.jsx", "content": "const App = () => {\n  return (<div className=\"test\">Hello</div>);\n};"}]
is_valid, errors = validate_generated_code(files, "react")
test("Valid React code passes validation",
     is_valid and len(errors) == 0,
     f"Errors: {errors}")

# Test 12: Unbalanced braces detected
files = [{"filename": "App.jsx", "content": "const App = () => {\n  return (<div>Hello</div>);"}]
is_valid, errors = validate_generated_code(files, "react")
test("Detect unbalanced braces",
     not is_valid and any("unclosed" in e.lower() or "unbalanced" in e.lower() for e in errors),
     f"Errors: {errors}")

# Test 13: Empty file detected
files = [{"filename": "App.jsx", "content": ""}]
is_valid, errors = validate_generated_code(files, "react")
test("Detect empty file",
     not is_valid and any("empty" in e.lower() for e in errors),
     f"Errors: {errors}")

# Test 14: class= in React detected
files = [{"filename": "App.jsx", "content": 'const App = () => <div class="x">Hello</div>;'}]
is_valid, errors = validate_generated_code(files, "react")
test("Detect class= in React",
     not is_valid and any("class=" in e.lower() for e in errors),
     f"Errors: {errors}")

# Test 15: No files
is_valid, errors = validate_generated_code([], "react")
test("Detect no files",
     not is_valid,
     f"Errors: {errors}")

# Test 16: Vue missing template
files = [{"filename": "App.vue", "content": "<script>\nexport default { name: 'App' }\n</script>"}]
is_valid, errors = validate_generated_code(files, "vue")
test("Detect missing <template> in Vue",
     not is_valid and any("template" in e.lower() for e in errors),
     f"Errors: {errors}")

# Test 17: Valid Vue code passes
files = [{"filename": "App.vue", "content": "<template>\n  <div>Hello</div>\n</template>\n<script>\nexport default { name: 'App' }\n</script>"}]
is_valid, errors = validate_generated_code(files, "vue")
test("Valid Vue code passes validation",
     is_valid,
     f"Errors: {errors}")

# Test 18: String ref detected
files = [{"filename": "App.jsx", "content": 'const App = () => <input ref="myInput" />;'}]
is_valid, errors = validate_generated_code(files, "react")
test("Detect string ref in React",
     not is_valid and any("ref" in e.lower() for e in errors),
     f"Errors: {errors}")


# ==================== detect_framework ====================
print("\n🔎 detect_framework tests")
print("-" * 40)

# Test 19: Detect React
files = [{"filename": "App.jsx", "content": "import React from 'react';\nconst App = () => <div>Hello</div>;"}]
test("Detect React", detect_framework(files) == "react", f"Got: {detect_framework(files)}")

# Test 20: Detect Vue
files = [{"filename": "App.vue", "content": "<template><div>Hello</div></template><script>export default {}</script>"}]
test("Detect Vue", detect_framework(files) == "vue", f"Got: {detect_framework(files)}")

# Test 21: Detect Next.js
files = [{"filename": "app/page.tsx", "content": "import Image from 'next/image';\nexport default function Page() { return <div>Hello</div>; }"}]
test("Detect Next.js", detect_framework(files) == "next_js", f"Got: {detect_framework(files)}")

# Test 22: Detect HTML
files = [{"filename": "index.html", "content": "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>"}]
test("Detect HTML", detect_framework(files) in ["html_css", "html"], f"Got: {detect_framework(files)}")

# Test 23: Detect Svelte
files = [{"filename": "App.svelte", "content": "<script>let name = 'world';</script><h1>Hello {name}!</h1>"}]
test("Detect Svelte", detect_framework(files) == "svelte", f"Got: {detect_framework(files)}")

# Test 24: Detect Bootstrap
files = [{"filename": "index.html", "content": '<!DOCTYPE html><html><head><link href="bootstrap"></head><body class="container"><h1>Hello</h1></body></html>'}]
test("Detect Bootstrap", detect_framework(files) == "bootstrap", f"Got: {detect_framework(files)}")


# ==================== run_code_safety_pipeline (integration) ====================
print("\n🚀 run_code_safety_pipeline integration tests")
print("-" * 40)

# Test 25: Pipeline fixes class= in React
files_json = json.dumps([{"filename": "App.jsx", "content": '<div class="test">Hello</div>'}])
result_json = run_code_safety_pipeline(files_json, "react")
result = json.loads(result_json)
test("Pipeline: class → className",
     'className="test"' in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 26: Pipeline handles valid code without changes
files_json = json.dumps([{"filename": "App.jsx", "content": 'const App = () => {\n  return (<div className="test">Hello</div>);\n};'}])
result_json = run_code_safety_pipeline(files_json, "react")
result = json.loads(result_json)
test("Pipeline: valid code passes through",
     'className="test"' in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 27: Pipeline handles invalid JSON gracefully
result_json = run_code_safety_pipeline("not valid json", "react")
test("Pipeline: handles invalid JSON",
     result_json == "not valid json",
     f"Got: {result_json}")

# Test 28: Pipeline handles empty files list
files_json = json.dumps([])
result_json = run_code_safety_pipeline(files_json, "react")
test("Pipeline: handles empty list",
     json.loads(result_json) == [],
     f"Got: {result_json}")


# ==================== Phase 2: Escape normalization ====================
print("\n🧹 Phase 2: Escape normalization tests")
print("-" * 40)

# Test 29: BOM character removal
files = [{"filename": "App.jsx", "content": "\uFEFFconst App = () => <div>Hello</div>;"}]
result = post_process_code(files, "react")
test("Remove BOM character",
     "\uFEFF" not in result[0]["content"] and "Hello" in result[0]["content"],
     f"Got: {result[0]['content'][:50]}")

# Test 30: Zero-width character removal
files = [{"filename": "App.jsx", "content": "const App\u200B = () => <div>Hello</div>;"}]
result = post_process_code(files, "react")
test("Remove zero-width chars",
     "\u200B" not in result[0]["content"],
     f"Got: {result[0]['content'][:50]}")

# Test 31: Non-printable control character removal
files = [{"filename": "App.jsx", "content": "const App = () => <div>\x01Hello\x02</div>;"}]
result = post_process_code(files, "react")
test("Remove control chars",
     "\x01" not in result[0]["content"] and "\x02" not in result[0]["content"],
     f"Got: {result[0]['content'][:50]}")

# Test 32: Expanded imports - axios
files = [{"filename": "App.jsx", "content": "import axios from 'axios';\nconst App = () => <div>Hello</div>;"}]
result = post_process_code(files, "react")
test("Strip axios import",
     "axios" not in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 33: Expanded imports - next/font
files = [{"filename": "App.jsx", "content": "import { Inter } from 'next/font/google';\nconst App = () => <div>Hello</div>;"}]
result = post_process_code(files, "react")
test("Strip next/font import",
     "next/font" not in result[0]["content"],
     f"Got: {result[0]['content']}")

# Test 34: Pipeline end-to-end with BOM + class=
files_json = json.dumps([{"filename": "App.jsx", "content": "\uFEFF<div class=\"test\">Hello</div>"}])
result_json = run_code_safety_pipeline(files_json, "react")
result = json.loads(result_json)
test("Pipeline: BOM removal + class fix",
     "\uFEFF" not in result[0]["content"] and 'className="test"' in result[0]["content"],
     f"Got: {result[0]['content']}")


# ==================== Duplicate Declaration Detection ====================
print("\n🔁 Duplicate declaration tests")
print("-" * 40)

# Test 35: Detect duplicate function declarations across files
files = [
    {"filename": "Header.jsx", "content": "function Header() {\n  return <div>Header</div>;\n}"},
    {"filename": "App.jsx", "content": "function Header() {\n  return <div>Header</div>;\n}\nfunction App() {\n  return <div><Header /></div>;\n}"},
]
is_valid, errors = validate_generated_code(files, "react")
test("Detect duplicate component across files",
     not is_valid and any("Duplicate" in e or "duplicate" in e for e in errors),
     f"Errors: {errors}")

# Test 36: No false positive for single declaration
files = [
    {"filename": "Header.jsx", "content": "function Header() {\n  return <div>Header</div>;\n}"},
    {"filename": "App.jsx", "content": "function App() {\n  return <div><Header /></div>;\n}"},
]
is_valid, errors = validate_generated_code(files, "react")
test("No false positive for unique declarations",
     is_valid,
     f"Errors: {errors}")

# Test 37: post_process_code removes duplicate from App.jsx
files = [
    {"filename": "Header.jsx", "content": "function Header() {\n  return <div>Header</div>;\n}\nexport default Header;"},
    {"filename": "App.jsx", "content": "import Header from './Header';\n\nfunction Header() {\n  return <div>Copy</div>;\n}\n\nfunction App() {\n  return <div><Header /></div>;\n}\nexport default App;"},
]
result = post_process_code(files, "react")
app_content = next(f["content"] for f in result if f["filename"] == "App.jsx")
# After dedup, App.jsx should NOT have a standalone function Header definition
has_dup = "function Header()" in app_content and "defined in Header.jsx" not in app_content
test("Post-process removes duplicate component from App.jsx",
     "defined in Header.jsx" in app_content or "function Header()" not in app_content,
     f"App.jsx content: {app_content[:200]}")

# Test 38: Pipeline end-to-end with duplicates
files_json = json.dumps([
    {"filename": "Header.jsx", "content": "function Header() {\n  return <div className=\"header\">Header</div>;\n}\nexport default Header;"},
    {"filename": "App.jsx", "content": "import Header from './Header';\n\nfunction Header() {\n  return <div className=\"header\">Copy</div>;\n}\n\nfunction App() {\n  return <div><Header /></div>;\n}\nexport default App;"},
])
result_json = run_code_safety_pipeline(files_json, "react")
result = json.loads(result_json)
app_result = next(f["content"] for f in result if f["filename"] == "App.jsx")
test("Pipeline: fixes duplicate declaration end-to-end",
     "function Header()" not in app_result or "defined in Header.jsx" in app_result,
     f"App.jsx content: {app_result[:200]}")


print("\n" + "=" * 50)
print(f"📊 TEST SUMMARY: {tests_passed}/{tests_run} passed")
if failed_tests:
    print(f"\n❌ FAILED TESTS:")
    for t in failed_tests:
        print(f"  • {t}")
    sys.exit(1)
else:
    print("✅ All tests passed!")
    sys.exit(0)

