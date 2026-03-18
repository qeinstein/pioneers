import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import QuizCard from '../components/QuizCard';

function ShoutoutModal({ person, onClose }) {
    if (!person) return null;
    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-card-solid)', borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--glass-shadow)', maxWidth: '480px', width: '100%',
                overflow: 'hidden', animation: 'slideDown 0.2s ease',
            }}>
                <img src={person.shoutout_url} alt="Birthday Shoutout" style={{ width: '100%', display: 'block' }} />
                <div style={{ padding: 'var(--space-5)' }}>
                    <div style={{ fontWeight: 800, fontSize: 'var(--font-xl)', marginBottom: 'var(--space-1)' }}>
                        🎉 {person.display_name || person.matric_no}
                    </div>
                    {person.is_today && (
                        <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 'var(--font-sm)', marginBottom: 'var(--space-3)' }}>
                            Happy Birthday! 🎂
                        </div>
                    )}
                    {!person.is_today && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-3)' }}>
                            Birthday in {person.days_until} day{person.days_until !== 1 ? 's' : ''}
                        </div>
                    )}
                    {(person.instagram || person.twitter) && (
                        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
                            {person.instagram && (() => {
                                const handle = person.instagram.startsWith('@') ? person.instagram.slice(1) : person.instagram;
                                return (
                                    <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', textDecoration: 'none' }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                                        @{handle}
                                    </a>
                                );
                            })()}
                            {person.twitter && (() => {
                                const handle = person.twitter.startsWith('@') ? person.twitter.slice(1) : person.twitter;
                                return (
                                    <a href={`https://x.com/${handle}`} target="_blank" rel="noopener noreferrer"
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', textDecoration: 'none' }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                        @{handle}
                                    </a>
                                );
                            })()}
                        </div>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginTop: 'var(--space-4)', width: '100%' }}>Close</button>
                </div>
            </div>
        </div>
    );
}

function BirthdayShoutouts({ token, currentUserId, currentProfile }) {
    const [birthdays, setBirthdays] = useState([]);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        fetch('/api/admin/shoutouts', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(shoutouts => {
                if (!Array.isArray(shoutouts)) return;
                // Append current user's own shoutout if not already in the list
                if (currentProfile?.shoutout_url && !shoutouts.find(u => u.id === currentUserId)) {
                    const bday = new Date(currentProfile.dob);
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    let next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
                    if (next < today) next = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
                    const daysUntil = Math.round((next - today) / (1000 * 60 * 60 * 24));
                    shoutouts = [...shoutouts, { ...currentProfile, days_until: daysUntil, is_today: daysUntil === 0 }];
                }
                setBirthdays(shoutouts);
            }).catch(() => {});
    }, []);

    if (birthdays.length === 0) return null;

    return (
        <>
            <div className="card-static animate-slide-up" style={{
                marginBottom: 'var(--space-8)', padding: 'var(--space-5)',
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)',
            }}>
                <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>🎂 Birthday Shoutouts</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {birthdays.map(u => (
                        <div key={u.id} onClick={() => setSelected(u)} style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)',
                            background: u.is_today ? 'var(--primary-soft)' : 'var(--bg-input)',
                            border: u.is_today ? '1px solid var(--primary)' : '1px solid transparent',
                            cursor: 'pointer', transition: 'opacity 0.15s',
                        }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                            <img src={u.shoutout_url} alt="" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>
                                    {u.is_today ? `🎉 Happy Birthday, ${u.display_name || u.matric_no}!` : (u.display_name || u.matric_no)}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>
                                    {u.is_today ? 'Tap to view shoutout' : `Birthday in ${u.days_until} day${u.days_until !== 1 ? 's' : ''} · Tap to view`}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <ShoutoutModal person={selected} onClose={() => setSelected(null)} />
        </>
    );
}

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
                            <video src="/streak-fire.webm" autoPlay loop muted playsInline style={{ width: '64px', height: '64px', objectFit: 'cover', filter: 'drop-shadow(0 0 10px rgba(255,120,0,0.9))' }} />
                            <span className="streak-number">{stats.streak.current_streak}</span>
                            <span className="streak-label">day streak!</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Birthday Shoutouts */}
            <BirthdayShoutouts token={token} currentUserId={user?.id} currentProfile={stats} />

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

