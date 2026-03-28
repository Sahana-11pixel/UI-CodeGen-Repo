import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Toaster } from 'sonner';
import ThemeToggle from './components/ThemeToggle';

import LandingPage from './pages/LandingPage';
import SignUpPage from './pages/SignUpPage';
import LoginPage from './pages/LoginPage';
import UploadPage from './pages/UploadPage';
import EditorPage from './pages/EditorPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminProjectsPage from './pages/AdminProjectsPage';
import AuthActionPage from './pages/AuthActionPage';
import { RequireAuth, NotAdminRoute, GuestOnlyRoute } from './components/RouteGuards';

const ThemedToaster = () => {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      closeButton
      toastOptions={{
        style: {
          background: theme === 'dark' ? '#18181b' : '#ffffff',
          color: theme === 'dark' ? '#fff' : '#1a1a2e',
          border: theme === 'dark'
            ? '1px solid rgba(168, 85, 247, 0.2)'
            : '1px solid rgba(168, 85, 247, 0.15)',
          boxShadow: theme === 'light' ? '0 2px 10px rgba(0,0,0,0.08)' : undefined,
        },
      }}
    />
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Admin Routes */}
              <Route element={<RequireAuth allowedRoles={['admin']} />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/projects" element={<AdminProjectsPage />} />
              </Route>

              {/* Settings — accessible by both admin and user */}
              <Route element={<RequireAuth allowedRoles={['admin', 'user']} />}>
                <Route path="/settings" element={<SettingsPage />} />
              </Route>


              {/* User Routes */}
              <Route element={<RequireAuth allowedRoles={['user']} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/editor" element={<EditorPage />} />
              </Route>

              {/* Public/User Routes (Hidden from Admin) */}
              <Route element={<NotAdminRoute />}>
                <Route path="/" element={<LandingPage />} />
              </Route>

              {/* Guest Routes (Redirect if logged in) */}
              <Route element={<GuestOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUpPage />} />
              </Route>



              {/* Firebase email-action handler (verifyEmail, resetPassword) — public */}
              <Route path="/auth-action" element={<AuthActionPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ThemedToaster />
            <ThemeToggle />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;