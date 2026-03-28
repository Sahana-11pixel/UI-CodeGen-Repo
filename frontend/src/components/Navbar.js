import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Code2, LogOut, User, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 theme-bg-navbar backdrop-blur-xl border-b theme-border theme-transition">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl group-hover:from-purple-500/30 group-hover:to-purple-600/30 transition-all">
              <Code2 className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-xl font-bold theme-text tracking-tight">UI-Code<span className="text-purple-400">Gen</span></span>
          </Link>

          {/* Center Nav */}
          <div className="hidden md:flex items-center gap-1">
            {user?.role === 'admin' ? (
              <NavLink to="/admin" active={isActive('/admin')}>Admin</NavLink>
            ) : (
              <>
                <NavLink to="/" active={isActive('/')}>Home</NavLink>
                <NavLink to="/upload" active={isActive('/upload')}>Upload</NavLink>
                {user && (
                  <NavLink to="/dashboard" active={isActive('/dashboard')}>Dashboard</NavLink>
                )}
              </>
            )}
          </div>

          {/* Right Nav */}
          <div className="flex items-center gap-3">
            {!user ? (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm theme-text-secondary hover:text-purple-400 transition-colors"
                  data-testid="nav-login-btn"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all hover:shadow-lg hover:shadow-purple-500/30"
                  data-testid="nav-signup-btn"
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 pl-2.5 pr-4 py-1.5 bg-purple-500/5 hover:bg-purple-500/10 rounded-full transition-all border theme-border hover:border-purple-500/40 group/navprofile"
                  data-testid="user-profile-btn"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-purple-500/20 group-hover/navprofile:scale-105 transition-transform">
                    {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
                  </div>
                  <span className="text-sm font-medium theme-text group-hover/navprofile:text-purple-400 transition-colors">{user.name}</span>
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-64 theme-bg-card-solid backdrop-blur-xl border theme-border rounded-2xl shadow-2xl overflow-hidden z-50 theme-shadow"
                      data-testid="user-dropdown"
                    >
                      <div className="p-4 border-b theme-border bg-gradient-to-br from-purple-500/5 to-transparent">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-inner">
                            {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm theme-text font-bold truncate">{user.name}</p>
                            <p className="text-[11px] theme-text-tertiary truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Settings */}
                      <Link
                        to="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm theme-text-secondary hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                        data-testid="settings-link"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>

                      {/* Logout */}
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm theme-text-secondary hover:text-purple-400 hover:bg-purple-500/10 transition-colors border-t theme-border"
                        data-testid="logout-btn"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

const NavLink = ({ to, active, children }) => (
  <Link
    to={to}
    className={`px-4 py-2 text-sm rounded-lg transition-all ${active
      ? 'bg-purple-500/20 text-purple-400 font-medium'
      : 'theme-text-secondary hover:text-purple-400 theme-bg-hover'
      }`}
  >
    {children}
  </Link>
);

export default Navbar;