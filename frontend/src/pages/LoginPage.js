import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, X } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { toast } from 'sonner';
import { auth } from "../firebase";
import { signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // ---- Forgot Password state ----
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const firebaseUser = userCredential.user;
      await firebaseUser.reload();
      const refreshedUser = auth.currentUser;

      if (!refreshedUser.emailVerified) {
        const actionCodeSettings = {
          url: `${window.location.origin}/login`,
          handleCodeInApp: true,
        };
        await sendEmailVerification(refreshedUser, actionCodeSettings);
        await auth.signOut();
        toast.info('Email not verified. We sent a new verification link — please check your inbox.');
        setLoading(false);
        return;
      }

      const idToken = await refreshedUser.getIdToken(true);
      const response = await authAPI.firebaseLogin(idToken, refreshedUser.displayName || formData.email.split('@')[0]);
      login(response.data.token, response.data.user);
      toast.success('Logged in successfully!');
      navigate('/upload');

    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email.');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Invalid email or password.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many failed attempts. Please try again later.');
      } else if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error(error.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // ---- Forgot Password handler ----
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Please enter your email address.');
      return;
    }

    setResetLoading(true);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, resetEmail, actionCodeSettings);
      setResetSent(true);
      toast.success('Password reset link sent!');
    } catch (error) {
      console.error('Forgot password error:', error);
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Please enter a valid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please try again later.');
      } else {
        toast.error(error.message || 'Failed to send reset link.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const openForgotModal = () => {
    setResetEmail(formData.email || '');
    setResetSent(false);
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setResetEmail('');
    setResetSent(false);
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="theme-bg-card border theme-border rounded-2xl p-8 backdrop-blur-xl theme-shadow theme-transition">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold theme-text mb-2">Welcome Back</h1>
              <p className="theme-text-secondary">Login to continue generating code</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 theme-icon" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full pl-11 pr-4 py-3 theme-bg-input border theme-border rounded-xl theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                    placeholder="you@example.com"
                    data-testid="login-email-input"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium theme-text-secondary">Password</label>
                  <button
                    type="button"
                    onClick={openForgotModal}
                    className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
                    data-testid="forgot-password-link"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 theme-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full pl-11 pr-12 py-3 theme-bg-input border theme-border rounded-xl theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                    placeholder="••••••••"
                    data-testid="login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 theme-icon hover:text-purple-400 transition-colors"
                    data-testid="toggle-password-visibility"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="login-submit-btn"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <p className="text-center text-sm theme-text-secondary mt-6">
              Don't have an account?{' '}
              <Link to="/signup" className="text-purple-400 hover:text-purple-300 font-medium">
                Create account
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeForgotModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md theme-bg-card-solid border theme-border rounded-2xl shadow-2xl overflow-hidden theme-transition"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-7 py-5 border-b theme-border bg-purple-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border theme-border">
                    <Lock className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold theme-text">Reset Password</h2>
                    <p className="text-xs theme-text-tertiary">We'll send you a reset link</p>
                  </div>
                </div>
                <button
                  onClick={closeForgotModal}
                  className="p-2 theme-bg-hover rounded-xl transition-colors theme-icon hover:text-purple-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-7">
                {resetSent ? (
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-500/20">
                      <Mail className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold theme-text mb-2">Check Your Email</h3>
                    <p className="theme-text-secondary text-sm mb-2">
                      We've sent a password reset link to
                    </p>
                    <p className="text-purple-400 font-medium text-sm mb-6">{resetEmail}</p>
                    <p className="theme-text-tertiary text-xs mb-6">
                      Click the link in the email to set a new password. If you don't see it, check your spam folder.
                    </p>
                    <button
                      onClick={closeForgotModal}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/30"
                    >
                      Back to Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <p className="theme-text-secondary text-sm">
                      Enter the email address associated with your account, and we'll send you a link to reset your password.
                    </p>
                    <div>
                      <label className="block text-sm font-medium theme-text-secondary mb-1.5">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 theme-icon" />
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                          autoFocus
                          className="w-full pl-11 pr-4 py-3 theme-bg-input border theme-border rounded-xl theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                          placeholder="you@example.com"
                          data-testid="forgot-email-input"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      data-testid="send-reset-link-btn"
                    >
                      {resetLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default LoginPage;