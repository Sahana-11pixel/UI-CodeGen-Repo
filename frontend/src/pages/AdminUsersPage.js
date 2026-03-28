import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Search, ChevronLeft, ChevronRight, Filter, ArrowUpDown, Trash2, ShieldAlert, Eye, X, Calendar, Mail, User, Clock, CheckCircle2, History, Database } from 'lucide-react';
import { adminAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { toast } from 'sonner';

const AdminUsersPage = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [roleFilter, setRoleFilter] = useState('');
    const [fetchError, setFetchError] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [reactivateConfirmUser, setReactivateConfirmUser] = useState(null);
    const [isReactivating, setIsReactivating] = useState(false);

    useEffect(() => {
        if (!currentUser) {
            navigate('/login');
            return;
        }
        if (currentUser.role !== 'admin') {
            toast.error('Admin access required');
            navigate('/dashboard');
            return;
        }
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser, navigate, page, search, sortBy, sortOrder, roleFilter]);

    const getTimeAgo = (dateString) => {
        if (!dateString) return 'Never';
        try {
            const now = new Date();
            const past = new Date(dateString);
            if (isNaN(past.getTime())) return 'Never';

            const diffMs = now - past;
            const diffSec = Math.floor(diffMs / 1000);
            if (diffSec < 0) return 'Just now';

            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            if (diffSec < 60) return 'Just now';
            if (diffMin < 60) return `${diffMin}m ago`;
            if (diffHour < 24) return `${diffHour}h ago`;
            if (diffDay === 1) return 'Yesterday';
            if (diffDay < 7) return `${diffDay}d ago`;
            return past.toLocaleDateString();
        } catch (e) {
            return 'Never';
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const params = {
                page,
                limit,
                search: search || undefined,
                sortBy: sortBy,
                order: sortOrder,
                role: roleFilter || undefined
            };
            const response = await adminAPI.getUsers(params);
            setUsers(response.data.users);
            setTotalCount(response.data.total_count);
        } catch (error) {
            console.error('Fetch users error:', error);
            setFetchError('Failed to load user list. Please try again.');
            toast.error('Failed to load users');
            setUsers([]); // Clear stale data on error
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setPage(1); // Reset to first page on search
    };

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const handleViewDetails = async (userId) => {
        setDetailsLoading(true);
        setIsModalOpen(true);
        setSelectedUser(null); // Reset previous data
        try {
            const response = await adminAPI.getUserDetails(userId);
            setSelectedUser(response.data);
        } catch (error) {
            console.error('Fetch user details error:', error);
            const errorMsg = error.response?.data?.detail || 'Failed to load user details';
            toast.error(errorMsg);
            setIsModalOpen(false);
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirmUser) return;

        setIsDeleting(true);
        try {
            await adminAPI.deleteUser(deleteConfirmUser.id);
            toast.success('User and all associated data deleted');
            fetchUsers(); // Refresh table
            setDeleteConfirmUser(null);
        } catch (error) {
            console.error('Delete user error:', error);
            const errorMsg = error.response?.data?.detail || 'Failed to delete user';
            toast.error(errorMsg);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReactivate = async () => {
        if (!reactivateConfirmUser) return;
        setIsReactivating(true);
        try {
            await adminAPI.reactivateUser(reactivateConfirmUser.id);
            toast.success(`${reactivateConfirmUser.name}'s account has been reactivated`);
            setReactivateConfirmUser(null);
            // Refresh user list in table
            fetchUsers();
            // If the view card is open for this user, update its state to reflect active status
            if (selectedUser && selectedUser.id === reactivateConfirmUser.id) {
                setSelectedUser(prev => ({ ...prev, is_deleted: false }));
            }
        } catch (error) {
            console.error('Reactivate user error:', error);
            const errorMsg = error.response?.data?.detail || 'Failed to reactivate account';
            toast.error(errorMsg);
        } finally {
            setIsReactivating(false);
        }
    };

    const totalPages = Math.ceil(totalCount / limit);

    return (
        <Layout>
            <div className="max-w-7xl mx-auto px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
                >
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <button
                                onClick={() => navigate('/admin')}
                                className="p-2 theme-bg-hover rounded-lg transition-colors theme-text-secondary hover:text-purple-400"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-4xl font-bold theme-text">All Users</h1>
                        </div>
                        <p className="text-lg theme-text-secondary ml-12">Manage and monitor all platform members</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-icon" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={search}
                                onChange={handleSearchChange}
                                className="w-full sm:w-64 theme-bg-card-solid border theme-border rounded-xl py-2.5 pl-10 pr-4 theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-icon" />
                            <select
                                value={roleFilter}
                                onChange={(e) => {
                                    setRoleFilter(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full sm:w-40 appearance-none theme-bg-card-solid border theme-border rounded-xl py-2.5 pl-10 pr-8 theme-text focus:outline-none focus:border-purple-500/50 transition-colors cursor-pointer"
                            >
                                <option value="">All Roles</option>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    </div>
                </motion.div>

                {/* Users Table */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-xl theme-shadow theme-transition"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="theme-bg-secondary border-b theme-border">
                                <tr>
                                    <th
                                        className="px-6 py-4 text-sm font-semibold theme-text cursor-pointer hover:text-purple-400 transition-colors"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Name
                                            <div className="flex flex-col -gap-1">
                                                <ChevronLeft className={`w-3 h-3 rotate-90 transition-colors ${sortBy === 'name' && sortOrder === 'asc' ? 'text-purple-400' : 'text-white/20'}`} />
                                                <ChevronLeft className={`w-3 h-3 -rotate-90 transition-colors ${sortBy === 'name' && sortOrder === 'desc' ? 'text-purple-400' : 'text-white/20'}`} />
                                            </div>
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-sm font-semibold theme-text cursor-pointer hover:text-purple-400 transition-colors"
                                        onClick={() => handleSort('email')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Email
                                            <div className="flex flex-col -gap-1">
                                                <ChevronLeft className={`w-3 h-3 rotate-90 transition-colors ${sortBy === 'email' && sortOrder === 'asc' ? 'text-purple-400' : 'text-white/20'}`} />
                                                <ChevronLeft className={`w-3 h-3 -rotate-90 transition-colors ${sortBy === 'email' && sortOrder === 'desc' ? 'text-purple-400' : 'text-white/20'}`} />
                                            </div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-sm font-semibold theme-text">Role</th>
                                    <th
                                        className="px-6 py-4 text-sm font-semibold theme-text cursor-pointer hover:text-purple-400 transition-colors"
                                        onClick={() => handleSort('created_at')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Joined
                                            <div className="flex flex-col -gap-1">
                                                <ChevronLeft className={`w-3 h-3 rotate-90 transition-colors ${sortBy === 'created_at' && sortOrder === 'asc' ? 'text-purple-400' : 'text-white/20'}`} />
                                                <ChevronLeft className={`w-3 h-3 -rotate-90 transition-colors ${sortBy === 'created_at' && sortOrder === 'desc' ? 'text-purple-400' : 'text-white/20'}`} />
                                            </div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-sm font-semibold theme-text text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-purple-500/10 theme-text-secondary">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <div className="w-5 h-5 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                                                <span className="text-white/40 font-medium">Loading users...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : fetchError ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <ShieldAlert className="w-8 h-8 text-rose-500/50" />
                                                <p className="text-rose-400 font-medium">{fetchError}</p>
                                                <button
                                                    onClick={fetchUsers}
                                                    className="mt-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    Retry
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : users.length > 0 ? (
                                    users.map((u) => (
                                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium theme-text truncate max-w-[150px]" title={u.name}>
                                                    {u.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="theme-text-secondary truncate max-w-[200px]" title={u.email}>
                                                    {u.email}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md ${u.role === 'admin'
                                                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                        }`}>
                                                        {u.role}
                                                    </span>
                                                    {u.is_deleted && (
                                                        <span className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md bg-zinc-700/50 text-zinc-400 border border-zinc-600/30">
                                                            Deactivated
                                                        </span>
                                                    )}
                                                    {!u.is_deleted && (
                                                        <span className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 theme-text-tertiary text-sm">
                                                {new Date(u.created_at).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleViewDetails(u.id)}
                                                        title="View Details"
                                                        className="p-2 hover:bg-purple-500/10 rounded-lg transition-colors theme-icon hover:text-purple-400"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirmUser(u)}
                                                        title="Delete User"
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
                                        <td colSpan="6" className="px-6 py-12 text-center text-white/40 italic">
                                            No users found matching your criteria
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 theme-bg-secondary border-t theme-border flex items-center justify-between gap-4">
                            <p className="text-sm theme-text-tertiary">
                                Showing <span className="theme-text">{(page - 1) * limit + 1}</span> to <span className="theme-text">{Math.min(page * limit, totalCount)}</span> of <span className="theme-text">{totalCount}</span> users
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                                    disabled={page === 1}
                                    className="p-2 bg-zinc-800 border border-purple-500/20 rounded-lg text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        onClick={() => setPage(i + 1)}
                                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${page === i + 1
                                            ? 'bg-purple-600 text-white border border-purple-400/50 shadow-[0_0_12px_rgba(147,51,234,0.3)]'
                                            : 'bg-zinc-800 border border-purple-500/10 text-white/40 hover:text-white hover:border-purple-500/40'
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={page === totalPages}
                                    className="p-2 bg-zinc-800 border border-purple-500/20 rounded-lg text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* User Details Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setIsModalOpen(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative w-full max-w-2xl theme-bg-card-solid border theme-border rounded-3xl overflow-hidden shadow-2xl theme-transition"
                    >
                        {/* Modal Header */}
                        <div className="relative px-8 py-6 border-b theme-border theme-bg-secondary">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                        <User className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold theme-text">User Details</h2>
                                        <p className="theme-text-tertiary text-sm">Comprehensive profile overview</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 theme-bg-hover rounded-xl transition-colors theme-icon hover:text-purple-400"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-8">
                            {detailsLoading ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-4">
                                    <div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                                    <p className="text-white/40 font-medium">Fetching member details...</p>
                                </div>
                            ) : selectedUser ? (
                                <div className="space-y-8">
                                    {/* Top Section: Basic Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider font-bold theme-text-tertiary ml-1">Full Name</label>
                                            <div className="theme-bg-input border theme-border rounded-2xl px-4 py-3 theme-text font-medium break-words">
                                                {selectedUser.name}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase tracking-wider font-bold theme-text-tertiary ml-1">Email Address</label>
                                            <div className="theme-bg-input border theme-border rounded-2xl px-4 py-3 theme-text font-medium flex items-center gap-2 break-all overflow-hidden">
                                                <Mail className="w-4 h-4 theme-icon shrink-0" />
                                                <span className="truncate" title={selectedUser.email}>{selectedUser.email}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-4 flex flex-col items-center gap-2">
                                            <Database className="w-5 h-5 text-purple-400" />
                                            <span className="text-2xl font-bold theme-text">{selectedUser.total_projects || 0}</span>
                                            <span className="text-[10px] uppercase tracking-wider font-bold theme-text-tertiary">Projects</span>
                                        </div>
                                        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 flex flex-col items-center gap-2">
                                            <History className="w-5 h-5 text-indigo-400" />
                                            <span className="text-2xl font-bold theme-text">{selectedUser.total_api_calls}</span>
                                            <span className="text-[10px] uppercase tracking-wider font-bold theme-text-tertiary">API Calls</span>
                                        </div>
                                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex flex-col items-center gap-2">
                                            <Calendar className="w-5 h-5 text-emerald-400" />
                                            <span className="text-sm font-bold text-white">
                                                {new Date(selectedUser.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider font-bold theme-text-tertiary">Joined</span>
                                        </div>
                                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex flex-col items-center gap-2">
                                            <Clock className="w-5 h-5 text-amber-400" />
                                            <span className="text-[10px] font-bold text-white text-center leading-tight">
                                                {getTimeAgo(selectedUser.last_active)}
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider font-bold theme-text-tertiary text-center">Last Active</span>
                                        </div>
                                    </div>

                                    {/* Role Badge and Helper Text */}
                                    <div className="space-y-4">
                                        {selectedUser.total_projects === 0 && (
                                            <div className="px-4 py-3 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                                                <p className="text-xs text-white/40 italic text-center">No projects created yet.</p>
                                            </div>
                                        )}

                                        <div className={`flex items-center justify-between p-4 border rounded-2xl ${selectedUser.is_deleted ? 'bg-zinc-800/40 border-zinc-600/20' : 'bg-white/[0.02] border-white/5'}`}>
                                            <div className="flex items-center gap-3">
                                                {selectedUser.is_deleted ? (
                                                    <X className="w-5 h-5 text-zinc-400" />
                                                ) : (
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                )}
                                                <div>
                                                    <p className="text-sm theme-text font-medium">Account Status</p>
                                                    {selectedUser.is_deleted ? (
                                                        <p className="text-xs text-zinc-400">Account has been deactivated</p>
                                                    ) : (
                                                        <p className="text-xs text-white/40">Verified and active member</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {selectedUser.is_deleted ? (
                                                    <button
                                                        onClick={() => setReactivateConfirmUser(selectedUser)}
                                                        className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                                                    >
                                                        Reactivate
                                                    </button>
                                                ) : (
                                                    <span className="px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        Active
                                                    </span>
                                                )}
                                                <span className={`px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-lg ${selectedUser.role === 'admin'
                                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                    : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                    }`}>
                                                    {selectedUser.role} Role
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="px-8 py-6 theme-bg-secondary border-t theme-border flex items-center justify-between gap-4">
                            <div>
                                {selectedUser?.is_deleted && (
                                    <button
                                        onClick={() => setReactivateConfirmUser(selectedUser)}
                                        className="px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-semibold rounded-xl border border-emerald-500/30 transition-all flex items-center gap-2 text-sm"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Reactivate Account
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl border border-white/5 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmUser && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        onClick={() => !isDeleting && setDeleteConfirmUser(null)}
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

                            <h3 className="text-2xl font-bold theme-text text-center mb-2">Delete User?</h3>
                            <p className="theme-text-tertiary text-center mb-8">
                                This will permanently delete
                                <span className="theme-text font-semibold mx-1">{deleteConfirmUser.name}</span>
                                and all associated projects and API history. This action cannot be undone.
                            </p>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setDeleteConfirmUser(null)}
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
            {/* Reactivate Confirmation Modal */}
            {reactivateConfirmUser && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        onClick={() => !isReactivating && setReactivateConfirmUser(null)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative w-full max-w-lg theme-bg-card-solid border border-emerald-500/20 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/10 theme-transition"
                    >
                        <div className="p-8">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-6 mx-auto">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>

                            <h3 className="text-2xl font-bold theme-text text-center mb-2">Reactivate Account?</h3>
                            <p className="theme-text-tertiary text-center mb-2">
                                Are you sure you want to reactivate
                                <span className="theme-text font-semibold mx-1">{reactivateConfirmUser.name}</span>'s account?
                            </p>
                            <p className="text-white/30 text-center text-xs mb-8">
                                They will be able to log in and access all their existing projects and data.
                            </p>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setReactivateConfirmUser(null)}
                                    disabled={isReactivating}
                                    className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl transition-all border border-white/10 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReactivate}
                                    disabled={isReactivating}
                                    className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isReactivating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            Reactivating...
                                        </>
                                    ) : (
                                        'Confirm Reactivate'
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

export default AdminUsersPage;
