import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import RolePopup from './components/RolePopup';

// Lazy-load all pages for fast initial render
const Login = lazy(() => import('./pages/Login'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const SetUsername = lazy(() => import('./pages/SetUsername'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const QuizBank = lazy(() => import('./pages/QuizBank'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const AnonymousBoard = lazy(() => import('./pages/AnonymousBoard'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Suggestions = lazy(() => import('./pages/Suggestions'));
const LiveHost = lazy(() => import('./pages/LiveHost'));
const LiveJoin = lazy(() => import('./pages/LiveJoin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const ManageCourses = lazy(() => import('./pages/admin/ManageCourses'));
const ManageQuizzes = lazy(() => import('./pages/admin/ManageQuizzes'));

function PageLoader() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
            <div className="spinner"></div>
        </div>
    );
}

function AppLayout({ children }) {
    return (
        <div className="app-layout">
            <div className="bg-animation">
                <div className="bg-orb bg-orb-1"></div>
                <div className="bg-orb bg-orb-2"></div>
                <div className="bg-orb bg-orb-3"></div>
                <div className="bg-grid"></div>
            </div>
            <Sidebar />
            <main className="main-content">
                <Suspense fallback={<PageLoader />}>{children}</Suspense>
            </main>
        </div>
    );
}

function RoleActionChecker({ children }) {
    const { token, refreshProfile, isAuthenticated } = useAuth();
    const [pendingData, setPendingData] = useState(null);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (!isAuthenticated || !token) { setChecked(true); return; }
        fetch('/api/auth/pending-actions', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => {
                if (data.promotions?.length > 0 || data.demotions?.length > 0) {
                    setPendingData(data);
                } else {
                    setChecked(true);
                }
            })
            .catch(() => setChecked(true));
    }, [isAuthenticated, token]);

    function handleDone(newRole) {
        setPendingData(null);
        setChecked(true);
        if (newRole) refreshProfile();
    }

    if (!checked && pendingData) {
        return <RolePopup
            promotions={pendingData.promotions}
            demotions={pendingData.demotions}
            token={token}
            onDone={handleDone}
        />;
    }

    if (!checked) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
            <div className="spinner"></div>
        </div>;
    }

    return children;
}

function UsernameChecker({ children }) {
    const { isAuthenticated, user } = useAuth();

    // Only intercept if they are logged in and don't have a username
    if (isAuthenticated && user && !user.username) {
        return <SetUsername />;
    }

    return children;
}

export default function App() {
    const { isAuthenticated, darkMode } = useAuth();

    return (
        <div data-theme={darkMode ? 'dark' : 'light'}>
            <RoleActionChecker>
                <UsernameChecker>
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
                            <Route path="/change-password" element={
                                <ProtectedRoute allowFirstLogin><ChangePassword /></ProtectedRoute>
                            } />
                            <Route path="/set-username" element={
                                <ProtectedRoute><SetUsername /></ProtectedRoute>
                            } />

                            <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
                            <Route path="/quiz-bank" element={<ProtectedRoute><AppLayout><QuizBank /></AppLayout></ProtectedRoute>} />
                            <Route path="/courses/:id" element={<ProtectedRoute><AppLayout><CourseDetail /></AppLayout></ProtectedRoute>} />
                            <Route path="/quiz/:id" element={<ProtectedRoute><AppLayout><QuizPage /></AppLayout></ProtectedRoute>} />
                            <Route path="/results/:quizId" element={<ProtectedRoute><AppLayout><Results /></AppLayout></ProtectedRoute>} />
                            <Route path="/create-quiz" element={<ProtectedRoute><AppLayout><CreateQuiz /></AppLayout></ProtectedRoute>} />
                            <Route path="/leaderboard" element={<ProtectedRoute><AppLayout><Leaderboard /></AppLayout></ProtectedRoute>} />
                            <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
                            <Route path="/profile/:userId" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
                            <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
                            <Route path="/suggestions" element={<ProtectedRoute><AppLayout><Suggestions /></AppLayout></ProtectedRoute>} />

                            <Route path="/live/host/:code" element={<ProtectedRoute><AppLayout><LiveHost /></AppLayout></ProtectedRoute>} />
                            <Route path="/live/join" element={<ProtectedRoute><AppLayout><LiveJoin /></AppLayout></ProtectedRoute>} />
                            <Route path="/live/play/:code" element={<ProtectedRoute><AppLayout><LiveJoin /></AppLayout></ProtectedRoute>} />

                            <Route path="/admin" element={<ProtectedRoute adminOnly><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
                            <Route path="/admin/users" element={<ProtectedRoute adminOnly><AppLayout><ManageUsers /></AppLayout></ProtectedRoute>} />
                            <Route path="/admin/courses" element={<ProtectedRoute adminOnly><AppLayout><ManageCourses /></AppLayout></ProtectedRoute>} />
                            <Route path="/admin/quizzes" element={<ProtectedRoute adminOnly><AppLayout><ManageQuizzes /></AppLayout></ProtectedRoute>} />

                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    </Suspense>
                </UsernameChecker>
            </RoleActionChecker>
        </div>
    );
}
