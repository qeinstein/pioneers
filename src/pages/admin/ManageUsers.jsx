import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ManageUsers() {
    const { token } = useAuth();
    const [users, setUsers] = useState([]);
    const [matrics, setMatrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('users');
    const [addMode, setAddMode] = useState('single');
    const [singleMatric, setSingleMatric] = useState('');
    const [prefix, setPrefix] = useState('CSC/2023/');
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [msg, setMsg] = useState('');

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/admin/allowed-matrics', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([u, m]) => { setUsers(u); setMatrics(m); }).finally(() => setLoading(false));
    }, []);

    async function changeRole(userId, newRole) {
        setMsg('');
        const res = await fetch(`/api/admin/users/${userId}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ role: newRole }) });
        const data = await res.json();

        if (data.status === 'Pending') {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, pending_admin: true } : u));
            setMsg(`Invitation sent to ${data.user || 'user'}. They must accept it to become an Admin.`);
        } else {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            setMsg(`Role updated to ${newRole}.`);
        }
    }

    async function resetPassword(userId) {
        await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        setMsg('Password reset to default');
    }

    async function addMatric() {
        setMsg('');
        const body = addMode === 'single' ? { matric_no: singleMatric } : { prefix, range_start: parseInt(rangeStart), range_end: parseInt(rangeEnd) };
        const res = await fetch('/api/admin/allowed-matrics', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
        const data = await res.json();
        setMsg(data.message); setSingleMatric(''); setRangeStart(''); setRangeEnd('');
        const m = await fetch('/api/admin/allowed-matrics', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
        setMatrics(m);
    }

    async function removeMatric(id) {
        await fetch(`/api/admin/allowed-matrics/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        setMatrics(prev => prev.filter(m => m.id !== id));
    }

    if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;

    return (
        <div className="page-container">
            <Link to="/admin" className="back-link">Back to Admin</Link>
            <div className="page-header animate-slide-up"><h1 className="page-title">Manage Users</h1></div>

            <div className="tabs mb-6" style={{ maxWidth: '400px' }}>
                <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Registered Users</button>
                <button className={`tab ${tab === 'whitelist' ? 'active' : ''}`} onClick={() => setTab('whitelist')}>Matric Whitelist</button>
            </div>

            {msg && <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--success-soft)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>{msg}</div>}

            {tab === 'users' ? (
                <div className="table-container animate-slide-up">
                    <table className="table">
                        <thead><tr><th>User</th><th>Role</th><th>Attempts</th><th>Joined</th><th>Actions</th></tr></thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{u.display_name || u.matric_no}</div>
                                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{u.matric_no}</div>
                                    </td>
                                    <td><span className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-info'}`}>{u.role}</span></td>
                                    <td style={{ fontSize: 'var(--font-sm)' }}>{u.quiz_attempts}</td>
                                    <td style={{ fontSize: 'var(--font-xs)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className="flex gap-2">
                                            {u.role === 'student' && !u.pending_admin ? (
                                                <button className="btn btn-ghost btn-sm" onClick={() => changeRole(u.id, 'admin')}>Promote</button>
                                            ) : u.pending_admin ? (
                                                <span className="badge badge-warning">Pending Invite</span>
                                            ) : u.matric_no !== '240805099' && (
                                                <button className="btn btn-danger btn-sm" onClick={() => changeRole(u.id, 'student')}>Demote</button>
                                            )}
                                            <button className="btn btn-ghost btn-sm" onClick={() => resetPassword(u.id)}>Reset Pass</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="animate-slide-up">
                    <div className="card-static mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                        <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-sm)' }}>Add Matric Numbers</h3>
                        <div className="tabs mb-4" style={{ maxWidth: '300px' }}>
                            <button className={`tab ${addMode === 'single' ? 'active' : ''}`} onClick={() => setAddMode('single')}>Single</button>
                            <button className={`tab ${addMode === 'range' ? 'active' : ''}`} onClick={() => setAddMode('range')}>Range</button>
                        </div>
                        {addMode === 'single' ? (
                            <div className="flex gap-3">
                                <input className="form-input" value={singleMatric} onChange={e => setSingleMatric(e.target.value)} placeholder="e.g. 240805051" style={{ flex: 1 }} />
                                <button className="btn btn-primary" onClick={addMatric} disabled={!singleMatric}>Add</button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div className="form-group"><label className="form-label">Prefix</label><input className="form-input" value={prefix} onChange={e => setPrefix(e.target.value)} /></div>
                                <div className="flex gap-3">
                                    <div className="form-group" style={{ flex: 1 }}><label className="form-label">Start</label><input className="form-input" type="number" value={rangeStart} onChange={e => setRangeStart(e.target.value)} placeholder="1" /></div>
                                    <div className="form-group" style={{ flex: 1 }}><label className="form-label">End</label><input className="form-input" type="number" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} placeholder="150" /></div>
                                </div>
                                <button className="btn btn-primary" onClick={addMatric} disabled={!prefix || !rangeStart || !rangeEnd}>Add Range</button>
                            </div>
                        )}
                    </div>

                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>Matric Number</th><th>Added By</th><th>Date</th><th></th></tr></thead>
                            <tbody>
                                {matrics.slice(0, 50).map(m => (
                                    <tr key={m.id}>
                                        <td style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{m.matric_no}</td>
                                        <td style={{ fontSize: 'var(--font-sm)' }}>{m.added_by_name || '—'}</td>
                                        <td style={{ fontSize: 'var(--font-xs)' }}>{new Date(m.created_at).toLocaleDateString()}</td>
                                        <td><button className="btn btn-danger btn-sm" onClick={() => removeMatric(m.id)}>Remove</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {matrics.length > 50 && <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Showing 50 of {matrics.length}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}
