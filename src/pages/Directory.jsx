import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ProfilePopup from '../components/ProfilePopup';
import { getTotalPages, parsePaginatedResponse } from '../utils/pagination';

export default function Directory() {
    const { token } = useAuth();
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 24;

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers();
        }, 250);
        return () => clearTimeout(timer);
    }, [token, search, page]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    async function fetchUsers() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pageSize),
            });
            if (search.trim()) params.set('search', search.trim());

            const response = await fetch(`/api/auth/users?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const { items, total: totalItems } = await parsePaginatedResponse(response);
            setUsers(items);
            setTotal(totalItems);
        } catch {
            setUsers([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }

    const totalPages = getTotalPages(total, pageSize);

    return (
        <div className="page-container flex flex-col gap-6">
            <div className="page-header animate-slide-up">
                <div>
                    <h1 className="page-title">Directory</h1>
                    <p className="page-subtitle">Discover and connect with your course mates.</p>
                </div>
            </div>

            <div className="filter-bar animate-slide-up" style={{ animationDelay: '100ms' }}>
                <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
                    <span className="search-bar-icon">Q</span>
                    <input
                        placeholder="Search by name, matric no, or bio..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
            ) : users.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <div className="empty-state-title">No users found</div>
                    <p style={{ color: 'var(--text-muted)' }}>Try a different search term.</p>
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
                        {users.map((u, i) => (
                            <div
                                key={u.id}
                                className="card-static animate-slide-up flex flex-col items-center text-center gap-3"
                                style={{
                                    animationDelay: `${(i % 10) * 50}ms`,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-xl)',
                                    padding: 'var(--space-6)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = 'var(--glass-shadow-hover)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                                onClick={() => setSelectedUserId(u.id)}
                            >
                                <div className="avatar" style={{ width: '80px', height: '80px', fontSize: 'var(--font-xl)' }}>
                                    {u.profile_pic_url ? <img src={u.profile_pic_url} alt="" /> : (u.display_name || u.matric_no).slice(0, 2).toUpperCase()}
                                </div>

                                <div style={{ marginTop: 'var(--space-2)' }}>
                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-lg)', color: 'var(--text-primary)' }}>
                                        {u.display_name || u.matric_no}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                                        {u.matric_no}
                                    </div>
                                </div>

                                {u.role === 'admin' && (
                                    <div className="badge badge-primary badge-sm" style={{ alignSelf: 'center' }}>Admin</div>
                                )}

                                {u.bio && (
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        "{u.bio}"
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-4)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                                Previous
                            </button>
                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                                Page {page} of {totalPages}
                            </span>
                            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {selectedUserId && (
                <ProfilePopup userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
            )}
        </div>
    );
}
