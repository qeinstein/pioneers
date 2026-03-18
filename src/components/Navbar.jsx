import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { user, isAdmin, logout, darkMode, setDarkMode } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [profileOpen, setProfileOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const notifRef = useRef(null);
    const profileRef = useRef(null);
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setMobileMenuOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
    }, [location]);

    useEffect(() => {
        function handleClick(e) {
            if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
            if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    async function fetchNotifications() {
        try {
            const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications.slice(0, 10));
                setUnreadCount(data.unread_count);
            }
        } catch { }
    }

    async function markAllRead() {
        try {
            await fetch('/api/notifications/read-all', { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        } catch { }
    }

    const navLinks = [
        { to: '/', label: '🏠 Home' },
        { to: '/quiz-bank', label: '📚 Quiz Bank' },
        { to: '/leaderboard', label: '🏆 Leaderboard' },
        { to: '/create-quiz', label: '➕ Create Quiz' },
        { to: '/suggestions', label: '💡 Feedback' },
    ];
    if (isAdmin) navLinks.push({ to: '/admin', label: '⚙️ Admin' });

    const initials = (user?.display_name || user?.matric_no || '?').slice(0, 2).toUpperCase();

    return (
        <nav style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--navbar-height)',
            background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--glass-border)', zIndex: 100,
            display: 'flex', alignItems: 'center', padding: '0 var(--space-4)',
        }}>
            <img src="/logo.png" alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '8px', marginRight: 'var(--space-2)' }} />
            <Link to="/" style={{
                fontWeight: 800, fontSize: 'var(--font-xl)', color: 'var(--text-primary)',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginRight: 'auto',
                textDecoration: 'none'
            }}>
                Pioneers
            </Link>

            {/* Desktop nav */}
            <div className="flex items-center gap-1" style={{ display: 'none' }} id="desktop-nav">
                {navLinks.map(l => (
                    <Link key={l.to} to={l.to} style={{
                        padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-sm)', fontWeight: 500, textDecoration: 'none',
                        color: location.pathname === l.to ? 'var(--primary)' : 'var(--text-secondary)',
                        background: location.pathname === l.to ? 'var(--primary-soft)' : 'transparent',
                    }}>{l.label}</Link>
                ))}
            </div>

            <div className="flex items-center gap-3" style={{ marginLeft: 'var(--space-4)' }}>
                {/* Dark mode toggle */}
                <button onClick={() => setDarkMode(!darkMode)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem',
                    color: 'var(--text-secondary)', padding: 'var(--space-2)',
                }}>
                    {darkMode ? '☀️' : '🌙'}
                </button>

                {/* Notifications */}
                <div ref={notifRef} className="notif-bell" onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) markAllRead(); }}>
                    <span style={{ fontSize: '1.2rem' }}>🔔</span>
                    {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}

                    {notifOpen && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0, width: '320px',
                            background: 'var(--bg-card-solid)', border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-xl)', boxShadow: 'var(--glass-shadow)',
                            marginTop: 'var(--space-2)', overflow: 'hidden',
                            animation: 'slideDown 0.2s ease',
                        }}>
                            <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                                Notifications
                            </div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                                        No notifications yet
                                    </div>
                                ) : notifications.map(n => (
                                    <div key={n.id} style={{
                                        padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-color)',
                                        fontSize: 'var(--font-sm)', opacity: n.is_read ? 0.6 : 1,
                                        background: n.is_read ? 'transparent' : 'var(--primary-soft)',
                                        cursor: 'pointer'
                                    }} onClick={() => { setNotifOpen(false); navigate('/notifications'); }}>
                                        <div>{n.message}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: '2px' }}>
                                            {new Date(n.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Profile dropdown */}
                <div ref={profileRef} style={{ position: 'relative' }}>
                    <div className="avatar avatar-sm" style={{ cursor: 'pointer' }} onClick={() => setProfileOpen(!profileOpen)}>
                        {user?.profile_pic_url ? <img src={user.profile_pic_url} alt="" /> : initials}
                    </div>
                    {profileOpen && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0, width: '200px',
                            background: 'var(--bg-card-solid)', border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--glass-shadow)',
                            marginTop: 'var(--space-2)', overflow: 'hidden',
                            animation: 'slideDown 0.2s ease',
                        }}>
                            <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{user?.display_name || user?.matric_no}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>{user?.matric_no}</div>
                            </div>
                            {[
                                { label: '👤 My Profile', action: () => navigate('/profile') },
                                { label: '⚙️ Settings', action: () => navigate('/settings') },
                                { label: '🚪 Logout', action: logout },
                            ].map(item => (
                                <div key={item.label} onClick={item.action} style={{
                                    padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-sm)',
                                    cursor: 'pointer', color: 'var(--text-secondary)',
                                    borderBottom: '1px solid var(--border-color)',
                                }} onMouseEnter={e => e.target.style.background = 'var(--bg-card)'}
                                    onMouseLeave={e => e.target.style.background = 'transparent'}
                                >{item.label}</div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mobile hamburger */}
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem',
                    color: 'var(--text-primary)', display: 'none', padding: 'var(--space-2)',
                }} id="mobile-menu-btn">
                    {mobileMenuOpen ? '✕' : '☰'}
                </button>
            </div>

            {/* Mobile menu */}
            {mobileMenuOpen && (
                <div style={{
                    position: 'absolute', top: 'var(--navbar-height)', left: 0, right: 0,
                    background: 'var(--bg-card-solid)', borderBottom: '1px solid var(--glass-border)',
                    padding: 'var(--space-2)', animation: 'slideDown 0.2s ease',
                }}>
                    {navLinks.map(l => (
                        <Link key={l.to} to={l.to} style={{
                            display: 'block', padding: 'var(--space-3) var(--space-4)',
                            borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', fontWeight: 500,
                            textDecoration: 'none',
                            color: location.pathname === l.to ? 'var(--primary)' : 'var(--text-secondary)',
                            background: location.pathname === l.to ? 'var(--primary-soft)' : 'transparent',
                        }}>{l.label}</Link>
                    ))}
                </div>
            )}

            <style>{`
        @media (min-width: 769px) {
          #desktop-nav { display: flex !important; }
          #mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 768px) {
          #desktop-nav { display: none !important; }
          #mobile-menu-btn { display: block !important; }
        }
      `}</style>
        </nav>
    );
}
