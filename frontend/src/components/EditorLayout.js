// src/components/EditorLayout.jsx
import React from 'react';
import Navbar from './Navbar';

const EditorLayout = ({ children }) => {
  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Global Navbar */}
      <Navbar />

      {/* Everything below navbar */}
      <div className="pt-20 flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
};

export default EditorLayout;
