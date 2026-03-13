import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
    const { token } = useAuth();
    const [stats, setStats] = useState(null);
    const [pendingQuizzes, setPendingQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.ok ? r.json() : {}).catch(() => ({})),
            fetch('/api/admin/pending-quizzes', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.ok ? r.json() : []).catch(() => ([])),
        ]).then(([s, p]) => { setStats(s); setPendingQuizzes(Array.isArray(p) ? p : []); }).finally(() => setLoading(false));
    }, []);

    async function handleApprove(id) {
        await fetch(`/api/admin/quizzes/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        setPendingQuizzes(prev => prev.filter(q => q.id !== id));
    }

    async function handleReject(id) {
        await fetch(`/api/admin/quizzes/${id}/reject`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        setPendingQuizzes(prev => prev.filter(q => q.id !== id));
    }

    if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;

    return (
        <div className="page-container">
            <div className="page-header animate-slide-up">
                <h1 className="page-title">Admin Dashboard</h1>
                <p className="page-subtitle">System overview and management</p>
            </div>

            <div className="stats-grid mb-8 stagger-children">
                <div className="stat-card"><div className="stat-value">{stats?.totalUsers || 0}</div><div className="stat-label">Users</div></div>
                <div className="stat-card"><div className="stat-value">{stats?.totalCourses || 0}</div><div className="stat-label">Courses</div></div>
                <div className="stat-card"><div className="stat-value">{stats?.totalQuizzes || 0}</div><div className="stat-label">Quizzes</div></div>
                <div className="stat-card"><div className="stat-value">{stats?.totalAttempts || 0}</div><div className="stat-label">Attempts</div></div>
                <div className="stat-card"><div className="stat-value" style={{ color: stats?.pendingQuizzes > 0 ? 'var(--warning)' : undefined }}>{stats?.pendingQuizzes || 0}</div><div className="stat-label">Pending</div></div>
                <div className="stat-card"><div className="stat-value">{stats?.openSuggestions || 0}</div><div className="stat-label">Open Feedback</div></div>
            </div>

            <div className="grid-3 mb-8 stagger-children">
                {[
                    { to: '/admin/users', label: 'Manage Users', desc: 'Whitelist, roles, passwords' },
                    { to: '/admin/courses', label: 'Manage Courses', desc: 'Create, edit, delete courses' },
                    { to: '/admin/quizzes', label: 'Manage Quizzes', desc: 'Review and manage quizzes' },
                    { to: '/suggestions', label: 'Feedback', desc: 'View user suggestions' },
                    { to: '/create-quiz', label: 'Create Quiz', desc: 'Add new quiz (auto-published)' },
                    { to: '/leaderboard', label: 'Leaderboard', desc: 'View rankings' },
                ].map(l => (
                    <Link key={l.to} to={l.to} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="card">
                            <h3 style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{l.label}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-1)' }}>{l.desc}</p>
                        </div>
                    </Link>
                ))}
            </div>

            {pendingQuizzes.length > 0 && (
                <>
                    <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Pending Review ({pendingQuizzes.length})</h2>
                    <div className="flex flex-col gap-4 stagger-children">
                        {pendingQuizzes.map(q => (
                            <div key={q.id} className="card-static" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="badge badge-primary">{q.course_code}</span>
                                            <span className="badge badge-warning">Pending</span>
                                        </div>
                                        <h3 style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{q.title}</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>
                                            By {q.creator_name || q.creator_matric} &middot; {q.question_count} questions
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="btn btn-success btn-sm" onClick={() => handleApprove(q.id)}>Approve</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(q.id)}>Reject</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
