import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Suggestions() {
    const { token, isAdmin } = useAuth();
    const [suggestions, setSuggestions] = useState([]);
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [msg, setMsg] = useState('');

    useEffect(() => { fetchSuggestions(); }, []);

    async function fetchSuggestions() {
        try { const res = await fetch('/api/suggestions', { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setSuggestions(await res.json()); }
        finally { setLoading(false); }
    }

    async function handleSubmit(e, parentId = null) {
        e.preventDefault();
        setSending(true); setMsg('');
        const submitTitle = parentId ? 'Reply' : title;
        const submitText = parentId ? replyText : text;
        try {
            const res = await fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: submitTitle, text: submitText, parent_id: parentId }) });
            if (res.ok) {
                setTitle(''); setText(''); setReplyText(''); setReplyingTo(null);
                setMsg(parentId ? 'Reply submitted.' : 'Feedback submitted. Thank you!');
                fetchSuggestions();
            }
        } finally { setSending(false); }
    }

    async function markReviewed(id) {
        await fetch(`/api/suggestions/${id}/review`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        fetchSuggestions();
    }

    // Organize into a tree
    const rootSuggestions = suggestions.filter(s => !s.parent_id);
    const getReplies = (parentId) => suggestions.filter(s => s.parent_id === parentId);

    return (
        <div className="page-container">
            <div className="page-header animate-slide-up">
                <h1 className="page-title">Suggestions & Feedback</h1>
                <p className="page-subtitle">Help us improve the portal</p>
            </div>

            <div className="card-static mb-8 animate-slide-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-base)' }}>Submit Feedback</h3>
                {msg && !replyingTo && <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--success-soft)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>{msg}</div>}
                <form onSubmit={e => handleSubmit(e, null)}>
                    <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief title" required /></div>
                    <div className="form-group"><label className="form-label">Details</label><textarea className="form-textarea" value={text} onChange={e => setText(e.target.value)} placeholder="Describe your idea or report..." required /></div>
                    <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Submitting...' : 'Submit'}</button>
                </form>
            </div>

            <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-base)' }}>{isAdmin ? 'All Suggestions' : 'Your Suggestions'}</h3>

            {loading ? <div className="loading-spinner"><div className="spinner"></div></div> : rootSuggestions.length === 0 ? (
                <div className="empty-state"><div className="empty-state-title">No suggestions yet</div></div>
            ) : (
                <div className="flex flex-col gap-4 stagger-children">
                    {rootSuggestions.map(s => (
                        <div key={s.id} className="card-static flex flex-col gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                            <div className="flex items-center justify-between">
                                <h4 style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{s.title}</h4>
                                <span className={`badge ${s.status === 'reviewed' ? 'badge-success' : 'badge-warning'}`}>{s.status === 'reviewed' ? 'Reviewed' : 'Open'}</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', lineHeight: 1.6 }}>{s.text}</p>
                            <div className="flex items-center justify-between mt-2">
                                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{isAdmin && s.display_name && `By ${s.display_name} · `}{new Date(s.created_at).toLocaleDateString()}</span>
                                <div className="flex gap-2">
                                    <button className="btn btn-ghost btn-sm" onClick={() => setReplyingTo(replyingTo === s.id ? null : s.id)}>Reply</button>
                                    {isAdmin && s.status === 'open' && <button className="btn btn-success btn-sm" onClick={() => markReviewed(s.id)}>Mark Reviewed</button>}
                                </div>
                            </div>

                            {/* Nested Replies */}
                            {getReplies(s.id).length > 0 && (
                                <div className="mt-4 flex flex-col gap-3" style={{ paddingLeft: 'var(--space-4)', borderLeft: '2px solid var(--border-color)' }}>
                                    {getReplies(s.id).map(r => (
                                        <div key={r.id}>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', lineHeight: 1.5 }}>{r.text}</p>
                                            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{r.display_name} · {new Date(r.created_at).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reply Box */}
                            {replyingTo === s.id && (
                                <form onSubmit={e => handleSubmit(e, s.id)} className="mt-4" style={{ paddingLeft: 'var(--space-4)', borderLeft: '2px solid var(--border-color)' }}>
                                    {msg && replyingTo === s.id && <div style={{ fontSize: 'var(--font-xs)', color: 'var(--success)' }}>{msg}</div>}
                                    <textarea className="form-textarea mt-2 mb-2" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply..." required style={{ minHeight: '60px' }} />
                                    <div className="flex gap-2">
                                        <button type="submit" className="btn btn-primary btn-sm" disabled={sending}>{sending ? '...' : 'Post Reply'}</button>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplyingTo(null)}>Cancel</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
