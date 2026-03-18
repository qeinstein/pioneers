import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// SVG Icons as inline components
const Icons = {
    dashboard: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
    quiz: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>,
    create: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>,
    live: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
    leaderboard: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>,
    feedback: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
    admin: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
    users: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    courses: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
    quizManage: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>,
    bell: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>,
    sun: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>,
    moon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>,
    collapse: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>,
    expand: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>,
    menu: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
    marketplace: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>,
    check: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
    flashcards: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M3 9h18"></path><path d="M9 21V9"></path></svg>,
    directory: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    vote: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" /><path d="m9 12 2 2 4-4" /><path d="M17 21l2-2 2 2" /><path d="M19 17v4" /></svg>,
};

export default function Sidebar() {
    const { user, isAdmin, logout, darkMode, setDarkMode } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved === 'true';
    });
    const [unreadCount, setUnreadCount] = useState(0);
    const [profileOpen, setProfileOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const profileRef = useRef(null);
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setMobileOpen(false);
        setProfileOpen(false);
    }, [location]);

    useEffect(() => {
        function handleClick(e) {
            if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    function toggleCollapse() {
        const next = !collapsed;
        setCollapsed(next);
        localStorage.setItem('sidebarCollapsed', String(next));
    }

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



    const isActive = (path) => location.pathname === path;

    const mainLinks = [
        { to: '/', label: 'Dashboard', icon: Icons.dashboard },
        { to: '/directory', label: 'Directory', icon: Icons.directory },
    ];

    const quizLinks = [
        { to: '/quiz-bank', label: 'Quiz Bank', icon: Icons.quiz },
        { to: '/create-quiz', label: 'Create Quiz', icon: Icons.create },
        { to: '/live/join', label: 'Live Quiz', icon: Icons.live },
        { to: '/leaderboard', label: 'Leaderboard', icon: Icons.leaderboard },
    ];

    const resourcesLinks = [
        { to: '/flashcards', label: 'Flashcards', icon: Icons.flashcards },
        { to: '/marketplace', label: 'Marketplace', icon: Icons.marketplace },
    ];

    const communityLinks = [
        { to: '/suggestions', label: 'Feedback', icon: Icons.feedback },
        { to: '/voting', label: 'Voting', icon: Icons.vote },
    ];

    const adminLinks = [
        { to: '/admin', label: 'Overview', icon: Icons.admin },
        { to: '/admin/users', label: 'Users', icon: Icons.users },
        { to: '/admin/courses', label: 'Courses', icon: Icons.courses },
        { to: '/admin/quizzes', label: 'Quizzes', icon: Icons.quizManage },
        { to: '/admin/approvals', label: 'Approvals', icon: Icons.check },
        { to: '/admin/birthdays', label: 'Birthdays', icon: Icons.bell },
    ];

    const initials = (user?.display_name || user?.matric_no || '?').slice(0, 2).toUpperCase();

    function renderLinks(links) {
        return links.map(l => (
            <Link key={l.to} to={l.to} className={`sidebar-link ${isActive(l.to) ? 'active' : ''}`}>
                <span className="sidebar-link-icon">{l.icon}</span>
                <span className="sidebar-link-label">{l.label}</span>
            </Link>
        ));
    }

    return (
        <>
            {/* Mobile topbar */}
            <div className="mobile-topbar">
                <button onClick={() => setMobileOpen(true)} style={{
                    background: 'none', border: 'none', color: 'var(--text-primary)',
                    cursor: 'pointer', padding: 'var(--space-2)', display: 'flex', width: '40px', height: '40px', alignItems: 'center', justifyContent: 'center'
                }}>
                    {Icons.menu}
                </button>
                <span className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/logo.png" alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0 }} />
                    <span><span className="sidebar-brand-accent">P</span>ioneers</span>
                </span>
                <div style={{ width: '40px' }}></div>
            </div>

            {/* Overlay */}
            <div className={`sidebar-overlay ${mobileOpen ? 'show' : ''}`} onClick={() => setMobileOpen(false)} />

            {/* Sidebar */}
            <aside className={`sidebar ${mobileOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
                {/* Collapse toggle for desktop, absolute positioned at the right edge */}
                <button onClick={toggleCollapse} className="sidebar-toggle desktop-collapse-btn" title={collapsed ? 'Expand' : 'Collapse'}
                    style={{ position: 'absolute', top: '18px', right: '-14px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '28px', height: '28px', zIndex: 110, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', width: '16px', height: '16px', alignItems: 'center', justifyContent: 'center' }}>
                        {collapsed ? Icons.expand : Icons.collapse}
                    </div>
                </button>

                <div className="sidebar-header">
                    <span className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0 }} />
                        <span><span className="sidebar-brand-accent">P</span>ioneers</span>
                    </span>
                    <div className="sidebar-header-actions">
                        {/* Theme toggle */}
                        <button onClick={() => setDarkMode(!darkMode)} className="sidebar-icon-btn" title={darkMode ? 'Light mode' : 'Dark mode'}>
                            {darkMode ? Icons.sun : Icons.moon}
                        </button>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Main</div>
                        {renderLinks(mainLinks)}
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Quizzes</div>
                        {renderLinks(quizLinks)}
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Resources</div>
                        {renderLinks(resourcesLinks)}
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Community</div>
                        {renderLinks(communityLinks)}
                        <Link to="/notifications" className={`sidebar-link ${isActive('/notifications') ? 'active' : ''}`}>
                            <span className="sidebar-link-icon" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '18px', height: '18px', display: 'flex' }}>
                                    {Icons.bell}
                                </div>
                                {unreadCount > 0 && <span className="notif-indicator" style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', background: 'var(--error)', borderRadius: '50%' }}></span>}
                            </span>
                            <span className="sidebar-link-label" style={{ flex: 1, textAlign: 'left' }}>Notifications</span>
                            {!collapsed && unreadCount > 0 && <span style={{ background: 'var(--error)', color: 'white', borderRadius: '10px', padding: '0 6px', fontSize: '10px', fontWeight: 600 }}>{unreadCount}</span>}
                        </Link>
                    </div>

                    {isAdmin && (
                        <div className="sidebar-section">
                            <div className="sidebar-section-title">Administration</div>
                            {renderLinks(adminLinks)}
                        </div>
                    )}
                </nav>

                <div className="sidebar-footer">

                    <div ref={profileRef} style={{ position: 'relative' }}>
                        <div className="sidebar-profile" onClick={() => setProfileOpen(!profileOpen)}>
                            <div className="avatar avatar-sm">
                                {user?.profile_pic_url ? <img src={user.profile_pic_url} alt="" /> : initials}
                            </div>
                            <div className="sidebar-profile-info" style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {user?.display_name || user?.matric_no}
                                </div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{user?.matric_no}</div>
                            </div>
                        </div>

                        {profileOpen && (
                            <div style={{
                                position: 'absolute', bottom: '100%', left: 0, right: 0,
                                background: 'var(--bg-card-solid)', border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--glass-shadow)',
                                marginBottom: 'var(--space-2)', overflow: 'hidden',
                                animation: 'slideUp 0.15s ease', zIndex: 200,
                            }}>
                                {[
                                    { label: 'My Profile', action: () => navigate('/profile') },
                                    { label: 'Settings', action: () => navigate('/settings') },
                                    { label: 'Sign Out', action: logout },
                                ].map(item => (
                                    <div key={item.label} onClick={item.action} style={{
                                        padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--font-sm)',
                                        cursor: 'pointer', color: 'var(--text-secondary)',
                                        transition: 'background var(--transition-fast)',
                                    }} onMouseEnter={e => e.target.style.background = 'var(--bg-card-hover)'}
                                        onMouseLeave={e => e.target.style.background = 'transparent'}
                                    >{item.label}</div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}
