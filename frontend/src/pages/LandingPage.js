import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Code2, Palette, Download, MessageSquare } from 'lucide-react';
import Layout from '../components/Layout';
import {
  FaReact,
  FaVuejs,
  FaBootstrap,
  FaHtml5
} from 'react-icons/fa';

import { SiTailwindcss, SiSvelte, SiNextdotjs, SiNuxtdotjs } from 'react-icons/si';


const LandingPage = () => {
  const navigate = useNavigate();

  const frameworks = [
    {
      name: 'HTML/CSS',
      icon: <FaHtml5 className="text-orange-500 text-3xl" />
    },
    {
      name: 'React',
      icon: <FaReact className="text-[#61DAFB] text-3xl" />
    },
    {
      name: 'Bootstrap',
      icon: <FaBootstrap className="text-[#7952B3] text-3xl" />
    },
    {
      name: 'Tailwind',
      icon: <SiTailwindcss className="text-[#06B6D4] text-3xl" />
    },
    {
      name: 'Vue',
      icon: <FaVuejs className="text-[#42B883] text-3xl" />
    },
    {
      name: 'Svelte',
      icon: <SiSvelte className="text-[#FF3E00] text-3xl" />
    },
    {
      name: 'Next.js',
      icon: <SiNextdotjs className="theme-text text-3xl" />
    },
    {
      name: 'Nuxt.js',
      icon: <SiNuxtdotjs className="text-[#00DC82] text-3xl" />
    },
  ];

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Instant Generation',
      description: 'Upload screenshot, get code in seconds'
    },
    {
      icon: <Code2 className="w-6 h-6" />,
      title: 'Multiple Frameworks',
      description: 'React, Vue, Svelte, Tailwind & more'
    },
    {
      icon: <Palette className="w-6 h-6" />,
      title: 'Live Preview',
      description: 'See changes in real-time as you edit'
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: 'AI Assistant',
      description: 'Modify code with natural language'
    },
    {
      icon: <Download className="w-6 h-6" />,
      title: 'Export & Save',
      description: 'Download as ZIP or save to dashboard'
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: 'Production Ready',
      description: 'Clean, optimized, ready-to-use code'
    },
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative px-6 py-20 md:py-32 overflow-hidden">
        {/* Gradient Orbs */}
        <div className="absolute top-20 left-10 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: 'var(--gradient-orb-1)' }}></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: 'var(--gradient-orb-2)' }}></div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border theme-border rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400">AI-Powered Code Generation</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold theme-text mb-6 leading-tight">
              Turn UI Screenshots
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">Into Frontend Code</span>
            </h1>

            <p className="text-lg sm:text-xl theme-text-secondary mb-10 max-w-2xl mx-auto">
              Upload any design screenshot and instantly generate clean, production-ready code in your favorite framework - Ready to edit and export.
            </p>

            <button
              onClick={() => navigate('/signup')}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white text-lg font-medium rounded-xl transition-all hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-105"
              data-testid="get-started-btn"
            >
              Get Started Free
            </button>
          </motion.div>
        </div>
      </section>

      {/* Frameworks Section */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold theme-text text-center mb-12">Supported Frameworks</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {frameworks.map((framework, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="p-6 theme-bg-card border theme-border rounded-2xl text-center 
                hover:border-purple-500/40 
                hover:shadow-xl hover:shadow-purple-500/10 
                hover:scale-105 
                transition-all duration-300 
                group theme-shadow theme-transition"
              >
                <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center theme-bg-secondary rounded-xl group-hover:bg-purple-500/10 transition-all">
                  {framework.icon}
                </div>
                <p className="text-sm theme-text font-medium">{framework.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold theme-text text-center mb-12">Why Choose UI-CodeGen?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-6 theme-bg-card border theme-border rounded-2xl hover:border-purple-500/40 transition-all group theme-shadow theme-transition"
              >
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                  <div className="text-purple-400">{feature.icon}</div>
                </div>
                <h3 className="text-lg font-semibold theme-text mb-2">{feature.title}</h3>
                <p className="text-sm theme-text-secondary">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-purple-500/10 to-purple-600/5 border theme-border rounded-3xl p-12">
          <h2 className="text-3xl font-bold theme-text mb-4">Ready to Transform Your Workflow?</h2>
          <p className="text-lg theme-text-secondary mb-8">Start Converting Screenshots Into Frontend Code Today</p>
          <button
            onClick={() => navigate('/signup')}
            className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white text-lg font-medium rounded-xl transition-all hover:shadow-2xl hover:shadow-purple-500/40"
          >
            Start Building Now
          </button>
        </div>
      </section>
    </Layout>
  );
};

export default LandingPage;