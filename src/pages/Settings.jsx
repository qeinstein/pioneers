import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const { user, updateProfile, uploadAvatar, changePassword, darkMode, setDarkMode } = useAuth();
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const fileRef = useRef(null);

    async function handleProfileSave() {
        setSaving(true); setMsg(''); setError('');
        try { await updateProfile({ display_name: displayName, bio }); setMsg('Profile updated'); }
        catch (err) { setError(err.message); }
        finally { setSaving(false); }
    }

    async function handleAvatarChange(e) {
        const file = e.target.files[0]; if (!file) return;
        setMsg(''); setError('');
        try { await uploadAvatar(file); setMsg('Avatar updated'); } catch { setError('Failed to upload avatar'); }
    }

    async function handlePasswordSave() {
        setMsg(''); setError('');
        if (newPass !== confirmPass) { setError('Passwords do not match'); return; }
        if (newPass.length < 4) { setError('Password must be at least 4 characters'); return; }
        setSaving(true);
        try { await changePassword(currentPass, newPass); setMsg('Password changed'); setCurrentPass(''); setNewPass(''); setConfirmPass(''); }
        catch (err) { setError(err.message); }
        finally { setSaving(false); }
    }

    return (
        <div className="page-container">
            <div className="page-header animate-slide-up">
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">Customize your profile and preferences</p>
            </div>

            {msg && <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--success-soft)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>{msg}</div>}
            {error && <div className="animate-shake" style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--error-soft)', color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>{error}</div>}

            <div className="card-static mb-6 animate-slide-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-base)' }}>Appearance</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>Dark Mode</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>Toggle between dark and light themes</div>
                    </div>
                    <button onClick={() => setDarkMode(!darkMode)} className="btn btn-ghost btn-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</button>
                </div>
            </div>

            <div className="card-static mb-6 animate-slide-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', animationDelay: '100ms' }}>
                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-base)' }}>Profile</h3>
                <div className="flex items-center gap-4 mb-6">
                    <div className="avatar avatar-xl" style={{ cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
                        {user?.profile_pic_url ? <img src={user.profile_pic_url} alt="" /> : (user?.display_name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>Change Avatar</button>
                        <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-1)' }}>Max 5MB. JPG, PNG, or GIF.</p>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Display Name</label>
                    <input className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" />
                </div>
                <div className="form-group">
                    <label className="form-label">Bio</label>
                    <textarea className="form-textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell others about yourself..." />
                </div>
                <button className="btn btn-primary" onClick={handleProfileSave} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
            </div>

            <div className="card-static animate-slide-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', animationDelay: '200ms' }}>
                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-base)' }}>Change Password</h3>
                <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <input className="form-input" type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input className="form-input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="At least 4 characters" />
                </div>
                <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <input className="form-input" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={handlePasswordSave} disabled={saving}>{saving ? 'Changing...' : 'Change Password'}</button>
            </div>
        </div>
    );
}
