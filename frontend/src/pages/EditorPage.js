import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  Save, Copy, Download, Eye, EyeOff, Smartphone, Tablet, Monitor,
  RefreshCw, ExternalLink, Edit2, Check, MessageSquare, Send, Undo, Redo, History, Clock
} from 'lucide-react';
import { codeAPI, projectAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import JSZip from 'jszip';
import Layout from '../components/Layout';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sanitizeFiles, generateFallbackHtml, getSafeFallbackCode } from '../lib/codeSanitizer';

// ── Helpers ──────────────────────────────────────────────────────────────────

const parseCodeToFiles = (codeInput) => {
  if (Array.isArray(codeInput)) return codeInput;
  if (!codeInput || typeof codeInput !== 'string') return [{ filename: 'index.html', content: '' }];
  try {
    const parsed = JSON.parse(codeInput);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].filename && parsed[0].content !== undefined) return parsed;
    // Handle leaked response wrapper: {"intent": "...", "code": [...]}
    if (parsed && typeof parsed === 'object' && parsed.code) {
      const code = parsed.code;
      if (Array.isArray(code) && code.length > 0 && code[0].filename) return code;
      if (typeof code === 'string') return parseCodeToFiles(code);
    }
  } catch (e) { /* raw string */ }
  return [{ filename: 'index.html', content: codeInput }];
};

const getEditorLanguage = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  return { jsx: 'javascript', js: 'javascript', vue: 'html', svelte: 'html', html: 'html', css: 'css', ts: 'typescript', tsx: 'typescript' }[ext] || 'html';
};

// ── Preview HTML generator ────────────────────────────────────────────────────

const getPreviewHtml = (files, framework) => {
  if (!files || files.length === 0) return '<html><body>No files</body></html>';

  const base = (body = '', head = '', scripts = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Preview</title>
  <style>*{box-sizing:border-box}body{margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif}#root,#app{width:100%;min-height:100vh}</style>
  ${head}
</head>
<body>
  ${body}
  ${scripts}
</body>
</html>`;

  // ── REACT & NEXT.JS (App Router / Pages) ──────────────────────────────────
  if (framework === 'react' || framework === 'next_js') {
    const allCode = files.map(f => f.content).join('\n');
    const mocks = [];

    if (framework === 'next_js') {
      mocks.push(`const Image = (p) => React.createElement('img', { ...p, src: p.src || '', alt: p.alt || '' });`);
      mocks.push(`const Link = (p) => React.createElement('a', { ...p, href: p.href || '#' }, p.children);`);
      mocks.push(`const Head = (p) => React.createElement(Fragment, null, p.children);`);
      mocks.push(`const Script = (p) => React.createElement(Fragment, null, p.children);`);
      // Mock Next.js router hooks so they don't crash
      mocks.push(`const useRouter = () => ({ push: () => {}, replace: () => {}, back: () => {}, pathname: '/', query: {}, asPath: '/' });`);
      mocks.push(`const usePathname = () => '/';`);
      mocks.push(`const useSearchParams = () => new URLSearchParams();`);
      mocks.push(`const notFound = () => {};`);
      mocks.push(`const redirect = () => {};`);
    }

    const lucideIcons = new Set();
    const allImports = new Set();

    // Extract ALL imported names
    [...allCode.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)].forEach(m => {
      const source = m[2];
      m[1].split(',').forEach(i => {
        const name = i.trim().split(/\s+as\s+/)[1] || i.trim().split(/\s+as\s+/)[0];
        if (name) {
          if (source.includes('lucide-react')) lucideIcons.add(name);
          else allImports.add(name);
        }
      });
    });

    [...allCode.matchAll(/import\s+([a-zA-Z0-9_$]+)\s+from\s+['"]([^'"]+)['"]/g)].forEach(m => {
      if (!m[2].includes('lucide-react')) allImports.add(m[1].trim());
    });

    if (lucideIcons.size > 0) {
      mocks.push(`const _LI=(n)=>(p={})=>{const{size=20,className='',style:s={}}=p;return React.createElement('span',{className,style:{display:'inline-flex',alignItems:'center',justifyContent:'center',width:size,height:size,background:'#e5e7eb',borderRadius:3,fontSize:7,color:'#6b7280',...s}},n.slice(0,2));};`);
      mocks.push([...lucideIcons].map(i => `const ${i}=_LI('${i}');`).join(''));
    }

    // Defensive generic mocks for hallucinated UI components (only capitalized)
    const ignoredGlobals = new Set([
      'React','useState','useEffect','useRef','useCallback','useMemo','useReducer',
      'useContext','createContext','Fragment','forwardRef','memo','Suspense',
      'Image','Link','Head','Script','useRouter','usePathname','useSearchParams',
      'notFound','redirect'
    ]);
    // Also mock Suspense as passthrough
    mocks.push(`const Suspense = (p) => React.createElement(Fragment, null, p.children);`);
    const genericMocks = [...allImports].filter(n => !ignoredGlobals.has(n) && /^[A-Z]/.test(n));
    if (genericMocks.length > 0) {
      genericMocks.forEach(n => {
        mocks.push(`window.${n} = window.${n} || ((p) => React.createElement('div', { 'data-mock': '${n}', className: p.className, style: { border: '1px dashed #ef4444', padding: '8px', margin: '4px', borderRadius: '4px', display: 'inline-block', color: '#ef4444', fontSize: '12px', ...p.style } }, p.children || '${n}'));`);
      });
    }

    if (allCode.includes('recharts')) {
      mocks.push(`const _RM=(n)=>(p={})=>React.createElement('div',{style:{border:'1px dashed #ccc',padding:8,textAlign:'center',minHeight:60,display:'flex',alignItems:'center',justifyContent:'center',background:'#f9f9f9',color:'#999',fontSize:11}},n);['ResponsiveContainer','AreaChart','BarChart','LineChart','PieChart','XAxis','YAxis','CartesianGrid','Tooltip','Legend','Area','Bar','Line','Pie','Cell'].forEach(n=>{window[n]=_RM(n);});`);
    }

    let combinedCode = files.map((f, i) => f.content
      .replace(/['"]use client['"];?/g, '')
      .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
      .replace(/import\s+['"][^'"]+['"];?/g, '')
      .replace(/export\s+const\s+(meta|links|action|loader)\s*(:\s*[a-zA-Z<>]+)?\s*=/g, `var $1_discard_${i} =`)
      .replace(/export\s+default\s+function\s+/g, 'function ')
      .replace(/export\s+default\s+class\s+/g, 'class ')
      .replace(/export\s+default\s+([a-zA-Z0-9_$]+);?/g, '')
      .replace(/export\s+default\s+/g, 'var __exp = ')
      .replace(/export\s+\{[^}]*\}\s*;?/g, '')
      .replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ')
      .replace(/^(const|let)\s+([a-zA-Z0-9_$]+)\s*=/gm, 'var $2 =')
      // Convert function/class declarations to var assignments to allow dedup
      .replace(/^function\s+([A-Z][a-zA-Z0-9_$]*)\s*\(/gm, 'var $1 = function $1(')
      .replace(/^class\s+([A-Z][a-zA-Z0-9_$]*)\s*(extends)?/gm, 'var $1 = class $1 $2')
    ).join('\n\n/* --- next file --- */\n\n');

    // Deduplicate: keep first occurrence of each var declaration
    const seen = new Set();
    combinedCode = combinedCode.replace(/^var\s+([A-Z][a-zA-Z0-9_$]*)\s*=/gm, (match, name) => {
      if (seen.has(name)) return `/* dup removed */ var __dup_${name} =`;
      seen.add(name);
      return match;
    });

    // Normalize escape sequences that crash Babel
    combinedCode = combinedCode
      .replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Smart/curly quotes to standard ASCII
      .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

    const mainFile = files.find(f => f.filename === 'App.jsx' || f.filename === 'App.js' || f.filename === 'page.tsx' || f.filename === 'app/page.tsx' || f.filename === 'index.tsx') || files[0];
    let mainName = mainFile.filename.replace(/\.(jsx|js|tsx|ts)$/, '').replace(/^(app|pages)\//, '');
    if (mainName === 'page' || mainName === 'index') mainName = 'Page';

    return base(
      `<div id="root"></div>`,
      `<script src="https://cdn.tailwindcss.com"></script>
       <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
       <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
       <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>`,
      `<script>
         window.addEventListener('error',function(e){
           var el=document.getElementById('root');
           if(el)el.innerHTML='<div style="padding:16px;color:#c00;background:#fee;border:1px solid #fcc;margin:12px;border-radius:6px;font-family:monospace"><b>Error:</b><br>'+e.message+'</div>';
         });
       </script>
       <script type="text/babel" data-presets="react,env,typescript">
         const{useState,useEffect,useRef,useCallback,useMemo,useReducer,useContext,createContext,Fragment,forwardRef,memo}=React;
         ${mocks.join('\n')}
         ${combinedCode}
         const _App=typeof ${mainName}!=='undefined'?${mainName}:typeof Page!=='undefined'?Page:typeof Home!=='undefined'?Home:typeof App!=='undefined'?App:()=>React.createElement('div',{style:{padding:20,color:'#c00'}},'Cannot find main component');
         ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(_App));
       </script>`
    );
  }

  // ── HTML / CSS / Bootstrap / Tailwind / Vanilla ────────────────────────────
  if (['html', 'html_css', 'bootstrap', 'tailwind', 'vanilla_js'].includes(framework)) {
    const code = files[0] ? files[0].content : '';
    if (code.trim().toLowerCase().startsWith('<!doctype') || code.trim().startsWith('<html')) return code;
    let head = '';
    if (framework === 'bootstrap') head = `<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>`;
    else if (framework === 'tailwind' || framework === 'html_css') head = `<script src="https://cdn.tailwindcss.com"></script>`;
    return base(code, head);
  }

  // ── VUE & NUXT.JS (vue3-sfc-loader) ──────────────────────────────────────────
  if (framework === 'vue' || framework === 'nuxt_js') {
    const vueFiles = {};
    files.forEach(f => { vueFiles[f.filename] = f.content; });
    const mainFile = files.find(f => f.filename === 'App.vue' || f.filename === 'app.vue' || f.filename === 'pages/index.vue') || files.find(f => f.filename.endsWith('.vue')) || files[0];
    const mainFilename = mainFile ? mainFile.filename : 'App.vue';
    const filesJson = JSON.stringify(vueFiles).replace(/<\/script>/gi, '<\\/script>');

    return base(
      `<div id="app"></div>`,
      `<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
       <script src="https://cdn.jsdelivr.net/npm/vue3-sfc-loader@0.9.5/dist/vue3-sfc-loader.js"></script>
       <script src="https://cdn.tailwindcss.com"></script>`,
      `<script>
         const _vf=${filesJson};
         window.onerror=function(msg){document.getElementById('app').innerHTML='<div style="padding:16px;color:#c00;background:#fee;border:1px solid #fcc;margin:12px;border-radius:6px;font-family:monospace"><b>Vue Error:</b><br>'+msg+'</div>';};
         const{loadModule}=window['vue3-sfc-loader'];
         const{createApp}=Vue;
         const opts={
           moduleCache:{vue:Vue},
           async getFile(url){
             const n=url.replace(/^~?\\/?/, '').replace(/^@?\\/?/, '').replace(/^\\.\\//, '');
             if(_vf[n])return{getContentData:()=>_vf[n]};
             if(_vf[n+'.vue'])return{getContentData:()=>_vf[n+'.vue']};
             throw new Error('Not found: '+url);
           },
           addStyle(t){const s=document.createElement('style');s.textContent=t;document.head.appendChild(s);},
           log(t,...a){if(t==='error')console.error(...a);}
         };
         (async()=>{try{const App=await loadModule('./${mainFilename}',opts);createApp(App).mount('#app');}catch(e){document.getElementById('app').innerHTML='<div style="padding:16px;color:#c00;background:#fee;border:1px solid #fcc;margin:12px;border-radius:6px;font-family:monospace"><b>Vue Compile Error:</b><br>'+e.message+'</div>';console.error(e);}})();
       </script>`
    );
  }

  // ── SVELTE (Svelte 3 browser compiler + blob URLs) ─────────────────────────
  if (framework === 'svelte') {
    const mainFile = files.find(f => f.filename === 'App.svelte') || files[0];
    const otherFiles = files.filter(f => f !== mainFile && f.filename.endsWith('.svelte'));
    const svelteFilesMap = {};
    files.forEach(f => { svelteFilesMap[f.filename] = f.content; });
    const svelteFilesJson = JSON.stringify(svelteFilesMap).replace(/<\/script>/gi, '<\\/script>');
    const mainFilename = mainFile ? mainFile.filename : 'App.svelte';
    const subFilenames = JSON.stringify(otherFiles.map(f => f.filename));

    const moduleScript = [
      '(async()=>{',
      'if(!window.svelte){document.getElementById("app").innerHTML="<div style=\\"padding:16px;color:#c00;font-family:monospace\\"><b>Svelte Error:</b> Compiler not loaded.</div>";return;}',
      'const appEl=document.getElementById("app");',
      'const showErr=(msg)=>{appEl.innerHTML="<div style=\\"padding:16px;color:#c00;background:#fee;border:1px solid #fcc;margin:12px;border-radius:6px;font-family:monospace\\"><b>Svelte Error:</b><br>"+msg+"</div>";};',
      'try{',
      'const files='+svelteFilesJson+';',
      'const mainFilename='+JSON.stringify(mainFilename)+';',
      'const subs='+subFilenames+';',
      'const{compile}=window.svelte;',
      'const B="https://esm.sh/svelte@3.59.2";',
      'function patch(c){',
      '  c=c.split("from \'svelte\'").join("from \'"+B+"\'");',
      '  c=c.split(\'from "svelte"\').join(\'from "\'+B+\'"\');',
      '  ["internal","store","transition","animate","easing","motion"].forEach(m=>{',
      '    c=c.split("from \'svelte/"+m+"\'").join("from \'"+B+"/"+m+"\'");',
      '    c=c.split(\'from "svelte/\'+m+\'"\').join(\'from "\'+B+"/"+m+\'"\');',
      '  });',
      '  return c;',
      '}',
      "function strip(s){var q=String.fromCharCode(39),d=String.fromCharCode(34),a='from '+q+'svelte',b='from '+d+'svelte';return s.split(String.fromCharCode(10)).filter(function(l){var t=l.trim();return!(t.indexOf('import')!==-1&&(t.indexOf(a)!==-1||t.indexOf(b)!==-1));}).join(String.fromCharCode(10));}",
      'function toBlob(src,name){',
      '  const{js,css}=compile(strip(src),{generate:"dom",format:"esm",name,dev:false});',
      '  if(css&&css.code){const s=document.createElement("style");s.textContent=css.code;document.head.appendChild(s);}',
      '  return URL.createObjectURL(new Blob([patch(js.code)],{type:"text/javascript"}));',
      '}',
      'const subUrls={};',
      'for(const fn of subs){const name=fn.replace(/\\.svelte$/,"");const base=fn.split("/").pop();const baseName=base.replace(/\\.svelte$/,"");const u=toBlob(files[fn]||"",baseName);subUrls[fn]=u;subUrls["./"+fn]=u;subUrls[name]=u;subUrls[base]=u;subUrls["./"+base]=u;subUrls[baseName]=u;subUrls["./components/"+base]=u;subUrls["components/"+base]=u;}',
      'const{js,css}=compile(strip(files[mainFilename]||""),{generate:"dom",format:"esm",name:"App",dev:false});',
      'if(css&&css.code){const s=document.createElement("style");s.textContent=css.code;document.head.appendChild(s);}',
      'let code=patch(js.code);',
      'for(const[k,u]of Object.entries(subUrls)){code=code.split("from \'"+k+"\'").join("from \'"+u+"\'");code=code.split(\'from "\'+k+\'"\').join(\'from "\'+u+\'"\');}',
      'const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"}));',
      'const{default:App}=await import(url);',
      'new App({target:appEl,props:{}});',
      '}catch(e){showErr(e.name+": "+e.message);console.error("Svelte preview error:",e);}',
      '})();',
    ].join('\n');

    return base(
      `<div id="app"></div>`,
      `<script src="https://cdn.jsdelivr.net/npm/svelte@3.59.2/compiler.js"><\/script>
       <script src="https://cdn.tailwindcss.com"><\/script>`,
      `<script type="module">\n${moduleScript}\n<\/script>`
    );
  }

  // ── Default ────────────────────────────────────────────────────────────────
  return files[0] ? files[0].content : '';
};

// ── EditorPage Component ──────────────────────────────────────────────────────

const EditorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const iframeRef = useRef(null);

  const initialFiles = parseCodeToFiles(location.state?.code);
  const [files, setFiles] = useState(initialFiles);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [framework, setFramework] = useState(location.state?.framework || 'react');
  const [projectId, setProjectId] = useState(location.state?.projectId || null);
  const [projectTitle, setProjectTitle] = useState(location.state?.title || 'Untitled Project');
  const [lastSavedTitle, setLastSavedTitle] = useState(location.state?.title || 'Untitled Project');
  const [imageUrl, setImageUrl] = useState(location.state?.image_url || null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [deviceMode, setDeviceMode] = useState('desktop');
  const [previewKey, setPreviewKey] = useState(0);
  const [previewHtml, setPreviewHtml] = useState('');

  // Version History state
  const [versions, setVersions] = useState(location.state?.versions || []);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [activeVersionLabel, setActiveVersionLabel] = useState(null);
  const versionPanelRef = useRef(null);

  const activeFile = files[activeFileIndex] || files[0] || { filename: 'index.html', content: '' };

  const pushToHistory = (newFiles) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, newFiles];
    });
    setHistoryIndex(prev => prev + 1);
    setFiles(newFiles);
  };

  // Debounced push for manual typing to avoid flooding the history stack
  const timeoutRef = useRef(null);
  const updateActiveFileContent = (newContent) => {
    const newFiles = files.map((f, i) => i === activeFileIndex ? { ...f, content: newContent } : f);
    setFiles(newFiles);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setHistory(prev => {
        const truncated = prev.slice(0, historyIndex + 1);
        if (JSON.stringify(truncated[truncated.length - 1]) === JSON.stringify(newFiles)) return prev;
        return [...truncated, newFiles];
      });
      setHistoryIndex(prev => prev + 1);
    }, 500);
  };

  const getFilesJson = () => JSON.stringify(files);

  useEffect(() => {
    if (!files || files.length === 0) { setPreviewHtml(''); return; }
    setPreviewHtml(getPreviewHtml(files, framework));
  }, [files, framework, previewKey]);

  const editorRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [history, setHistory] = useState([initialFiles]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState(
    location.state?.chat_messages && location.state.chat_messages.length > 0
      ? location.state.chat_messages
      : [{ role: 'assistant', content: "Hi! I can help you understand the current code or make specific changes. What would you like to do?" }]
  );

  useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);

  // Close version dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (versionPanelRef.current && !versionPanelRef.current.contains(e.target)) {
        setShowVersionPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch the latest project data on mount/refresh to ensure we have the most up-to-date chat history
  // Since react-router location.state restores the initial snapshot on refresh, it may be stale.
  useEffect(() => {
    const fetchLatestProjectData = async () => {
      if (projectId && user) {
        try {
          const response = await projectAPI.getOne(projectId);
          if (response.data) {
            // Restore latest code if editing hasn't started
            const freshCode = response.data.updated_code || response.data.generated_code;
            if (JSON.stringify(files) === JSON.stringify(initialFiles)) {
              const parsedFresh = parseCodeToFiles(freshCode);
              setFiles(parsedFresh);
              setHistory([parsedFresh]);
              setHistoryIndex(0);
            }

            // ALWAYS restore latest chat history on load/refresh
            if (response.data.chat_messages && response.data.chat_messages.length > 0) {
              setChatHistory(response.data.chat_messages);
            }
            // Sync title just in case it changed
            if (response.data.title) {
              setProjectTitle(response.data.title);
              setLastSavedTitle(response.data.title);
            }
            // Restore versions
            if (response.data.versions) {
              setVersions(response.data.versions);
            }
            // Restore image_url if present
            if (response.data.image_url) {
              setImageUrl(response.data.image_url);
            }
          }
        } catch (e) {
          console.error("Failed to fetch latest project data on reload:", e);
        }
      }
    };
    fetchLatestProjectData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user]);
  
  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatHistory, chatLoading]);

  const handleUndo = (e) => {
    if (e) e.preventDefault();
    if (canUndo) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setFiles(history[newIndex]);
    }
  };

  const handleRedo = (e) => {
    if (e) e.preventDefault();
    if (canRedo) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setFiles(history[newIndex]);
    }
  };
  
  const handleTitleUpdate = async () => {
    setEditingTitle(false);
    if (!projectId || projectTitle === lastSavedTitle || !projectTitle.trim()) {
      if (!projectTitle.trim()) setProjectTitle(lastSavedTitle);
      return;
    }
    
    try {
      await projectAPI.update(projectId, { title: projectTitle });
      setLastSavedTitle(projectTitle);
      toast.success('Project title updated!');
    } catch (e) {
      console.error('Failed to auto-update title:', e);
      // We don't show an error toast here to avoid being intrusive, 
      // as it will still save with the main Save button.
    }
  };

  const handleEditorDidMount = (editor) => { editorRef.current = editor; };
  const handleCopy = () => { navigator.clipboard.writeText(activeFile.content); toast.success(`Copied ${activeFile.filename}!`); };

  const handleSave = async () => {
    try {
      const filesJson = getFilesJson();
      const lastVersion = versions.length > 0 ? versions[versions.length - 1] : null;
      const codeChanged = !lastVersion || lastVersion.code !== filesJson;
      const titleChanged = projectTitle !== lastSavedTitle;

      if (projectId) {
        if (!codeChanged && !titleChanged) {
          toast.info('No changes to save.');
          return;
        }

        const updatedVersions = codeChanged
          ? [...versions, { version: versions.length + 1, code: filesJson, saved_at: new Date().toISOString() }]
          : versions;

        await projectAPI.update(projectId, { 
          title: projectTitle, 
          updated_code: filesJson, 
          chat_messages: chatHistory, 
          versions: updatedVersions 
        });
        
        setVersions(updatedVersions);
        setLastSavedTitle(projectTitle);
        toast.success('Project updated!');
      } else {
        const updatedVersions = [{ version: 1, code: filesJson, saved_at: new Date().toISOString() }];
        const res = await projectAPI.create({ 
          title: projectTitle, 
          framework, 
          generated_code: filesJson, 
          updated_code: filesJson, 
          chat_messages: chatHistory, 
          versions: updatedVersions, 
          image_url: imageUrl 
        });
        
        setProjectId(res.data.id);
        if (res.data.title) {
          setProjectTitle(res.data.title);
          setLastSavedTitle(res.data.title);
        }
        setVersions(updatedVersions);
        toast.success('Project saved!');
        // Update URL state so a refresh keeps the project loaded
        navigate('/editor', { state: { projectId: res.data.id }, replace: true });
      }
      setActiveVersionLabel(null);
    } catch (e) { 
      toast.error(e.response?.data?.detail || 'Failed to save'); 
    }
  };

  const handleExport = async () => {
    const zip = new JSZip();
    files.forEach(f => zip.file(f.filename, f.content));
    zip.file('README.md', `# ${projectTitle}\n\nFramework: ${framework}`);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `${projectTitle.replace(/\s+/g, '-')}.zip` });
    a.click(); URL.revokeObjectURL(url); toast.success('Exported as ZIP!');
  };

  const handleRefresh = () => setPreviewKey(p => p + 1);

  const handleOpenInNewTab = () => {
    const w = window.open(); w.document.write(getPreviewHtml(files, framework)); w.document.close();
  };

  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    setChatLoading(true);
    const userMsg = chatMessage; setChatMessage('');

    // Optimistically update UI
    const updatedHistoryWithUser = [...chatHistory, { role: 'user', content: userMsg }];
    setChatHistory(updatedHistoryWithUser);

    try {
      let activeProjectId = projectId;
      
      // Auto-save the project if chatting for the first time
      if (!activeProjectId) {
        const filesJson = getFilesJson();
        const updatedVersions = [{ version: 1, code: filesJson, saved_at: new Date().toISOString() }];
        
        const createRes = await projectAPI.create({ 
          title: projectTitle, 
          framework, 
          generated_code: filesJson, 
          updated_code: filesJson, 
          chat_messages: updatedHistoryWithUser, 
          versions: updatedVersions, 
          image_url: imageUrl 
        });
        
        activeProjectId = createRes.data.id;
        setProjectId(activeProjectId);
        if (createRes.data.title) {
          setProjectTitle(createRes.data.title);
          setLastSavedTitle(createRes.data.title);
        }
        setVersions(updatedVersions);
        
        // Update URL invisibly so refresh retains project
        navigate('/editor', { state: { projectId: activeProjectId }, replace: true });
      }

      const requestCode = getFilesJson();
      const res = await codeAPI.chat({ code: requestCode, message: userMsg, framework, project_id: activeProjectId, chat_history: chatHistory.slice(-6) });
      
      // Check if AI actually changed the code
      const rawFiles = parseCodeToFiles(res.data.code);
      const newFiles = sanitizeFiles(rawFiles, framework);
      const newCode = JSON.stringify(newFiles);
      const aiModifiedCode = newCode !== requestCode;

      if (aiModifiedCode) {
        pushToHistory(newFiles);
        setActiveFileIndex(0);
      }

      const updatedHistoryWithAssistant = [...updatedHistoryWithUser, { role: 'assistant', content: res.data.message }];
      setChatHistory(updatedHistoryWithAssistant);

      // Auto-save chat + auto-create AI version if code changed
      if (activeProjectId) {
        try {
          let updatedVersions = versions;
          
          if (aiModifiedCode) {
            const lastVersion = versions.length > 0 ? versions[versions.length - 1] : null;
            const wasAlreadySaved = lastVersion && lastVersion.code === newCode;
            
            if (!wasAlreadySaved) {
              const aiVersion = { version: versions.length + 1, code: newCode, saved_at: new Date().toISOString(), label: 'AI Update' };
              updatedVersions = [...versions, aiVersion];
              setVersions(updatedVersions);
              toast.success("AI modified the code - New version added to history");
            }
          }

          await projectAPI.update(activeProjectId, {
            updated_code: aiModifiedCode ? newCode : undefined, // Only update code in DB if AI changed it (or rely on frontend state)
            chat_messages: updatedHistoryWithAssistant,
            versions: updatedVersions
          });
        } catch (e) {
          console.error('Failed to auto-save chat/version:', e);
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed'); setChatHistory(prev => prev.slice(0, -1));
    } finally { setChatLoading(false); }
  };

  const getDeviceWidth = () => ({ mobile: '375px', tablet: '768px' }[deviceMode] || '100%');
  const scrollToChat = () => document.getElementById('ai-assistant-section')?.scrollIntoView({ behavior: 'smooth' });

  const editorOptions = { minimap: { enabled: false }, fontSize: 14, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true };

  const FileTabs = () => (
    <div className="flex items-center bg-zinc-800 border-b border-purple-500/20 overflow-x-auto">
      {files.map((file, index) => (
        <button key={file.filename} onClick={() => setActiveFileIndex(index)}
          className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-r border-zinc-700 transition-all ${index === activeFileIndex ? 'bg-zinc-900 text-white border-b-2 border-b-purple-500' : 'text-white/50 hover:text-white/80 hover:bg-zinc-800/50'}`}
          data-testid={`file-tab-${file.filename}`}>{file.filename}</button>
      ))}
    </div>
  );

  return (
    <Layout>
      <div className="flex flex-col px-6">
        {/* Top Bar */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-purple-500/20 px-6 py-3 flex items-center justify-between mb-3 relative z-50">
          <div className="flex items-center gap-3">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={projectTitle} 
                  onChange={e => setProjectTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleTitleUpdate();
                    } else if (e.key === 'Escape') {
                      setProjectTitle(lastSavedTitle);
                      setEditingTitle(false);
                    }
                  }}
                  onBlur={handleTitleUpdate}
                  className="px-3 py-1 bg-black/50 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                  autoFocus 
                  data-testid="project-title-input" 
                />
                <button onClick={handleTitleUpdate} className="p-1 text-purple-400" data-testid="save-title-btn"><Check className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-white font-medium" data-testid="project-title">{projectTitle}</h2>
                <button onClick={() => setEditingTitle(true)} className="p-1 text-white/40 hover:text-purple-400" data-testid="edit-title-btn"><Edit2 className="w-4 h-4" /></button>
              </div>
            )}
            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-md">{framework}</span>
            {/* Version History Button */}
            <div className="relative" ref={versionPanelRef}>
              <button type="button" onClick={() => setShowVersionPanel(p => !p)}
                className="px-3 py-1.5 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-1.5"
                data-testid="version-history-btn">
                <History className="w-4 h-4" />
                {activeVersionLabel ? <span className="text-purple-300 text-xs">{activeVersionLabel}</span> : 'Versions'}
                {versions.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-purple-500/30 text-purple-300 text-[10px] rounded-full font-medium">{versions.length}</span>}
              </button>
              <AnimatePresence>
                {showVersionPanel && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-purple-500/20 rounded-xl shadow-2xl shadow-black/50 z-[9999] overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-purple-500/10 flex items-center gap-2">
                      <History className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-medium text-white">Version History</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {versions.length === 0 ? (
                        <div className="px-4 py-6 text-center text-white/30 text-sm">No saved versions yet.<br />Save your project to create one.</div>
                      ) : (
                        [...versions].reverse().map((v) => (
                          <button key={v.version} type="button"
                            onClick={() => {
                              const restoredFiles = parseCodeToFiles(v.code);
                              setFiles(restoredFiles);
                              setHistory([restoredFiles]);
                              setHistoryIndex(0);
                              setActiveFileIndex(0);
                              setActiveVersionLabel(`v${v.version}`);
                              setShowVersionPanel(false);
                              toast.success(`Restored to Version ${v.version}`);
                            }}
                            className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-all border-b border-zinc-800/50 last:border-b-0 ${activeVersionLabel === `v${v.version}` ? 'bg-purple-500/10 border-l-2 border-l-purple-500' : ''
                              }`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${activeVersionLabel === `v${v.version}` ? 'bg-purple-400' : 'bg-zinc-600'}`} />
                              <span className={`text-sm font-medium ${activeVersionLabel === `v${v.version}` ? 'text-purple-300' : 'text-white/80'}`}>Version {v.version}</span>
                              {v.label && <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] rounded-full">{v.label}</span>}
                            </div>
                            <div className="flex items-center gap-1 text-white/30 text-xs">
                              <Clock className="w-3 h-3" />
                              {new Date(v.saved_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={handleUndo} disabled={!canUndo}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-all disabled:opacity-30"
                    aria-label="Undo">
                    <Undo className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Undo</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={handleRedo} disabled={!canRedo}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-all disabled:opacity-30 mr-2"
                    aria-label="Redo">
                    <Redo className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Redo</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button type="button" onClick={handleCopy} className="px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-1.5" data-testid="copy-code-btn"><Copy className="w-4 h-4" /> Copy</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-1.5" data-testid="save-project-btn"><Save className="w-4 h-4" /> Save</button>
            <button onClick={handleExport} className="px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-1.5" data-testid="export-zip-btn"><Download className="w-4 h-4" /> Export</button>
            <button onClick={() => setShowPreview(!showPreview)} className="px-3 py-1.5 text-sm bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg transition-all flex items-center gap-1.5" data-testid="toggle-preview-btn">
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showPreview ? 'Hide' : 'Show'} Preview
            </button>
            <button onClick={scrollToChat} className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all flex items-center gap-1.5" data-testid="ai-assistant-btn"><MessageSquare className="w-4 h-4" /> AI Assistant</button>
          </div>
        </div>

        {/* Editor + Preview */}
        <div className="w-full h-[calc(100vh-160px)] min-h-[600px] border-b border-purple-500/20 bg-black">
          {showPreview ? (
            <PanelGroup direction="horizontal">
              <Panel defaultSize={50} minSize={30}>
                <div className="h-full flex flex-col" data-testid="code-editor">
                  <FileTabs />
                  <div className="flex-1">
                    <Editor height="100%" language={getEditorLanguage(activeFile.filename)} theme={theme === 'light' ? 'light' : 'vs-dark'}
                      value={activeFile.content} onMount={handleEditorDidMount}
                      onChange={v => updateActiveFileContent(v || '')} options={editorOptions} />
                  </div>
                </div>
              </Panel>
              <PanelResizeHandle className="w-1 bg-purple-500/20 hover:bg-purple-500/40 transition-colors" />
              <Panel defaultSize={50} minSize={30}>
                <div className="h-full bg-zinc-900 flex flex-col">
                  <div className="bg-zinc-800 border-b border-purple-500/20 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {[['mobile', Smartphone], ['tablet', Tablet], ['desktop', Monitor]].map(([m, Icon]) => (
                        <button key={m} onClick={() => setDeviceMode(m)} data-testid={`device-${m}`}
                          className={`p-2 rounded-lg transition-all ${deviceMode === m ? 'bg-purple-500/20 text-purple-300' : 'text-white/60 hover:text-white'}`}>
                          <Icon className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleRefresh} className="p-2 text-white/60 hover:text-white" data-testid="refresh-preview-btn"><RefreshCw className="w-4 h-4" /></button>
                      <button onClick={handleOpenInNewTab} className="p-2 text-white/60 hover:text-white" data-testid="open-new-tab-btn"><ExternalLink className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex-1 p-4 overflow-auto flex justify-center" data-testid="preview-pane">
                    <div style={{ width: getDeviceWidth(), maxWidth: '100%' }} className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300">
                      <iframe ref={iframeRef} key={previewKey} srcDoc={previewHtml} title="Preview"
                        className="w-full h-full min-h-[600px] border-0"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" />
                    </div>
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          ) : (
            <div className="h-full flex flex-col" data-testid="code-editor-full">
              <FileTabs />
              <div className="flex-1">
                <Editor height="100%" language={getEditorLanguage(activeFile.filename)} theme={theme === 'light' ? 'light' : 'vs-dark'}
                  value={activeFile.content} onMount={handleEditorDidMount}
                  onChange={v => updateActiveFileContent(v || '')} options={editorOptions} />
              </div>
            </div>
          )}
        </div>

        {/* AI Chat */}
        <div id="ai-assistant-section" className="w-full theme-bg-page py-12 theme-transition">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h3 className="text-2xl font-bold theme-text mb-2">AI Assistant</h3>
              <p className="theme-text-secondary">Ask AI to modify your code</p>
            </div>
            <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-xl theme-transition">
              <div ref={chatContainerRef} className="h-[400px] overflow-y-auto px-6 py-4 space-y-4">
                {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center theme-text-tertiary">
                    <MessageSquare className="w-12 h-12 mb-4 opacity-20" /><p>Ask AI to modify your code...</p>
                  </div>
                ) : chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl break-words ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-tr-sm shadow-lg shadow-purple-500/20' : 'theme-bg-input theme-text border theme-border rounded-tl-sm'}`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t theme-border theme-bg-card">
                <div className="flex gap-2">
                  <textarea value={chatMessage} onChange={e => setChatMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!chatLoading && chatMessage.trim()) handleChat();
                      }
                    }}
                    placeholder="Describe changes you want to make..."
                    rows={1}
                    className="flex-1 px-4 py-3 theme-bg-input border theme-border rounded-xl theme-text placeholder:theme-text-tertiary focus:outline-none focus:border-purple-500/50 resize-none overflow-y-auto max-h-32 transition-all"
                    disabled={chatLoading} data-testid="chat-input" />
                  <button onClick={handleChat} disabled={chatLoading || !chatMessage.trim()}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 font-medium shadow-lg shadow-purple-500/20"
                    data-testid="chat-send-btn">
                    {chatLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout >
  );
};

export default EditorPage;