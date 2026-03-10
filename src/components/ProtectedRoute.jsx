import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false, allowFirstLogin = false }) {
    const { isAuthenticated, isAdmin, isFirstLogin, loading } = useAuth();

    if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

    if (!isAuthenticated) return <Navigate to="/login" />;

    if (isFirstLogin && !allowFirstLogin) return <Navigate to="/change-password" />;

    if (adminOnly && !isAdmin) return <Navigate to="/" />;

    return children;
}
