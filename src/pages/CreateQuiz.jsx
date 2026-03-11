import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MathText from '../components/MathText';

export default function CreateQuiz() {
    const { token, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [courseId, setCourseId] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [questions, setQuestions] = useState([
        { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'a', explanation: '' }
    ]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('manual');
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState('');

    const jsonTemplate = `[
  {
    "question_text": "What does API stand for?",
    "option_a": "Application Programming Interface",
    "option_b": "Advanced Publishing Integration",
    "option_c": "Automated Program Interface",
    "option_d": "Application Process Integration",
    "correct_option": "a",
    "explanation": "An API is a set of rules allowing programs to talk to each other."
  }
]`;

    useEffect(() => {
        fetch('/api/courses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setCourses);
    }, []);

    function addQuestion() {
        setQuestions(prev => [...prev, { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'a', explanation: '' }]);
    }
    function removeQuestion(i) { if (questions.length <= 1) return; setQuestions(prev => prev.filter((_, idx) => idx !== i)); }
    function updateQuestion(i, field, value) { setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q)); }

    function handleJsonImport(e) {
        const value = e.target.value;
        setJsonInput(value);
        setJsonError('');

        if (!value.trim()) return;

        try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) throw new Error('Input must be a JSON array of question objects.');

            // Validate schema roughly
            parsed.forEach((q, idx) => {
                const requiredKeys = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option'];
                for (let key of requiredKeys) {
                    if (!q[key] || String(q[key]).trim() === '') {
                        throw new Error(`Question ${idx + 1} is missing required field: ${key}`);
                    }
                }
                const opt = q.correct_option.toLowerCase();
                if (!['a', 'b', 'c', 'd'].includes(opt)) {
                    throw new Error(`Question ${idx + 1} correct_option must be 'a', 'b', 'c', or 'd'. Found: ${opt}`);
                }
                q.correct_option = opt; // normalize validation
            });

            setQuestions(parsed);
        } catch (err) {
            setJsonError(err.message);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!courseId || !title || questions.some(q => !q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d)) {
            setError('Please fill in all required fields'); return;
        }
        setLoading(true);
        try {
            const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
            const res = await fetch('/api/quizzes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ course_id: parseInt(courseId), title, description, tags, questions }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            navigate('/quiz-bank');
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }

    return (
        <div className="page-container">
            <div className="page-header animate-slide-up">
                <h1 className="page-title">Create Quiz</h1>
                <p className="page-subtitle">
                    {isAdmin ? 'Your quiz will be published immediately.' : 'Your quiz will be reviewed by an admin before publishing.'}
                </p>
            </div>

            {error && (
                <div className="animate-shake" style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--error-soft)', color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-2)' }}>
                <button
                    className={`btn ${tab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setTab('manual')}
                >Manual Entry</button>
                <button
                    className={`btn ${tab === 'json' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setTab('json')}
                >Import JSON</button>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="card-static mb-6 animate-slide-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--font-base)' }}>Quiz Details</h3>
                    <div className="form-group">
                        <label className="form-label">Course *</label>
                        <select className="form-select" value={courseId} onChange={e => setCourseId(e.target.value)} required>
                            <option value="">Select a course</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} — {c.course_name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Quiz Title *</label>
                        <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. SDLC Fundamentals" required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Tags (comma-separated)</label>
                        <input className="form-input" value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="e.g. SDLC, Exams, Midterm" />
                    </div>
                </div>

                {questions.map((q, i) => (
                    <div key={i} className="card-static mb-4 animate-slide-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', animationDelay: `${i * 50}ms` }}>
                        <div className="flex items-center justify-between mb-4">
                            <h4 style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>Question {i + 1}</h4>
                            {questions.length > 1 && <button type="button" className="btn btn-danger btn-sm" onClick={() => removeQuestion(i)}>Remove</button>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">
                                Question Text *
                                {q.question_text && <span style={{ float: 'right', fontWeight: 400, color: 'var(--text-secondary)' }}>Preview: <MathText text={q.question_text} /></span>}
                            </label>
                            <textarea className="form-textarea" value={q.question_text} onChange={e => updateQuestion(i, 'question_text', e.target.value)} placeholder="Enter the question..." style={{ minHeight: '80px' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            {['a', 'b', 'c', 'd'].map(opt => (
                                <div className="form-group" key={opt}>
                                    <label className="form-label">
                                        Option {opt.toUpperCase()} *
                                        {q[`option_${opt}`] && <span style={{ float: 'right', fontWeight: 400, color: 'var(--text-secondary)' }}><MathText text={q[`option_${opt}`]} /></span>}
                                    </label>
                                    <input className="form-input" value={q[`option_${opt}`]} onChange={e => updateQuestion(i, `option_${opt}`, e.target.value)} />
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-3)' }}>
                            <div className="form-group">
                                <label className="form-label">Correct Answer *</label>
                                <select className="form-select" value={q.correct_option} onChange={e => updateQuestion(i, 'correct_option', e.target.value)}>
                                    {['a', 'b', 'c', 'd'].map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Explanation</label>
                                <input className="form-input" value={q.explanation} onChange={e => updateQuestion(i, 'explanation', e.target.value)} placeholder="Why is this correct?" />
                            </div>
                        </div>
                    </div>
                ))}

                {tab === 'json' && (
                    <div className="card-static mb-4 animate-slide-up" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                            <h4 style={{ fontWeight: 700, fontSize: 'var(--font-md)' }}>JSON Import</h4>
                            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Format: Array of objects</span>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>
                            Paste an array of JSON objects. The questions state will update automatically below if the JSON is valid. Wait for the error block to disappear before submitting.
                        </p>

                        {jsonError && (
                            <div className="animate-shake" style={{ padding: 'var(--space-3)', background: 'var(--error-soft)', color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', marginBottom: 'var(--space-4)' }}>
                                <strong>Syntax Error:</strong> {jsonError}
                            </div>
                        )}

                        <div className="form-group">
                            <textarea
                                className="form-textarea"
                                value={jsonInput}
                                onChange={handleJsonImport}
                                placeholder={jsonTemplate}
                                style={{ minHeight: '300px', fontFamily: 'var(--font-mono)', fontSize: '13px', whiteSpace: 'pre' }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mt-4">
                    <button type="button" className="btn btn-ghost" onClick={addQuestion}>+ Add Question</button>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading || (tab === 'json' && !!jsonError)}>
                        {loading ? 'Creating...' : isAdmin ? 'Publish Quiz' : 'Submit for Review'}
                    </button>
                </div>
            </form>
        </div>
    );
}
