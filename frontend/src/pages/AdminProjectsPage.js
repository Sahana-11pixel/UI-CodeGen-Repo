import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FolderKanban, Search, ChevronLeft, ChevronRight, Filter,
    ArrowUpDown, Trash2, Eye, X, Calendar, Mail, User,
    Clock, Database, Layout as LayoutIcon, Code2, ShieldAlert
} from 'lucide-react';
import { adminAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { toast } from 'sonner';

const AdminProjectsPage = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');
    const [frameworkFilter, setFrameworkFilter] = useState('');
    const [fetchError, setFetchError] = useState(null);
    const [deleteConfirmProject, setDeleteConfirmProject] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const frameworks = [
        { id: '', name: 'All Frameworks' },
        { id: 'html_css', name: 'HTML/CSS' },
        { id: 'react', name: 'React' },
        { id: 'bootstrap', name: 'Bootstrap' },
        { id: 'tailwind', name: 'Tailwind' },
        { id: 'vue', name: 'Vue' },
        { id: 'svelte', name: 'Svelte' },
        { id: 'vanilla_js', name: 'Vanilla JS' },
        { id: 'next_js', name: 'Next.js' },
        { id: 'nuxt_js', name: 'Nuxt.js' }
    ];

    useEffect(() => {
        if (!currentUser) {
            navigate('/login');
            return;
        }
        if (currentUser.role !== 'admin') {
            toast.error('Admin access required');
            navigate('/dashboard');
        }
    }, [currentUser, navigate]);

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const params = {
                page,
                limit,
                search: search || undefined,
                sortBy: sortBy,
                order: sortOrder,
                framework: frameworkFilter || undefined
            };
            const response = await adminAPI.getAdminProjects(params);
            setProjects(response.data.projects);
            setTotalCount(response.data.total_count);
        } catch (error) {
            console.error('Fetch projects error:', error);
            setFetchError('Failed to load project list. Please try again.');
            toast.error('Failed to load projects');
            setProjects([]);
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, sortBy, sortOrder, frameworkFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProjects();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchProjects]);

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
        setPage(1);
    };

    const handleViewDetails = async (projectId) => {
        setIsModalOpen(true);
        setLoading(true);
        try {
            const response = await adminAPI.getAdminProjectDetails(projectId);
            setSelectedProject(response.data);
        } catch (error) {
            console.error('Fetch project details error:', error);
            toast.error('Failed to load project details');
            setIsModalOpen(false);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirmProject) return;

        setIsDeleting(true);
        try {
            await adminAPI.deleteAdminProject(deleteConfirmProject.id);
            toast.success('Project and associated chats deleted');
            fetchProjects();
            setDeleteConfirmProject(null);
        } catch (error) {
            console.error('Delete project error:', error);
            const errorMsg = error.response?.data?.detail || 'Failed to delete project';
            toast.error(errorMsg);
        } finally {
            setIsDeleting(false);
        }
    };

    const totalPages = Math.ceil(totalCount / limit);

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <button
                                onClick={() => navigate('/admin')}
                                className="p-2 theme-bg-hover rounded-lg transition-colors theme-text-secondary hover:text-purple-400"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-4xl font-bold theme-text flex items-center gap-3">
                                <FolderKanban className="w-10 h-10 text-purple-400" />
                                All Projects
                            </h1>
                        </div>
                        <p className="theme-text-secondary ml-12">Manage all generated projects and their metadata</p>
                    </motion.div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Search */}
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-purple-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search project or owner..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="pl-10 pr-4 py-2 theme-bg-card border theme-border rounded-xl text-sm theme-text focus:outline-none focus:border-purple-500/50 transition-all w-64"
                            />
                        </div>

                        {/* Framework Filter */}
                        <div className="relative group">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-purple-400 transition-colors" />
                            <select
                                value={frameworkFilter}
                                onChange={(e) => { setFrameworkFilter(e.target.value); setPage(1); }}
                                className="pl-10 pr-4 py-2 theme-bg-card border theme-border rounded-xl text-sm theme-text focus:outline-none focus:border-purple-500/50 transition-all appearance-none cursor-pointer min-w-[180px]"
                            >
                                {frameworks.map(f => (
                                    <option key={f.id} value={f.id} className="bg-zinc-900">{f.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Main Table Container */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="theme-bg-card border theme-border rounded-2xl overflow-hidden backdrop-blur-sm theme-shadow theme-transition"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="theme-bg-secondary border-b theme-border">
                                <tr>
                                    <th
                                        className="px-6 py-4 text-sm font-semibold theme-text cursor-pointer hover:text-purple-400 transition-colors"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Project Name
                                            <div className="flex flex-col -gap-1">
                                                <ChevronLeft className={`w-3 h-3 rotate-90 transition-colors ${sortBy === 'name' && sortOrder === 'asc' ? 'text-purple-400' : 'text-white/20'}`} />
                                                <ChevronLeft className={`w-3 h-3 -rotate-90 transition-colors ${sortBy === 'name' && sortOrder === 'desc' ? 'text-purple-400' : 'text-white/20'}`} />
                                            </div>
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-sm font-semibold theme-text cursor-pointer hover:text-purple-400 transition-colors"
                                        onClick={() => handleSort('ownerEmail')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Owner Email
                                            <div className="flex flex-col -gap-1">
                                                <ChevronLeft className={`w-3 h-3 rotate-90 transition-colors ${sortBy === 'ownerEmail' && sortOrder === 'asc' ? 'text-purple-400' : 'text-white/20'}`} />
                                                <ChevronLeft className={`w-3 h-3 -rotate-90 transition-colors ${sortBy === 'ownerEmail' && sortOrder === 'desc' ? 'text-purple-400' : 'text-white/20'}`} />
                                            </div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-sm font-semibold theme-text">Framework</th>
                                    <th
                                        className="px-6 py-4 text-sm font-semibold theme-text cursor-pointer hover:text-purple-400 transition-colors"
                                        onClick={() => handleSort('createdAt')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Created Date
                                            <div className="flex flex-col -gap-1">
                                                <ChevronLeft className={`w-3 h-3 rotate-90 transition-colors ${sortBy === 'createdAt' && sortOrder === 'asc' ? 'text-purple-400' : 'text-white/20'}`} />
                                                <ChevronLeft className={`w-3 h-3 -rotate-90 transition-colors ${sortBy === 'createdAt' && sortOrder === 'desc' ? 'text-purple-400' : 'text-white/20'}`} />
                                            </div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-sm font-semibold theme-text text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-purple-500/10">
                                {loading && projects.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                                                <p className="text-white/40 font-medium">Loading projects...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : fetchError ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <ShieldAlert className="w-8 h-8 text-rose-500/50" />
                                                <p className="text-rose-400 font-medium">{fetchError}</p>
                                                <button
                                                    onClick={fetchProjects}
                                                    className="mt-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    Retry
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : projects.length > 0 ? (
                                    projects.map((p) => (
                                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:border-purple-500/40 transition-colors">
                                                        <Code2 className="w-4 h-4 text-purple-400" />
                                                    </div>
                                                    <span className="theme-text font-medium truncate max-w-[150px]" title={p.title}>{p.title}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 theme-text-secondary">
                                                    <Mail className="w-3.5 h-3.5 opacity-40" />
                                                    <span className="text-sm truncate max-w-[200px]" title={p.owner_email}>{p.owner_email}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg ${p.framework === 'react' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                                    p.framework === 'nextjs' ? 'bg-white/10 text-white border border-white/20' :
                                                        'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                    }`}>
                                                    {p.framework}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 theme-text-tertiary text-sm">
                                                {new Date(p.created_at).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleViewDetails(p.id)}
                                                        title="View Project Details"
                                                        className="p-2 hover:bg-purple-500/10 rounded-lg transition-colors theme-icon hover:text-purple-400"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirmProject(p)}
                                                        title="Delete Project"
                                                        className="p-2 hover:bg-rose-500/10 rounded-lg transition-colors theme-icon hover:text-rose-400"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-white/40">
                                            No projects found matching your criteria
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 theme-bg-secondary border-t theme-border flex items-center justify-between">
                            <p className="text-sm theme-text-tertiary">
                                Showing <span className="theme-text font-medium">{(page - 1) * limit + 1}</span> to <span className="theme-text font-medium">{Math.min(page * limit, totalCount)}</span> of <span className="theme-text font-medium">{totalCount}</span> projects
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 bg-zinc-800 border border-white/5 rounded-lg text-white disabled:opacity-30 hover:bg-zinc-700 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <div className="flex items-center gap-1">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            onClick={() => setPage(i + 1)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === i + 1
                                                ? 'bg-purple-600 text-white'
                                                : 'text-white/40 hover:bg-white/5'
                                                }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 bg-zinc-800 border border-white/5 rounded-lg text-white disabled:opacity-30 hover:bg-zinc-700 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Project Details Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-2xl theme-bg-card-solid border theme-border rounded-[32px] overflow-hidden shadow-2xl theme-transition"
                        >
                            <div className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                            <FolderKanban className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold theme-text">Project Details</h3>
                                            <p className="theme-text-tertiary text-sm">Full metadata and ownership info</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="p-2 theme-bg-hover rounded-xl theme-icon hover:text-purple-400 transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                {selectedProject ? (
                                    <div className="space-y-6">
                                        <div className="theme-bg-input border theme-border rounded-2xl p-6 space-y-6">
                                            <div className="grid grid-cols-2 gap-8">
                                                <div>
                                                    <label className="text-[10px] font-bold theme-text-tertiary uppercase tracking-widest block mb-1">Title</label>
                                                    <p className="theme-text font-semibold">{selectedProject.title}</p>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold theme-text-tertiary uppercase tracking-widest block mb-1">Framework</label>
                                                    <p className="text-cyan-400 font-bold uppercase">{selectedProject.framework}</p>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold theme-text-tertiary uppercase tracking-widest block mb-1">Created At</label>
                                                    <p className="theme-text-secondary">{new Date(selectedProject.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold theme-text-tertiary uppercase tracking-widest block mb-1">Last Updated</label>
                                                    <p className="theme-text-secondary">{selectedProject.updated_at ? new Date(selectedProject.updated_at).toLocaleDateString() : 'Never'}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-bold theme-text-tertiary uppercase tracking-widest block mb-1">Project ID</label>
                                                    <p className="theme-text-tertiary font-mono text-xs">{selectedProject.id}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-6">
                                            <label className="text-[10px] font-bold text-purple-400/40 uppercase tracking-widest block mb-4">Owner Information</label>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xl">
                                                    {selectedProject.owner_name[0]}
                                                </div>
                                                <div>
                                                    <p className="theme-text font-bold">{selectedProject.owner_name}</p>
                                                    <p className="theme-text-tertiary text-sm">{selectedProject.owner_email}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-20 flex flex-col items-center gap-4">
                                        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                                        <p className="text-white/40 italic">Retrieving metadata...</p>
                                    </div>
                                )}
                            </div>
                            <div className="px-8 py-6 theme-bg-secondary border-t theme-border flex justify-end">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl border border-white/5 transition-all"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            {deleteConfirmProject && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        onClick={() => !isDeleting && setDeleteConfirmProject(null)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative w-full max-w-lg theme-bg-card-solid border border-rose-500/20 rounded-3xl overflow-hidden shadow-2xl shadow-rose-500/10 theme-transition"
                    >
                        <div className="p-8">
                            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 mb-6 mx-auto">
                                <Trash2 className="w-8 h-8 text-rose-500" />
                            </div>

                            <h3 className="text-2xl font-bold theme-text text-center mb-2">Delete Project?</h3>
                            <p className="theme-text-tertiary text-center mb-8">
                                This will permanently delete
                                <span className="theme-text font-semibold mx-1">{deleteConfirmProject.title}</span>
                                and all its associated chats. This action cannot be undone.
                            </p>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setDeleteConfirmProject(null)}
                                    disabled={isDeleting}
                                    className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl transition-all border border-white/10 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    className="flex-1 px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isDeleting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            Deleting...
                                        </>
                                    ) : (
                                        'Confirm Delete'
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </Layout>
    );
};

export default AdminProjectsPage;
