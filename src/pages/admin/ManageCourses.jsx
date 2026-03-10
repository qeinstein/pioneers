import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ManageCourses() {
    const { token } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ course_code: '', course_name: '', description: '' });
    const [msg, setMsg] = useState('');

    useEffect(() => { fetchCourses(); }, []);

    async function fetchCourses() {
        try { const res = await fetch('/api/courses', { headers: { Authorization: `Bearer ${token}` } }); setCourses(await res.json()); }
        finally { setLoading(false); }
    }

    function startEdit(course) { setEditing(course.id); setForm({ course_code: course.course_code, course_name: course.course_name, description: course.description || '' }); }
    function startCreate() { setEditing('new'); setForm({ course_code: '', course_name: '', description: '' }); }

    async function handleSave() {
        setMsg('');
        if (editing === 'new') {
            const res = await fetch('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
            if (res.ok) { setMsg('Course created'); setEditing(null); fetchCourses(); }
        } else {
            await fetch(`/api/courses/${editing}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
            setMsg('Course updated'); setEditing(null); fetchCourses();
        }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this course and all its quizzes?')) return;
        await fetch(`/api/courses/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        setMsg('Course deleted'); fetchCourses();
    }

    if (loading) return <div className="page-container"><div className="loading-spinner"><div className="spinner"></div></div></div>;

    return (
        <div className="page-container">
            <Link to="/admin" className="back-link">Back to Admin</Link>
            <div className="flex items-center justify-between mb-6">
                <h1 className="page-title">Manage Courses</h1>
                <button className="btn btn-primary" onClick={startCreate}>+ New Course</button>
            </div>

            {msg && <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--success-soft)', color: 'var(--success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>{msg}</div>}

            {editing !== null && (
                <div className="modal-overlay" onClick={() => setEditing(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>{editing === 'new' ? 'New Course' : 'Edit Course'}</h3>
                        <div className="form-group"><label className="form-label">Course Code</label><input className="form-input" value={form.course_code} onChange={e => setForm({ ...form, course_code: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Course Name</label><input className="form-input" value={form.course_name} onChange={e => setForm({ ...form, course_name: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                        <div className="flex gap-3 justify-between">
                            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4 stagger-children">
                {courses.map(c => (
                    <div key={c.id} className="card-static" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="badge badge-primary">{c.course_code}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>{c.quiz_count} quizzes</span>
                                </div>
                                <h3 style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>{c.course_name}</h3>
                            </div>
                            <div className="flex gap-2">
                                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>Edit</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Delete</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {courses.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-title">No courses yet</div>
                    <button className="btn btn-primary mt-4" onClick={startCreate}>Create First Course</button>
                </div>
            )}
        </div>
    );
}
