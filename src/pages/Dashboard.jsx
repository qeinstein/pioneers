import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import QuizCard from '../components/QuizCard';

export default function Dashboard() {
    const { user, token } = useAuth();
    const [courses, setCourses] = useState([]);
    const [recentQuizzes, setRecentQuizzes] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/courses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/quizzes?limit=4', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([c, q, p]) => {
            setCourses(c);
            setRecentQuizzes(q.slice(0, 4));
            setStats(p);
        }).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;

    const quickLinks = [
        { to: '/quiz-bank', emoji: '📝', label: 'Quiz Bank', desc: 'Browse & take quizzes', color: 'var(--primary)' },
        { to: '/flashcards', emoji: '📇', label: 'Flashcards', desc: 'Study with flashcards', color: 'var(--warning)' },
        { to: '/marketplace', emoji: '🛍️', label: 'Marketplace', desc: 'Buy & sell items', color: 'var(--success)' },
        { to: '/directory', emoji: '👥', label: 'Directory', desc: 'Find course mates', color: 'var(--info, #60a5fa)' },
        { to: '/leaderboard', emoji: '🏆', label: 'Leaderboard', desc: 'See top performers', color: 'var(--error)' },
        { to: '/suggestions', emoji: '💬', label: 'Feedback', desc: 'Share your thoughts', color: '#a78bfa' },
    ];

    return (
        <div className="page-container">
            {/* Welcome */}
            <div className="card-static animate-slide-up" style={{
                marginBottom: 'var(--space-8)', padding: 'var(--space-6)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-xl)',
            }}>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="avatar avatar-xl">
                        {user?.profile_pic_url ? <img src={user.profile_pic_url} alt="" /> : (user?.display_name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, letterSpacing: '-0.03em' }}>
                            Welcome back, {user?.display_name || user?.matric_no}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-1)' }}>
                            Your department portal — everything in one place.
                        </p>
                    </div>
                    {stats?.streak && stats.streak.current_streak > 0 && (
                        <div className="streak-display">
                            <span className="streak-flame">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                    <path d="M12 2c0 0-5 5-5 11 0 2.76 2.24 5 5 5s5-2.24 5-5c0-6-5-11-5-11zm0 14c-1.66 0-3-1.34-3-3 0-2 3-5.4 3-5.4s3 3.4 3 5.4c0 1.66-1.34 3-3 3z" />
                                </svg>
                            </span>
                            <span>{stats.streak.current_streak} Day Streak!</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="stats-grid stagger-children" style={{ marginBottom: 'var(--space-8)' }}>
                <div className="stat-card">
                    <div className="stat-value">{stats?.stats?.quizzes_taken || 0}</div>
                    <div className="stat-label">Quizzes Taken</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.stats?.avg_score || 0}%</div>
                    <div className="stat-label">Average Score</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.streak?.current_streak || 0}</div>
                    <div className="stat-label">Day Streak</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.achievements?.length || 0}</div>
                    <div className="stat-label">Achievements</div>
                </div>
            </div>

            {/* Quick Links */}
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 'var(--space-4)' }}>Quick Access</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 'var(--space-3)' }} className="stagger-children">
                    {quickLinks.map(link => (
                        <Link key={link.to} to={link.to} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                                <div style={{ fontSize: '1.8rem', marginBottom: 'var(--space-2)' }}>{link.emoji}</div>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{link.label}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: '2px' }}>{link.desc}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Courses */}
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>Courses</h2>
                    {user?.role === 'admin' && (
                        <Link to="/admin/courses" className="btn btn-ghost btn-sm">Manage</Link>
                    )}
                </div>
                <div className="grid-3 stagger-children">
                    {courses.map(c => (
                        <Link to={`/courses/${c.id}`} key={c.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div className="card">
                                <h3 style={{ fontWeight: 700, fontSize: 'var(--font-base)' }}>{c.course_code}</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-1)' }}>{c.course_name}</p>
                                <span className="badge badge-primary" style={{ marginTop: 'var(--space-3)', display: 'inline-block' }}>
                                    {c.quiz_count} quizzes
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
                {courses.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-state-title">No courses yet</div>
                        <div className="empty-state-text">Courses will appear here once added by an admin.</div>
                    </div>
                )}
            </div>

            {/* Recent Quizzes */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>Recent Quizzes</h2>
                    <Link to="/quiz-bank" className="btn btn-ghost btn-sm">View All</Link>
                </div>
                <div className="grid-2 stagger-children">
                    {recentQuizzes.map(q => <QuizCard key={q.id} quiz={q} />)}
                </div>
                {recentQuizzes.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-state-title">No quizzes yet</div>
                        <div className="empty-state-text">Create or browse quizzes from the Quiz Bank.</div>
                    </div>
                )}
            </div>
        </div>
    );
}

