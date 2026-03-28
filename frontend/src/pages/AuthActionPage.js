import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    CheckCircle, XCircle, Loader, Mail, Lock, Eye, EyeOff, KeyRound
} from 'lucide-react';
import { auth } from '../firebase';
import {
    applyActionCode,
    verifyPasswordResetCode,
    confirmPasswordReset
} from 'firebase/auth';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Password validation helper (mirrors SignUpPage rules)
// ---------------------------------------------------------------------------
const validatePassword = (pw) => {
    if (pw.length < 6) return 'Password must be at least 6 characters.';
    if (!/[0-9]/.test(pw) && !/[!@#$%^&*]/.test(pw)) {
        return 'Password must contain at least one number or special character (!@#$%^&*).';
    }
    return null;
};

/**
 * AuthActionPage
 * ──────────────
 * Unified Firebase email-action handler.
 *
 * Firebase sends ALL email-action links to the single "Action URL"
 * configured in the console (e.g. http://localhost:3000/auth-action)
 * with query params:  ?mode=<action>&oobCode=<code>&apiKey=<key>
 *
 * Supported modes:
 *   • verifyEmail   → calls applyActionCode()
 *   • resetPassword → shows a new-password form, calls confirmPasswordReset()
 *   • (no params)   → fallback success screen (continueUrl redirect flow)
 */
const AuthActionPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Guard against React.StrictMode double-mount calling Firebase twice
    const hasRun = useRef(false);

    // ── shared state ──
    const [status, setStatus] = useState('loading');      // loading | success | error | reset-form | reset-success
    const [errorMessage, setErrorMessage] = useState('');
    const [mode, setMode] = useState('');                  // verifyEmail | resetPassword

    // ── reset-password state ──
    const [resetEmail, setResetEmail] = useState('');      // email tied to the reset code
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);

    // ── read query params & dispatch ──
    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        const urlMode = searchParams.get('mode');
        const oobCode = searchParams.get('oobCode');
        setMode(urlMode || '');

        // ─── verifyEmail ───
        if (urlMode === 'verifyEmail' && oobCode) {
            (async () => {
                try {
                    await applyActionCode(auth, oobCode);
                    if (auth.currentUser) await auth.currentUser.reload();
                    setStatus('success');
                } catch (err) {
                    console.error('Email verification error:', err);
                    if (err.code === 'auth/invalid-action-code') {
                        setErrorMessage('This verification link has expired or has already been used.');
                    } else if (err.code === 'auth/expired-action-code') {
                        setErrorMessage('This verification link has expired. Please request a new one.');
                    } else {
                        setErrorMessage(err.message || 'Verification failed. Please try again.');
                    }
                    setStatus('error');
                }
            })();
            return;
        }

        // ─── resetPassword ───
        if (urlMode === 'resetPassword' && oobCode) {
            (async () => {
                try {
                    // Verify the code is still valid and get the associated email
                    const email = await verifyPasswordResetCode(auth, oobCode);
                    setResetEmail(email);
                    setStatus('reset-form');
                } catch (err) {
                    console.error('Password reset code error:', err);
                    if (err.code === 'auth/invalid-action-code') {
                        setErrorMessage('This reset link has expired or has already been used.');
                    } else if (err.code === 'auth/expired-action-code') {
                        setErrorMessage('This reset link has expired. Please request a new one from the login page.');
                    } else {
                        setErrorMessage(err.message || 'Invalid reset link. Please try again.');
                    }
                    setStatus('error');
                }
            })();
            return;
        }

        // ─── fallback: no params (continueUrl redirect from Firebase hosted page) ───
        setStatus('success');
    }, [searchParams]);

    // ── handle new-password submission ──
    const handleResetSubmit = async (e) => {
        e.preventDefault();
        const oobCode = searchParams.get('oobCode');

        // Client-side validation
        const pwError = validatePassword(newPassword);
        if (pwError) { toast.error(pwError); return; }
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match.');
            return;
        }

        setResetLoading(true);
        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            setStatus('reset-success');
            toast.success('Password reset successfully!');
        } catch (err) {
            console.error('Password reset error:', err);
            if (err.code === 'auth/weak-password') {
                toast.error('Password is too weak. Use at least 6 characters.');
            } else if (err.code === 'auth/invalid-action-code') {
                toast.error('This reset link has expired. Please request a new one.');
                setErrorMessage('This reset link has expired. Please request a new one from the login page.');
                setStatus('error');
            } else {
                toast.error(err.message || 'Failed to reset password.');
            }
        } finally {
            setResetLoading(false);
        }
    };

    // ────────────────── RENDER ──────────────────

    return (
        <div className="min-h-screen theme-bg flex items-center justify-center px-6 py-12 theme-transition">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md"
            >
                <div className="theme-bg-card border theme-border rounded-2xl p-10 backdrop-blur-xl text-center shadow-2xl theme-shadow theme-transition">

                    {/* ── Loading ── */}
                    {status === 'loading' && (
                        <>
                            <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Loader className="w-8 h-8 text-purple-400 animate-spin" />
                            </div>
                            <h1 className="text-2xl font-bold theme-text mb-2">
                                {mode === 'resetPassword' ? 'Validating reset link…' : 'Verifying your email…'}
                            </h1>
                            <p className="theme-text-secondary text-sm">Please wait a moment.</p>
                        </>
                    )}

                    {/* ── Email Verified Success ── */}
                    {status === 'success' && (
                        <>
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                                <CheckCircle className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h1 className="text-2xl font-bold theme-text mb-3">Email Verified!</h1>
                            <p className="theme-text-secondary mb-8">
                                Your email address has been confirmed. You can now log in to your account.
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/30"
                            >
                                Go to Login
                            </button>
                        </>
                    )}

                    {/* ── Password Reset Form ── */}
                    {status === 'reset-form' && (
                        <>
                            <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/20">
                                <KeyRound className="w-8 h-8 text-purple-400" />
                            </div>
                            <h1 className="text-2xl font-bold theme-text mb-2">Reset Your Password</h1>
                            <p className="theme-text-secondary text-sm mb-6">
                                Enter a new password for <span className="text-purple-400 font-medium">{resetEmail}</span>
                            </p>

                            <form onSubmit={handleResetSubmit} className="space-y-4 text-left">
                                {/* New Password */}
                                <div>
                                    <label className="block text-sm font-medium theme-text-secondary mb-1.5">New Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 theme-icon" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            minLength={6}
                                            className="w-full pl-11 pr-12 py-3 theme-bg-input border theme-border rounded-xl theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                                            placeholder="••••••••"
                                            data-testid="reset-new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 theme-icon hover:text-purple-400 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label className="block text-sm font-medium theme-text-secondary mb-1.5">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 theme-icon" />
                                        <input
                                            type={showConfirm ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            minLength={6}
                                            className="w-full pl-11 pr-12 py-3 theme-bg-input border theme-border rounded-xl theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                                            placeholder="••••••••"
                                            data-testid="reset-confirm-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm(!showConfirm)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 theme-icon hover:text-purple-400 transition-colors"
                                        >
                                            {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Password requirements hint */}
                                <p className="theme-text-tertiary text-xs">
                                    Min 6 characters with at least one number or special character (!@#$%^&*).
                                </p>

                                <button
                                    type="submit"
                                    disabled={resetLoading}
                                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    data-testid="reset-submit-btn"
                                >
                                    {resetLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            Resetting…
                                        </>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    {/* ── Password Reset Success ── */}
                    {status === 'reset-success' && (
                        <>
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                                <CheckCircle className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h1 className="text-2xl font-bold theme-text mb-3">Password Reset!</h1>
                            <p className="theme-text-secondary mb-8">
                                Your password has been updated successfully. You can now log in with your new password.
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/30"
                            >
                                Go to Login
                            </button>
                        </>
                    )}

                    {/* ── Error ── */}
                    {status === 'error' && (
                        <>
                            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                                <XCircle className="w-8 h-8 text-rose-400" />
                            </div>
                            <h1 className="text-2xl font-bold theme-text mb-3">
                                {mode === 'resetPassword' ? 'Reset Link Invalid' : 'Verification Failed'}
                            </h1>
                            <p className="theme-text-secondary mb-6 text-sm">{errorMessage}</p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all"
                                >
                                    Go to Login
                                </button>
                                <button
                                    onClick={() => navigate('/signup')}
                                    className="w-full py-3 theme-bg-hover theme-text font-medium rounded-xl border theme-border transition-all"
                                >
                                    Back to Sign Up
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Branding footer */}
                <div className="flex items-center justify-center gap-2 mt-6 theme-text-tertiary text-xs">
                    <Mail className="w-3 h-3" />
                    <span>Secure email action by Firebase</span>
                </div>
            </motion.div>
        </div>
    );
};

export default AuthActionPage;
