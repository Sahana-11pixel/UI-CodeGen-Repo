import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Trash2, Eye, EyeOff, ShieldAlert, CheckCircle2, Edit2, User as UserIcon } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { toast } from 'sonner';
import { auth } from '../firebase';
import {
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword
} from 'firebase/auth';

// ---------------------------------------------------------------------------
// Password validation helper (mirrors SignUpPage rules)
// ---------------------------------------------------------------------------
const validatePassword = (pw) => {
    if (pw.length < 6) return 'Password must be at least 6 characters.';
    if (!/[0-9]/.test(pw) && !/[!@#$%^&*]/.test(pw))
        return 'Password must contain at least one number or special character (!@#$%^&*).';
    return null;
};

// ===========================================================================
// Settings Page
// ===========================================================================
const SettingsPage = () => {
    const navigate = useNavigate();
    const { user, logout, fetchUser } = useAuth();

    // ---- Profile state ----
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(user?.name || '');
    const [nameLoading, setNameLoading] = useState(false);

    // ---- Reset Password state ----
    const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);

    // ---- Delete Account state ----
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // -------------------------------------------------------------------------
    // Update Profile Name
    // -------------------------------------------------------------------------
    const handleUpdateName = async (e) => {
        e.preventDefault();
        if (!newName.trim()) {
            toast.error('Name cannot be empty');
            return;
        }

        setNameLoading(true);
        try {
            await authAPI.updateProfile({ name: newName });
            await fetchUser(); // Sync globally
            toast.success('Display name updated!');
            setIsEditingName(false);
        } catch (err) {
            console.error('Update profile error:', err);
            toast.error(err.response?.data?.detail || 'Failed to update name');
        } finally {
            setNameLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // Reset Password
    // -------------------------------------------------------------------------
    const handleResetPassword = async (e) => {
        e.preventDefault();

        // Validate new password
        const validationError = validatePassword(pwForm.new);
        if (validationError) { toast.error(validationError); return; }

        if (pwForm.new !== pwForm.confirm) {
            toast.error('New passwords do not match.'); return;
        }

        setPwLoading(true);
        try {
            const firebaseUser = auth.currentUser;

            if (firebaseUser) {
                // Firebase user: re-authenticate then update password via Firebase
                const credential = EmailAuthProvider.credential(user.email, pwForm.current);
                await reauthenticateWithCredential(firebaseUser, credential);
                await updatePassword(firebaseUser, pwForm.new);
                toast.success('Password updated successfully!');
            } else {
                // Fallback: update via backend (legacy bcrypt users)
                await authAPI.resetPassword({
                    current_password: pwForm.current,
                    new_password: pwForm.new
                });
                toast.success('Password updated successfully!');
            }

            setPwForm({ current: '', new: '', confirm: '' });
        } catch (err) {
            console.error('Reset password error:', err);
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                toast.error('Current password is incorrect.');
            } else if (err.code === 'auth/too-many-requests') {
                toast.error('Too many attempts. Please try again later.');
            } else if (err.response?.data?.detail) {
                toast.error(err.response.data.detail);
            } else {
                toast.error('Failed to update password. Please try again.');
            }
        } finally {
            setPwLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // Delete Account (soft-delete)
    // -------------------------------------------------------------------------
    const handleDeleteAccount = async () => {
        setDeleteLoading(true);
        try {
            await authAPI.deleteAccount();
            // Sign out from Firebase if applicable
            if (auth.currentUser) await auth.signOut();
            logout();
            toast.success('Your account has been deactivated.');
            navigate('/login');
        } catch (err) {
            console.error('Delete account error:', err);
            toast.error(err.response?.data?.detail || 'Failed to delete account. Please try again.');
        } finally {
            setDeleteLoading(false);
            setShowDeleteModal(false);
        }
    };

    const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

    return (
        <Layout>
            <div className="max-w-2xl mx-auto px-6 py-12">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                    <h1 className="text-3xl font-bold theme-text mb-2">Settings</h1>
                    <p className="theme-text-secondary">Manage your account and profile</p>
                </motion.div>

                {/* ------------------------------------------------------------------ */}
                {/* Profile Section                                                   */}
                {/* ------------------------------------------------------------------ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="theme-bg-card border theme-border rounded-2xl p-7 mb-6 backdrop-blur-xl relative overflow-hidden theme-shadow theme-transition"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16" />

                    <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-2xl shadow-purple-500/20 border border-white/10 ring-4 ring-purple-500/5">
                            {initials}
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            {isEditingName ? (
                                <form onSubmit={handleUpdateName} className="space-y-3">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        autoFocus
                                        className="w-full px-4 py-2 theme-bg-input border theme-border rounded-xl theme-text font-semibold text-xl focus:outline-none focus:border-purple-500 transition-all text-center md:text-left"
                                        placeholder="Display Name"
                                    />
                                    <div className="flex items-center justify-center md:justify-start gap-2">
                                        <button
                                            type="submit"
                                            disabled={nameLoading}
                                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                                        >
                                            {nameLoading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsEditingName(false); setNewName(user?.name || ''); }}
                                            className="px-4 py-1.5 bg-purple-500/5 hover:bg-purple-500/10 theme-text-secondary hover:text-purple-400 text-xs font-bold rounded-lg transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <div className="flex items-center justify-center md:justify-start gap-2 group cursor-pointer" onClick={() => setIsEditingName(true)}>
                                        <h2 className="text-2xl font-bold theme-text group-hover:text-purple-400 transition-colors">{user?.name}</h2>
                                        <Edit2 className="w-4 h-4 theme-icon group-hover:text-purple-400 transition-colors" />
                                    </div>
                                    <p className="theme-text-tertiary text-sm mt-1">{user?.email}</p>
                                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border theme-border rounded-lg">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{user?.role} Account</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* ------------------------------------------------------------------ */}
                {/* Reset Password Section                                              */}
                {/* ------------------------------------------------------------------ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="theme-bg-card border theme-border rounded-2xl p-7 mb-6 backdrop-blur-xl theme-shadow theme-transition"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-purple-500/15 rounded-xl flex items-center justify-center">
                            <Lock className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold theme-text">Reset Password</h2>
                            <p className="text-sm theme-text-tertiary">Update your login password</p>
                        </div>
                    </div>

                    <form onSubmit={handleResetPassword} className="space-y-4">
                        {/* Current Password */}
                        <div>
                            <label className="block text-sm font-medium theme-text-secondary mb-1.5">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    value={pwForm.current}
                                    onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                                    required
                                    placeholder="Enter current password"
                                    className="w-full pr-12 pl-4 py-3 theme-bg-input border theme-border rounded-xl theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                                />
                                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 theme-icon hover:text-purple-400 transition-colors">
                                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium theme-text-secondary mb-1.5">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={pwForm.new}
                                    onChange={(e) => setPwForm({ ...pwForm, new: e.target.value })}
                                    required
                                    placeholder="Min 6 chars, include a number or symbol"
                                    className="w-full pr-12 pl-4 py-3 theme-bg-input border theme-border rounded-xl theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                                />
                                <button type="button" onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 theme-icon hover:text-purple-400 transition-colors">
                                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm New Password */}
                        <div>
                            <label className="block text-sm font-medium theme-text-secondary mb-1.5">Confirm New Password</label>
                            <input
                                type="password"
                                value={pwForm.confirm}
                                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                                required
                                placeholder="Repeat new password"
                                className="w-full pl-4 py-3 theme-bg-input border theme-border rounded-xl theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={pwLoading}
                            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {pwLoading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </motion.div>

                {/* ------------------------------------------------------------------ */}
                {/* Delete Account Section — hidden for admins                         */}
                {/* ------------------------------------------------------------------ */}
                {user?.role !== 'admin' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="theme-bg-card border border-rose-500/20 rounded-2xl p-7 backdrop-blur-xl theme-shadow theme-transition"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-rose-500/15 rounded-xl flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-rose-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold theme-text">Delete Account</h2>
                                <p className="text-sm theme-text-tertiary">Permanently deactivate your account</p>
                            </div>
                        </div>

                        <p className="text-sm theme-text-secondary mb-5">
                            Your account will be deactivated. Your data will be retained in our system for administrative records,
                            but you will no longer be able to log in.
                        </p>

                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="px-5 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-sm font-medium transition-all"
                        >
                            Delete Account
                        </button>
                    </motion.div>
                )}
            </div>

            {/* -------------------------------------------------------------------- */}
            {/* Delete Confirmation Modal                                             */}
            {/* -------------------------------------------------------------------- */}
            <AnimatePresence>
                {showDeleteModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => !deleteLoading && setShowDeleteModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-md theme-bg-card-solid border border-rose-500/20 rounded-2xl p-8 shadow-2xl theme-transition"
                        >
                            <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <ShieldAlert className="w-7 h-7 text-rose-400" />
                            </div>

                            <h3 className="text-xl font-bold theme-text text-center mb-2">Are you sure?</h3>
                            <p className="theme-text-secondary text-center text-sm mb-6">
                                This action cannot be undone. Your account will be deactivated and you will be logged out immediately.
                            </p>

                            {/* Extra confirmation: type DELETE */}
                            <div className="mb-6">
                                <label className="block text-xs theme-text-tertiary mb-2 text-center">
                                    Type <span className="text-rose-400 font-mono font-bold">DELETE</span> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="DELETE"
                                    className="w-full px-4 py-2.5 theme-bg-input border border-rose-500/20 rounded-xl theme-text text-center font-mono theme-text-placeholder focus:outline-none focus:border-rose-500/50 transition-colors"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                                    disabled={deleteLoading}
                                    className="flex-1 py-2.5 theme-bg-hover theme-text rounded-xl text-sm font-medium transition-all border theme-border disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
                                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {deleteLoading ? (
                                        <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Deleting...</>
                                    ) : 'Delete Account'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </Layout>
    );
};

export default SettingsPage;
