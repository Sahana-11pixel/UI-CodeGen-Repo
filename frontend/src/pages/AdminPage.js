import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, FolderKanban, Activity, ChevronRight } from 'lucide-react';

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { adminAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Layout from '../components/Layout';
import { toast } from 'sonner';

const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchStats();
  }, [user, navigate]);

  const fetchStats = async () => {
    try {
      const response = await adminAPI.getStats();
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
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

  if (!stats) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <p className="text-white/60">Failed to load statistics</p>
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
          <h1 className="text-4xl font-bold theme-text mb-4">Admin Dashboard</h1>
          <p className="text-lg theme-text-secondary">Platform statistics and user management</p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border theme-border rounded-2xl p-6 theme-shadow theme-transition"
            data-testid="stat-total-users"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-3xl font-bold theme-text">{stats.total_users}</span>
            </div>
            <p className="theme-text-secondary font-medium">Total Users</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 rounded-2xl p-6"
            data-testid="stat-total-projects"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-cyan-400" />
              </div>
              <span className="text-3xl font-bold theme-text">{stats.total_projects}</span>
            </div>
            <p className="theme-text-secondary font-medium">Total Projects</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-pink-500/20 to-pink-600/10 border border-pink-500/20 rounded-2xl p-6"
            data-testid="stat-api-calls"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-pink-400" />
              </div>
              <span className="text-3xl font-bold theme-text">{stats.total_api_calls}</span>
            </div>
            <p className="theme-text-secondary font-medium">API Calls</p>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid lg:grid-cols-2 gap-6 mb-12">
          {/* User Growth Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="theme-bg-card border theme-border rounded-2xl p-6 theme-shadow theme-transition"
          >
            <h3 className="text-lg font-bold theme-text mb-6">User Growth</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.users_growth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    stroke="#888"
                    tick={{ fill: '#888' }}
                  />
                  <YAxis
                    stroke="#888"
                    tick={{ fill: '#888' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                      border: theme === 'dark' ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid rgba(168, 85, 247, 0.1)',
                      borderRadius: '8px',
                      color: theme === 'dark' ? '#ffffff' : '#1a1a2e'
                    }}
                    itemStyle={{
                      color: theme === 'dark' ? '#ffffff' : '#1a1a2e'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={{ fill: '#a855f7' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Framework Stats Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="theme-bg-card border theme-border rounded-2xl p-6 theme-shadow theme-transition"
          >
            <h3 className="text-lg font-bold theme-text mb-6">Projects by Framework</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.framework_stats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="framework"
                    stroke="#888"
                    tick={{ fill: '#888' }}
                  />
                  <YAxis
                    stroke="#888"
                    tick={{ fill: '#888' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                      border: theme === 'dark' ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid rgba(168, 85, 247, 0.1)',
                      borderRadius: '8px',
                      color: theme === 'dark' ? '#ffffff' : '#1a1a2e'
                    }}
                    itemStyle={{
                      color: theme === 'dark' ? '#ffffff' : '#1a1a2e'
                    }}
                    cursor={{ fill: theme === 'dark' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.05)' }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#ec4899"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Recent Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="theme-bg-card border theme-border rounded-2xl overflow-hidden theme-shadow theme-transition"
        >
          <div className="p-6 border-b theme-border flex items-center justify-between">
            <h2 className="text-xl font-bold theme-text">Recent Users</h2>
            <button
              onClick={() => navigate('/admin/users')}
              className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2 group"
            >
              View All
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="theme-bg-secondary">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium theme-text-secondary">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-medium theme-text-secondary">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-medium theme-text-secondary">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-medium theme-text-secondary">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/10">
                {stats.recent_users.map((user) => (
                  <tr key={user.id} className="theme-bg-hover transition-colors">
                    <td className="px-6 py-4 text-sm theme-text">{user.name}</td>
                    <td className="px-6 py-4 text-sm theme-text-secondary">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-md ${user.role === 'admin'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-purple-500/20 text-purple-300'
                        }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm theme-text-secondary">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Recent Projects Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="theme-bg-card border theme-border rounded-2xl overflow-hidden mt-8 theme-shadow theme-transition"
        >
          <div className="p-6 border-b theme-border flex items-center justify-between">
            <h2 className="text-xl font-bold theme-text">Recent Projects</h2>
            <button
              onClick={() => navigate('/admin/projects')}
              className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2 group"
            >
              View All
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="theme-bg-secondary">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium theme-text-secondary">Project Name</th>
                  <th className="px-6 py-4 text-left text-sm font-medium theme-text-secondary">Owner Email</th>
                  <th className="px-6 py-4 text-left text-sm font-medium theme-text-secondary">Framework</th>
                  <th className="px-6 py-4 text-left text-sm font-medium theme-text-secondary">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/10">
                {stats.recent_projects?.map((project) => (
                  <tr key={project.id} className="theme-bg-hover transition-colors">
                    <td className="px-6 py-4 text-sm theme-text">{project.title}</td>
                    <td className="px-6 py-4 text-sm theme-text-secondary">{project.owner_email}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-300 rounded-md">
                        {project.framework}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm theme-text-secondary">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(!stats.recent_projects || stats.recent_projects.length === 0) && (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center theme-text-tertiary">
                      No projects found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default AdminPage;