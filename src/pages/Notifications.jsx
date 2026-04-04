import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Notifications() {
    const { token, unreadCount, markAllRead, refreshNotifications, updateToken } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/notifications?limit=50', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => setNotifications(data.notifications || []))
            .finally(() => setLoading(false));
    }, [token]);

    async function handleMarkRead(id) {
        if (id === 'all') {
            await markAllRead?.();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            refreshNotifications?.();
        } else {
            await fetch(`/api/notifications/${id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
            refreshNotifications?.();
        }
    }

    async function handleRoleAction(notif, action) {
        if (!notif.reference_id) return;
        try {
            const res = await fetch(`/api/auth/pending-actions/${notif.reference_id}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action }),
            });
            if (res.ok) {
                const data = await res.json();
                // Mark the notification as read so the buttons disappear
                await handleMarkRead(notif.id);
                // The new token is handled by RoleActionChecker usually, but here they can just refresh to see admin features
                if (action === 'accept') {
                    if (data.token) updateToken(data.token);
                    window.location.reload(); // Quick way to grant admin UI immediately
                }
            }
        } catch (err) {
            console.error('Failed to respond to role action', err);
        }
    }

    // Function to render text and highlight @username tags in notification messages
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
            <div className="page-header animate-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">Notifications</h1>
                    <p className="page-subtitle">Stay updated on tags, quizzes, and promotions.</p>
                </div>
                {unreadCount > 0 && (
                    <button className="btn btn-ghost" onClick={() => handleMarkRead('all')}>
                        Mark all as read
                    </button>
                )}
            </div>

            <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}><div className="spinner"></div></div>
                ) : notifications.length === 0 ? (
                    <div className="card-static" style={{
                        background: 'var(--bg-card)', border: '1px dashed var(--border-color)',
                        borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)'
                    }}>
                        You have no notifications yet.
                    </div>
                ) : (
                    notifications.map((notif, idx) => (
                        <div key={notif.id} className="card-static" style={{
                            background: notif.is_read ? 'var(--bg-card)' : 'var(--primary-soft)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)',
                            opacity: notif.is_read ? 0.7 : 1,
                            animationDelay: `${idx * 50}ms`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                        }}>
                            <div>
                                <div style={{ fontWeight: notif.is_read ? 500 : 700, fontSize: 'var(--font-base)', marginBottom: 'var(--space-1)' }}>
                                    {renderWithTags(notif.message)}
                                </div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                                    {new Date(notif.created_at).toLocaleString()}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {notif.type === 'role_promotion' && !notif.is_read && notif.reference_id && (
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleRoleAction(notif, 'accept')}>
                                            Accept
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleRoleAction(notif, 'decline')}>
                                            Decline
                                        </button>
                                    </div>
                                )}
                                {!notif.is_read && notif.type !== 'role_promotion' && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleMarkRead(notif.id)}>
                                        Mark read
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div >
    );
}
