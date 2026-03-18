import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import RolePopup from './components/RolePopup';

function DobPrompt() {
    const { user, updateProfile } = useAuth();
    const [dob, setDob] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    if (!user || user.dob) return null;

    async function handleSave() {
        if (!dob) { setError('Please enter your date of birth'); return; }
        setSaving(true);
        try {
            await updateProfile({ dob });
            // updateProfile already updates user state — no need to refreshProfile
        } catch { setError('Failed to save. Try again.'); }
        finally { setSaving(false); }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
            <div style={{
                background: 'var(--bg-card-solid)', borderRadius: 'var(--radius-xl)',
                padding: '2rem', maxWidth: '400px', width: '100%',
                boxShadow: 'var(--glass-shadow)', textAlign: 'center',
            }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎂</div>
                <h2 style={{ fontWeight: 800, fontSize: 'var(--font-xl)', marginBottom: '0.5rem' }}>One quick thing!</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: '1.5rem' }}>
                    Add your date of birth so we can celebrate your birthday with a shoutout on the dashboard!
                </p>
                <input
                    type="date"
                    className="form-input"
                    value={dob}
                    onChange={e => { setDob(e.target.value); setError(''); }}
                    style={{ marginBottom: '1rem', textAlign: 'center' }}
                />
                {error && <p style={{ color: 'var(--error)', fontSize: 'var(--font-xs)', marginBottom: '0.75rem' }}>{error}</p>}
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Birthday'}
                </button>
            </div>
        </div>
    );
}

// Lazy-load all pages for fast initial render
const Login = lazy(() => import('./pages/Login'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Directory = lazy(() => import('./pages/Directory'));
const QuizBank = lazy(() => import('./pages/QuizBank'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const Results = lazy(() => import('./pages/Results'));
const CreateQuiz = lazy(() => import('./pages/CreateQuiz'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Suggestions = lazy(() => import('./pages/Suggestions'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Flashcards = lazy(() => import('./pages/Flashcards'));
const LiveHost = lazy(() => import('./pages/LiveHost'));
const LiveJoin = lazy(() => import('./pages/LiveJoin'));
const Voting = lazy(() => import('./pages/Voting'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const ManageCourses = lazy(() => import('./pages/admin/ManageCourses'));
const ManageQuizzes = lazy(() => import('./pages/admin/ManageQuizzes'));
const ManageApprovals = lazy(() => import('./pages/admin/ManageApprovals'));
const ManageBirthdays = lazy(() => import('./pages/admin/ManageBirthdays'));

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
    const { token, refreshProfile, isAuthenticated, updateToken } = useAuth();
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

    function handleDone(newRole, newToken) {
        setPendingData(null);
        setChecked(true);
        if (newToken) updateToken(newToken);
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

export default function App() {
    const { isAuthenticated, darkMode } = useAuth();

    return (
        <div data-theme={darkMode ? 'dark' : 'light'}>
            <DobPrompt />
            <RoleActionChecker>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
                        <Route path="/change-password" element={
                            <ProtectedRoute allowFirstLogin><ChangePassword /></ProtectedRoute>
                        } />

                        <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
                        <Route path="/directory" element={<ProtectedRoute><AppLayout><Directory /></AppLayout></ProtectedRoute>} />
                        <Route path="/quiz-bank" element={<ProtectedRoute><AppLayout><QuizBank /></AppLayout></ProtectedRoute>} />
                        <Route path="/courses/:id" element={<ProtectedRoute><AppLayout><CourseDetail /></AppLayout></ProtectedRoute>} />
                        <Route path="/quiz/:id" element={<ProtectedRoute><AppLayout><QuizPage /></AppLayout></ProtectedRoute>} />
                        <Route path="/results/:quizId" element={<ProtectedRoute><AppLayout><Results /></AppLayout></ProtectedRoute>} />
                        <Route path="/create-quiz" element={<ProtectedRoute><AppLayout><CreateQuiz /></AppLayout></ProtectedRoute>} />
                        <Route path="/notifications" element={<ProtectedRoute><AppLayout><Notifications /></AppLayout></ProtectedRoute>} />
                        <Route path="/leaderboard" element={<ProtectedRoute><AppLayout><Leaderboard /></AppLayout></ProtectedRoute>} />
                        <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
                        <Route path="/profile/:userId" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
                        <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
                        <Route path="/suggestions" element={<ProtectedRoute><AppLayout><Suggestions /></AppLayout></ProtectedRoute>} />
                        <Route path="/marketplace" element={<ProtectedRoute><AppLayout><Marketplace /></AppLayout></ProtectedRoute>} />
                        <Route path="/flashcards" element={<ProtectedRoute><AppLayout><Flashcards /></AppLayout></ProtectedRoute>} />
                        <Route path="/voting" element={<ProtectedRoute><AppLayout><Voting /></AppLayout></ProtectedRoute>} />

                        <Route path="/live/host/:code" element={<ProtectedRoute><AppLayout><LiveHost /></AppLayout></ProtectedRoute>} />
                        <Route path="/live/join" element={<ProtectedRoute><AppLayout><LiveJoin /></AppLayout></ProtectedRoute>} />
                        <Route path="/live/play/:code" element={<ProtectedRoute><AppLayout><LiveJoin /></AppLayout></ProtectedRoute>} />

                        <Route path="/admin" element={<ProtectedRoute adminOnly><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
                        <Route path="/admin/users" element={<ProtectedRoute adminOnly><AppLayout><ManageUsers /></AppLayout></ProtectedRoute>} />
                        <Route path="/admin/courses" element={<ProtectedRoute adminOnly><AppLayout><ManageCourses /></AppLayout></ProtectedRoute>} />
                        <Route path="/admin/quizzes" element={<ProtectedRoute adminOnly><AppLayout><ManageQuizzes /></AppLayout></ProtectedRoute>} />
                        <Route path="/admin/approvals" element={<ProtectedRoute adminOnly><AppLayout><ManageApprovals /></AppLayout></ProtectedRoute>} />
                        <Route path="/admin/birthdays" element={<ProtectedRoute adminOnly><AppLayout><ManageBirthdays /></AppLayout></ProtectedRoute>} />

                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </Suspense>
            </RoleActionChecker>
        </div>
    );
}
