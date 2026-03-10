import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ManageQuizzes() {
    const { token } = useAuth();
    const [quizzes, setQuizzes] = useState([]);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('pending');
    const [msg, setMsg] = useState('');

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/pending-quizzes', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/quizzes?status=approved', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([p, a]) => { setPending(p); setQuizzes(a); }).finally(() => setLoading(false));
    }, []);

    async function approve(id) {
        await fetch(`/api/admin/quizzes/${id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        const quiz = pending.find(q => q.id === id);
        setPending(prev => prev.filter(q => q.id !== id));
        if (quiz) setQuizzes(prev => [{ ...quiz, status: 'approved' }, ...prev]);
        setMsg('Quiz approved');
    }

    async function reject(id) {
        await fetch(`/api/admin/quizzes/${id}/reject`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        setPending(prev => prev.filter(q => q.id !== id));
        setMsg('Quiz rejected');
    }

    async function deleteQuiz(id) {
        if (!confirm('Delete this quiz permanently?')) return;
        await fetch(`/api/quizzes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        setQuizzes(prev => prev.filter(q => q.id !== id));
        setMsg('Quiz deleted');
    }

    if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;

    return (
        <div className="page-container">
            <Link to="/admin" className="back-link">Back to Admin</Link>
            <div className="page-header animate-slide-up"><h1 className="page-title">Manage Quizzes</h1></div>

            {msg && <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--success-soft)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>{msg}</div>}

            <div className="tabs mb-6" style={{ maxWidth: '400px' }}>
                <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>Pending ({pending.length})</button>
                <button className={`tab ${tab === 'published' ? 'active' : ''}`} onClick={() => setTab('published')}>Published ({quizzes.length})</button>
            </div>

            {tab === 'pending' ? (
                pending.length === 0 ? (
                    <div className="empty-state"><div className="empty-state-title">No pending quizzes</div><div className="empty-state-text">All quizzes have been reviewed</div></div>
                ) : (
                    <div className="flex flex-col gap-4 stagger-children">
                        {pending.map(q => (
                            <div key={q.id} className="card-static" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div style={{ flex: 1 }}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="badge badge-primary">{q.course_code}</span>
                                            <span className="badge badge-warning">Pending</span>
                                        </div>
                                        <h3 style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{q.title}</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>
                                            By {q.creator_name || q.creator_matric} &middot; {q.question_count} questions
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button className="btn btn-success btn-sm" onClick={() => approve(q.id)}>Approve</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => reject(q.id)}>Reject</button>
                                        <Link to={`/quiz/${q.id}`} className="btn btn-ghost btn-sm">Preview</Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                quizzes.length === 0 ? (
                    <div className="empty-state"><div className="empty-state-title">No published quizzes</div></div>
                ) : (
                    <div className="flex flex-col gap-4 stagger-children">
                        {quizzes.map(q => (
                            <div key={q.id} className="card-static" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="badge badge-primary">{q.course_code}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>{q.times_taken} taken &middot; {q.question_count} questions</span>
                                        </div>
                                        <h3 style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{q.title}</h3>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link to={`/quiz/${q.id}`} className="btn btn-ghost btn-sm">View</Link>
                                        <button className="btn btn-danger btn-sm" onClick={() => deleteQuiz(q.id)}>Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}
