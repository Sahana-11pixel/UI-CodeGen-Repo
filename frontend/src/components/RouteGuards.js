import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
    </div>
);

export const RequireAuth = ({ allowedRoles }) => {
    const { user, loading } = useAuth();

    if (loading) return <LoadingSpinner />;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'admin') {
            return <Navigate to="/admin" replace />;
        }
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};

export const NotAdminRoute = () => {
    const { user, loading } = useAuth();

    if (loading) return <LoadingSpinner />;

    if (user?.role === 'admin') {
        return <Navigate to="/admin" replace />;
    }

    return <Outlet />;
};

export const GuestOnlyRoute = () => {
    const { user, loading } = useAuth();

    if (loading) return <LoadingSpinner />;

    if (user) {
        if (user.role === 'admin') {
            return <Navigate to="/admin" replace />;
        }
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};
