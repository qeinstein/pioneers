import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

function daysLabel(days) {
    if (days === 0) return 'Today! 🎉';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
}

function formatDob(dob) {
    const d = new Date(dob);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export default function ManageBirthdays() {
    const { token } = useAuth();
    const [birthdays, setBirthdays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(null); // userId being uploaded
    const fileRefs = useRef({});

    useEffect(() => {
        fetchBirthdays();
    }, []);

    async function fetchBirthdays() {
        const res = await fetch('/api/admin/birthdays', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (Array.isArray(data)) setBirthdays(data);
        setLoading(false);
    }

    function downloadPic(url, name) {
        const downloadUrl = url.replace('/upload/', '/upload/fl_attachment/');
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${name}_birthday.jpg`;
        a.target = '_blank';
        a.click();
    }

    async function handleShoutoutUpload(userId, e) {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(userId);
        try {
            const formData = new FormData();
            formData.append('shoutout', file);
            const res = await fetch(`/api/admin/birthdays/${userId}/shoutout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                setBirthdays(prev => prev.map(u => u.id === userId ? { ...u, shoutout_url: data.shoutout_url } : u));
            }
        } finally {
            setUploading(null);
        }
    }

    async function handleShoutoutDelete(userId) {
        setUploading(userId);
        try {
            await fetch(`/api/admin/birthdays/${userId}/shoutout`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            setBirthdays(prev => prev.map(u => u.id === userId ? { ...u, shoutout_url: '' } : u));
        } finally {
            setUploading(null);
        }
    }

    if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;

    return (
        <div className="page-container">
            <div className="page-header animate-slide-up">
                <h1 className="page-title">Birthday Shoutouts</h1>
                <p className="page-subtitle">Download user photos, design shoutout cards, and upload them here</p>
            </div>

            {birthdays.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-title">No birthdays yet</div>
                    <div className="empty-state-text">Users need to add their date of birth in Settings.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {birthdays.map(u => (
                        <div key={u.id} className="card" style={{
                            border: u.is_today ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            background: u.is_today ? 'var(--primary-soft)' : 'var(--bg-card)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                                {/* User info */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                                    {u.birthday_pic_url ? (
                                        <img src={u.birthday_pic_url} alt="" style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', objectFit: 'cover', flexShrink: 0 }} />
                                    ) : (
                                        <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>🎂</div>
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 'var(--font-base)' }}>{u.display_name || u.matric_no}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>{u.matric_no} · {formatDob(u.dob)}</div>
                                        <span className={`badge ${u.is_today ? 'badge-primary' : 'badge-ghost'}`} style={{ marginTop: '4px', display: 'inline-block' }}>
                                            {daysLabel(u.days_until)}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flexShrink: 0 }}>
                                    {u.birthday_pic_url && (
                                        <button className="btn btn-ghost btn-sm" onClick={() => downloadPic(u.birthday_pic_url, u.display_name || u.matric_no)}>
                                            ⬇ Download Photo
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => fileRefs.current[u.id]?.click()}
                                        disabled={uploading === u.id}
                                    >
                                        {uploading === u.id ? 'Uploading...' : u.shoutout_url ? '↺ Replace Shoutout' : '⬆ Upload Shoutout'}
                                    </button>
                                    {u.shoutout_url && (
                                        <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleShoutoutDelete(u.id)} disabled={uploading === u.id}>
                                            Remove Shoutout
                                        </button>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        ref={el => fileRefs.current[u.id] = el}
                                        onChange={e => handleShoutoutUpload(u.id, e)}
                                    />
                                </div>
                            </div>

                            {/* Shoutout preview */}
                            {u.shoutout_url && (
                                <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Shoutout card (shown on dashboard)</div>
                                    <img src={u.shoutout_url} alt="Shoutout" style={{ maxWidth: '300px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
