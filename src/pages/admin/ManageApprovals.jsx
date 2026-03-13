import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ManageApprovals() {
    const { token } = useAuth();
    const [items, setItems] = useState([]);
    const [flashcards, setFlashcards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchItems();
    }, []);

    async function fetchItems() {
        try {
            // Admins get all items, so we'll filter on the frontend for pending
            const [mRes, fRes] = await Promise.all([
                fetch('/api/marketplace', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/flashcards', { headers: { Authorization: `Bearer ${token}` } })
            ]);

            if (mRes.ok) {
                const data = await mRes.json();
                setItems(data.filter(i => i.status === 'pending'));
            }
            if (fRes.ok) {
                const data = await fRes.json();
                setFlashcards(data.filter(i => i.status === 'pending'));
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleStatusMatch(id, status, type = 'marketplace') {
        if (!confirm(`Are you sure you want to ${status} this ${type} item?`)) return;
        try {
            const endpoint = type === 'marketplace' ? `/api/marketplace/${id}/status` : `/api/flashcards/${id}/status`;
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status })
            });
            if (res.ok) fetchItems();
        } catch { }
    }

    return (
        <div className="page-container flex flex-col gap-6">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Manage Approvals</h1>
                    <p className="page-subtitle">Review pending marketplace items.</p>
                </div>
            </div>

            {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
            ) : items.length === 0 && flashcards.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-title">No pending items</div>
                    <p style={{ color: 'var(--text-muted)' }}>You're all caught up!</p>
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    {items.length > 0 && (
                        <div>
                            <h2 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-xl)', fontWeight: 600 }}>Marketplace Items</h2>
                            <div className="flex flex-col gap-4">
                                {items.map(item => (
                                    <div key={item.id} className="card-static" style={{
                                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)'
                                    }}>
                                        <div className="flex items-start justify-between flex-wrap gap-4">
                                            <div>
                                                <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>{item.title}</h3>
                                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                                                    By {item.display_name} ({item.matric_no})
                                                </div>
                                                <div style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--primary)', marginTop: 'var(--space-2)' }}>
                                                    ₦{Number(item.price).toLocaleString()}
                                                </div>
                                                {item.description && (
                                                    <p style={{ fontSize: 'var(--font-sm)', marginTop: 'var(--space-2)' }}>
                                                        {item.description}
                                                    </p>
                                                )}
                                                <div style={{ fontSize: 'var(--font-sm)', marginTop: 'var(--space-2)' }}>
                                                    <strong>Contact:</strong> {item.contact_info}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button className="btn btn-ghost btn-danger" onClick={() => handleStatusMatch(item.id, 'rejected', 'marketplace')}>Reject</button>
                                                <button className="btn btn-success" onClick={() => handleStatusMatch(item.id, 'approved', 'marketplace')}>Approve</button>
                                            </div>
                                        </div>
                                        {(item.image_url_1 || item.image_url_2 || item.image_url_3) && (
                                            <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
                                                {[item.image_url_1, item.image_url_2, item.image_url_3].filter(Boolean).map((url, i) => (
                                                    <img key={i} src={url} alt="" style={{ height: '100px', borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {flashcards.length > 0 && (
                        <div>
                            <h2 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-xl)', fontWeight: 600 }}>Flashcard Decks</h2>
                            <div className="flex flex-col gap-4">
                                {flashcards.map(deck => (
                                    <div key={deck.id} className="card-static" style={{
                                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)'
                                    }}>
                                        <div className="flex items-start justify-between flex-wrap gap-4">
                                            <div>
                                                <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>{deck.title}</h3>
                                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                                                    By {deck.display_name} • {deck.cards?.length || 0} cards
                                                </div>
                                                {deck.course_code && (
                                                    <div className="badge badge-primary badge-sm mt-2">{deck.course_code}</div>
                                                )}
                                                {deck.description && (
                                                    <p style={{ fontSize: 'var(--font-sm)', marginTop: 'var(--space-2)' }}>
                                                        {deck.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button className="btn btn-ghost btn-danger" onClick={() => handleStatusMatch(deck.id, 'rejected', 'flashcard')}>Reject</button>
                                                <button className="btn btn-success" onClick={() => handleStatusMatch(deck.id, 'approved', 'flashcard')}>Approve</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
