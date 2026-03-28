import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit2, Calendar } from 'lucide-react';
import { projectAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { toast } from 'sonner';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchProjects();
  }, [user, navigate]);

  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getAll();
      setProjects(response.data);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async (projectId) => {
    try {
      const response = await projectAPI.getOne(projectId);
      navigate('/editor', {
        state: {
          code: response.data.updated_code || response.data.generated_code,
          framework: response.data.framework,
          projectId: response.data.id,
          title: response.data.title,
          chat_messages: response.data.chat_messages,
          versions: response.data.versions || []
        }
      });
    } catch (error) {
      toast.error('Failed to open project');
    }
  };

  const handleDelete = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      await projectAPI.delete(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success('Project deleted');
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-bold theme-text mb-4">My Projects</h1>
          <p className="text-lg theme-text-secondary">Manage your saved UI projects</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Create New Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            className="aspect-video bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-2 border-dashed border-purple-500/30 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 transition-all group"
            onClick={() => navigate('/upload')}
            data-testid="create-new-project-btn"
          >
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
              <Plus className="w-8 h-8 text-purple-400" />
            </div>
            <p className="theme-text font-medium">Create New Project</p>
            <p className="text-sm theme-text-secondary">Upload a screenshot to start</p>
          </motion.div>

          {/* Project Cards */}
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="theme-bg-card border theme-border rounded-2xl overflow-hidden hover:border-purple-500/40 transition-all group theme-shadow theme-transition"
              data-testid={`project-card-${project.id}`}
            >
              <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-purple-500/5 to-purple-600/10 flex flex-col items-center justify-center border-b border-white/5">
                {project.image_url ? (
                  <>
                    <img 
                      src={project.image_url} 
                      alt={project.title} 
                      className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                    <div className="absolute top-3 right-3 z-10">
                      <span className="text-xs px-2.5 py-1 bg-black/60 backdrop-blur-md text-white rounded border border-white/10 shadow-sm font-medium tracking-wide shadow-black/50">
                        {project.framework}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center z-10 p-4">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl mx-auto mb-2 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                      <Edit2 className="w-6 h-6 text-purple-400" />
                    </div>
                    <span className="text-xs px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full">
                      {project.framework}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="theme-text font-medium mb-2 truncate" data-testid="project-title">{project.title}</h3>
                <div className="flex items-center gap-2 text-xs theme-text-tertiary mb-4">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(project.updated_at)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpen(project.id)}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-all"
                    data-testid="open-project-btn"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                    data-testid="delete-project-btn"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-20">
            <p className="theme-text-tertiary text-lg">No projects yet. Create your first one!</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DashboardPage;