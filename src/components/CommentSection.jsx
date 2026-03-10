import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function CommentSection({ quizId }) {
    const { token, user } = useAuth();
    const [comments, setComments] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchComments(); }, [quizId]);

    async function fetchComments() {
        try { const res = await fetch(`/api/comments/${quizId}`, { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setComments(await res.json()); }
        catch { } finally { setLoading(false); }
    }

    async function handleSubmit(e) {
        e.preventDefault(); if (!text.trim()) return;
        try {
            const res = await fetch(`/api/comments/${quizId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text }) });
            if (res.ok) { const comment = await res.json(); setComments(prev => [comment, ...prev]); setText(''); }
        } catch { }
    }

    async function handleDelete(id) {
        try { await fetch(`/api/comments/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); setComments(prev => prev.filter(c => c.id !== id)); } catch { }
    }

    const initials = (name) => (name || '?').slice(0, 2).toUpperCase();

    return (
        <div className="card-static mt-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                Discussion ({comments.length})
            </h3>

            <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
                <div className="avatar avatar-sm">{user?.profile_pic_url ? <img src={user.profile_pic_url} alt="" /> : initials(user?.display_name)}</div>
                <input className="form-input" placeholder="Share your thoughts..." value={text} onChange={e => setText(e.target.value)} style={{ flex: 1 }} />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!text.trim()}>Post</button>
            </form>

            {loading ? <div className="loading-spinner"><div className="spinner"></div></div> : comments.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-6)', fontSize: 'var(--font-sm)' }}>No comments yet. Be the first to discuss!</div>
            ) : (
                <div className="flex flex-col gap-3">
                    {comments.map(c => (
                        <div key={c.id} className="flex gap-3" style={{ animation: 'fadeIn 0.3s ease' }}>
                            <div className="avatar avatar-sm">{c.profile_pic_url ? <img src={c.profile_pic_url} alt="" /> : initials(c.display_name)}</div>
                            <div style={{ flex: 1 }}>
                                <div className="flex items-center gap-2">
                                    <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{c.display_name || c.matric_no}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                                </div>
                                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>{c.text}</p>
                            </div>
                            {(c.user_id === user?.id || user?.role === 'admin') && (
                                <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'var(--font-xs)', padding: 'var(--space-1)' }}>Delete</button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
