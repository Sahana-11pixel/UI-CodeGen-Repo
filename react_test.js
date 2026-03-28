const files = [
    {
        "filename": "App.jsx",
        "content": "import React from 'react';\nimport Header from './Header.jsx';\n\nconst App = () => {\n  return (\n    <div>\n      <Header />\n      <h1>Hello</h1>\n    </div>\n  );\n};\n\nexport default App;\n"
    }
];

const processReactFile = (code, isMain, filename) => {
    const compName = filename.replace(/\.(jsx|js|tsx|ts)$/, '');
    let processed = code.replace(/import\s+.*?from\s+['"].*?['"](;)?(\n|\r)?/g, '');

    // Strategy: 
    // 1. Remove all matching "export default " at the beginning of lines
    if (processed.includes('export default function ')) {
        processed = processed.replace(/^export\s+default\s+function\s+(\w+)/m, 'window.$1 = function $1');
    } else if (processed.includes('export default ')) {
        processed = processed.replace(/^export\s+default\s+(\w+);?/m, 'window.$1 = $1;');
    }

    // Ensure main component gets assigned to window.App
    if (isMain && !processed.includes('window.App =')) {
        processed += `\nwindow.App = ${compName};`;
    }

    return processed;
};

const mainFile = files[0];
const otherFiles = [];

const mainCode = processReactFile(mainFile.content, true, mainFile.filename);

console.log("\n=== MAIN COMPONENT ===");
console.log(mainCode);
