import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Marketplace() {
    const { token, user } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [imageFiles, setImageFiles] = useState([null, null, null]);
    const [imagePreviews, setImagePreviews] = useState([null, null, null]);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        fetchItems();
    }, []);

    async function fetchItems() {
        try {
            const res = await fetch('/api/marketplace', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setItems(await res.json());
        } finally {
            setLoading(false);
        }
    }

    function handleFileChange(index, file) {
        if (!file) return;
        const newFiles = [...imageFiles];
        newFiles[index] = file;
        setImageFiles(newFiles);

        // Generate preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const newPreviews = [...imagePreviews];
            newPreviews[index] = e.target.result;
            setImagePreviews(newPreviews);
        };
        reader.readAsDataURL(file);
    }

    function removeImage(index) {
        const newFiles = [...imageFiles];
        const newPreviews = [...imagePreviews];
        newFiles[index] = null;
        newPreviews[index] = null;
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setMsg('');

        try {
            let imageUrls = [null, null, null];

            // Upload images if any files selected
            const filesToUpload = imageFiles.filter(Boolean);
            if (filesToUpload.length > 0) {
                setUploading(true);
                const formData = new FormData();
                filesToUpload.forEach(f => formData.append('images', f));

                const uploadRes = await fetch('/api/marketplace/upload', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData
                });

                if (!uploadRes.ok) {
                    const err = await uploadRes.json();
                    setMsg(err.error || 'Image upload failed');
                    setSubmitting(false);
                    setUploading(false);
                    return;
                }

                const { urls } = await uploadRes.json();
                // Map uploaded URLs back to correct positions
                let urlIdx = 0;
                for (let i = 0; i < 3; i++) {
                    if (imageFiles[i] && urlIdx < urls.length) {
                        imageUrls[i] = urls[urlIdx++];
                    }
                }
                setUploading(false);
            }

            const res = await fetch('/api/marketplace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    title, description, price, contact_info: contactInfo,
                    image_url_1: imageUrls[0], image_url_2: imageUrls[1], image_url_3: imageUrls[2]
                })
            });

            if (res.ok) {
                setMsg('Item submitted for approval!');
                setTitle(''); setDescription(''); setPrice(''); setContactInfo('');
                setImageFiles([null, null, null]);
                setImagePreviews([null, null, null]);
                setShowForm(false);
                fetchItems();
            } else {
                const data = await res.json();
                setMsg(data.error || 'Failed to submit item');
            }
        } catch {
            setMsg('Failed to connect to server');
        } finally {
            setSubmitting(false);
            setUploading(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this item?')) return;
        try {
            const res = await fetch(`/api/marketplace/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) fetchItems();
        } catch { }
    }

    return (
        <div className="page-container flex flex-col gap-6">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Marketplace</h1>
                    <p className="page-subtitle">Buy, sell, and trade items with the community.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancel' : 'Post an Item'}
                </button>
            </div>

            {msg && <div className="badge badge-success" style={{ padding: 'var(--space-3)' }}>{msg}</div>}

            {showForm && (
                <div className="card-static animate-scale-in" style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)'
                }}>
                    <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>List a New Item</h2>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 300px' }}>
                                <label className="form-label">Title *</label>
                                <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g., Organic Chemistry Textbook" />
                            </div>
                            <div style={{ flex: '1 1 150px' }}>
                                <label className="form-label">Price *</label>
                                <input type="number" step="0.01" className="form-input" value={price} onChange={e => setPrice(e.target.value)} required placeholder="e.g., 50.00" />
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe the item condition, details..." />
                        </div>

                        <div>
                            <label className="form-label">Contact Info *</label>
                            <input type="text" className="form-input" value={contactInfo} onChange={e => setContactInfo(e.target.value)} required placeholder="Phone number, email, or social handle" />
                        </div>

                        <div>
                            <label className="form-label">Photos (up to 3) — auto-compressed</label>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                                {[0, 1, 2].map(i => (
                                    <div key={i} style={{
                                        width: '140px', height: '140px', borderRadius: 'var(--radius-lg)',
                                        border: '2px dashed var(--border-color)', overflow: 'hidden',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        position: 'relative', cursor: 'pointer',
                                        background: imagePreviews[i] ? 'transparent' : 'var(--bg-input)',
                                        transition: 'border-color 0.2s'
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                    >
                                        {imagePreviews[i] ? (
                                            <>
                                                <img src={imagePreviews[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                                                    style={{
                                                        position: 'absolute', top: '4px', right: '4px',
                                                        background: 'rgba(0,0,0,0.7)', color: 'white',
                                                        border: 'none', borderRadius: '50%', width: '24px', height: '24px',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '14px', lineHeight: 1
                                                    }}>×</button>
                                            </>
                                        ) : (
                                            <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                    <polyline points="21 15 16 10 5 21"></polyline>
                                                </svg>
                                                <span>Photo {i + 1}</span>
                                                <input type="file" accept="image/*" style={{ display: 'none' }}
                                                    onChange={e => handleFileChange(i, e.target.files[0])} />
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end mt-2">
                            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                                {uploading ? '📤 Uploading images...' : submitting ? 'Submitting...' : 'Submit for Approval'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
            ) : items.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🛍️</div>
                    <div className="empty-state-title">No items found</div>
                    <p style={{ color: 'var(--text-muted)' }}>Check back later or post an item!</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                    {items.map(item => (
                        <div key={item.id} className="card-static flex flex-col gap-3" style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)',
                            position: 'relative'
                        }}>
                            {item.status !== 'approved' && (
                                <span className={`badge ${item.status === 'pending' ? 'badge-warning' : 'badge-danger'}`} style={{ position: 'absolute', top: '10px', right: '10px' }}>
                                    {item.status.toUpperCase()}
                                </span>
                            )}

                            {(item.image_url_1 || item.image_url_2 || item.image_url_3) && (
                                <div style={{ height: '160px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-input)', overflow: 'hidden', display: 'flex' }}>
                                    {[item.image_url_1, item.image_url_2, item.image_url_3].filter(Boolean).map((url, i) => (
                                        <img key={i} src={url} alt="" style={{ flex: 1, objectFit: 'cover', height: '100%' }} />
                                    ))}
                                </div>
                            )}

                            <div>
                                <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>{item.title}</h3>
                                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                                    By {item.display_name || item.matric_no}
                                </div>
                            </div>

                            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                                ₦{Number(item.price).toLocaleString()}
                            </div>

                            {item.description && (
                                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {item.description}
                                </p>
                            )}

                            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>Contact</div>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{item.contact_info}</div>
                            </div>

                            {(user.id === item.user_id || user.role === 'admin') && (
                                <button className="btn btn-ghost btn-danger btn-sm" style={{ alignSelf: 'flex-start', marginTop: 'var(--space-2)' }} onClick={() => handleDelete(item.id)}>
                                    Delete
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
