import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Suggestions() {
    const { token, isAdmin } = useAuth();
    const [suggestions, setSuggestions] = useState([]);
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => { fetchSuggestions(); }, []);

    async function fetchSuggestions() {
        try { const res = await fetch('/api/suggestions', { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setSuggestions(await res.json()); }
        finally { setLoading(false); }
    }

    async function handleSubmit(e) {
        e.preventDefault(); setSending(true); setMsg('');
        try {
            const res = await fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title, text }) });
            if (res.ok) { setTitle(''); setText(''); setMsg('Feedback submitted. Thank you!'); fetchSuggestions(); }
        } finally { setSending(false); }
    }

    async function markReviewed(id) {
        await fetch(`/api/suggestions/${id}/review`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        fetchSuggestions();
    }

    return (
        <div className="page-container">
            <div className="page-header animate-slide-up">
                <h1 className="page-title">Suggestions & Feedback</h1>
                <p className="page-subtitle">Help us improve the portal</p>
            </div>

            <div className="card-static mb-8 animate-slide-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-base)' }}>Submit Feedback</h3>
                {msg && <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--success-soft)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>{msg}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief title" required /></div>
                    <div className="form-group"><label className="form-label">Details</label><textarea className="form-textarea" value={text} onChange={e => setText(e.target.value)} placeholder="Describe your idea or report..." required /></div>
                    <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Submitting...' : 'Submit'}</button>
                </form>
            </div>

            <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-base)' }}>{isAdmin ? 'All Suggestions' : 'Your Suggestions'}</h3>

            {loading ? <div className="loading-spinner"><div className="spinner"></div></div> : suggestions.length === 0 ? (
                <div className="empty-state"><div className="empty-state-title">No suggestions yet</div></div>
            ) : (
                <div className="flex flex-col gap-4 stagger-children">
                    {suggestions.map(s => (
                        <div key={s.id} className="card-static" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                            <div className="flex items-center justify-between mb-2">
                                <h4 style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{s.title}</h4>
                                <span className={`badge ${s.status === 'reviewed' ? 'badge-success' : 'badge-warning'}`}>{s.status === 'reviewed' ? 'Reviewed' : 'Open'}</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', lineHeight: 1.6 }}>{s.text}</p>
                            <div className="flex items-center justify-between mt-4">
                                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{isAdmin && s.display_name && `By ${s.display_name} · `}{new Date(s.created_at).toLocaleDateString()}</span>
                                {isAdmin && s.status === 'open' && <button className="btn btn-success btn-sm" onClick={() => markReviewed(s.id)}>Mark Reviewed</button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
