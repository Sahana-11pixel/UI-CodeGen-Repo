import React from 'react';
import { Code2 } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t theme-border theme-bg-navbar backdrop-blur-xl mt-auto theme-transition">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-purple-400" />
            <span className="text-sm theme-text-secondary">UI-CodeGen - Screenshot to Code</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm theme-text-secondary hover:text-purple-400 transition-colors"></a>
            <a href="#" className="text-sm theme-text-secondary hover:text-purple-400 transition-colors"></a>
            <a href="#" className="text-sm theme-text-secondary hover:text-purple-400 transition-colors"></a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;