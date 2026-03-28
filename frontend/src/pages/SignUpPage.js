import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import Layout from '../components/Layout';
import { toast } from 'sonner';
import { auth } from "../firebase";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";

const SignUpPage = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pw = formData.password;
    if (pw.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (!/[0-9]/.test(pw) && !/[!@#$%^&*]/.test(pw)) {
      toast.error('Password must contain at least one number or special character (!@#$%^&*).');
      return;
    }
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      await updateProfile(userCredential.user, { displayName: formData.name });
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      };
      await sendEmailVerification(userCredential.user, actionCodeSettings);
      await auth.signOut();

      setEmailSent(true);
      toast.success('Account created! Check your email to verify your account.');
    } catch (error) {
      console.error('Signup error:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Please login instead.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak. Use at least 6 characters.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address.');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="theme-bg-card border theme-border rounded-2xl p-8 backdrop-blur-xl text-center theme-shadow theme-transition">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-purple-400" />
              </div>
              <h1 className="text-2xl font-bold theme-text mb-3">Check Your Email</h1>
              <p className="theme-text-secondary mb-6">
                We've sent a verification link to <span className="text-purple-400 font-medium">{formData.email}</span>.
                Please click the link to verify your account, then come back and log in.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-purple-500/30"
              >
                Go to Login
              </button>
              <p className="theme-text-tertiary text-xs mt-4">
                Didn't receive the email? Check your spam folder.
              </p>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

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
              <h1 className="text-3xl font-bold theme-text mb-2">Create Account</h1>
              <p className="theme-text-secondary">Start generating code from screenshots</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" data-testid="signup-form">
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 theme-icon" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full pl-11 pr-4 py-3 theme-bg-input border theme-border rounded-xl theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                    placeholder="John Doe"
                    data-testid="signup-name-input"
                  />
                </div>
              </div>

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
                    data-testid="signup-email-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 theme-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full pl-11 pr-12 py-3 theme-bg-input border theme-border rounded-xl theme-text theme-text-placeholder focus:outline-none focus:border-purple-500/50 transition-colors"
                    placeholder="••••••••"
                    data-testid="signup-password-input"
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
                data-testid="signup-submit-btn"
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>

            <p className="text-center text-sm theme-text-secondary mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium">
                Login
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default SignUpPage;