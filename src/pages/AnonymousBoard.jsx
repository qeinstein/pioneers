import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AnonymousBoard() {
    const { token } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchMessages();
    }, []);

    async function fetchMessages() {
        try {
            const res = await fetch('/api/anonymous', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setMessages(data.messages);
        } catch (err) {
            console.error('Fetch anonymous messages error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/anonymous', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ content: newMessage })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to post message');

            setSuccess('Message posted anonymously!');
            setNewMessage('');
            fetchMessages(); // Refresh feed

            // clear success msg after 3s
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    // Function to render text and highlight @username tags
    const renderWithTags = (text) => {
        const parts = text.split(/(@\w+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return <span key={i} style={{ color: 'var(--primary)', fontWeight: 600 }}>{part}</span>;
            }
            return part; // keep normal text as string
        });
    };

    return (
        <div className="page-container">
            <div className="page-header animate-slide-up">
                <h1 className="page-title">Anonymous Board</h1>
                <p className="page-subtitle">Share your thoughts anonymously with the community.</p>
            </div>

            <div className="card-static mb-6 animate-slide-up" style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)'
            }}>
                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-2)', fontSize: 'var(--font-base)' }}>
                    Post a Message
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                    Tip: You can tag other users by typing <code style={{
                        background: 'var(--bg-secondary)', padding: '2px 6px',
                        borderRadius: '4px', color: 'var(--primary)'
                    }}>@username</code>. They will receive a notification but won't know it was you!
                </p>

                {error && (
                    <div className="animate-shake" style={{
                        padding: 'var(--space-3) var(--space-4)', background: 'var(--error-soft)',
                        color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)'
                    }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div className="animate-slide-up" style={{
                        padding: 'var(--space-3) var(--space-4)', background: 'var(--success-soft)',
                        color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)'
                    }}>
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <textarea
                        className="form-textarea"
                        placeholder="What's on your mind?..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        style={{ minHeight: '100px', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn btn-primary" disabled={submitting || !newMessage.trim()}>
                            {submitting ? 'Posting...' : 'Post Anonymously'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}><div className="spinner"></div></div>
                ) : messages.length === 0 ? (
                    <div className="card-static" style={{
                        background: 'var(--bg-card)', border: '1px dashed var(--border-color)',
                        borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)'
                    }}>
                        No messages yet. Be the first to spark a conversation!
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={msg.id} className="card-static" style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)',
                            animationDelay: `${idx * 50}ms`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--bg-secondary), var(--border-color))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'
                                }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>Anonymous</div>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                                        {new Date(msg.created_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 'var(--font-base)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {renderWithTags(msg.content)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div >
    );
}
