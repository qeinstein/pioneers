import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTotalPages, parsePaginatedResponse } from '../utils/pagination';

// Colorful gradients for decks
const DECK_COLORS = [
    'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
];

export default function Flashcards() {
    const { token, user } = useAuth();
    const [decks, setDecks] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [activeDeck, setActiveDeck] = useState(null);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [courseId, setCourseId] = useState('');
    const [cardsText, setCardsText] = useState('[\n  {"front": "Question 1", "back": "Answer 1"},\n  {"front": "Question 2", "back": "Answer 2"}\n]');
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [openingDeckId, setOpeningDeckId] = useState(null);
    const pageSize = 24;

    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetchDecks(),
            fetch('/api/courses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([d, c]) => {
            setDecks(d);
            setCourses(c);
            setLoading(false);
        });
    }, [token, page]);

    async function fetchDecks() {
        const res = await fetch(`/api/flashcards?page=${page}&limit=${pageSize}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return [];
        const { items, total: totalItems } = await parsePaginatedResponse(res);
        setTotal(totalItems);
        setDecks(items);
        return items;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setMsg('');

        try {
            let parsedCards;
            try {
                parsedCards = JSON.parse(cardsText);
                if (!Array.isArray(parsedCards) || parsedCards.length === 0) throw new Error('Must be an array of objects');
                if (!parsedCards.every(c => c.front && c.back)) throw new Error('Every card must have a "front" and "back" string');
            } catch (err) {
                setMsg('Invalid JSON format: ' + err.message);
                setSubmitting(false);
                return;
            }

            const res = await fetch('/api/flashcards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ title, description, course_id: courseId, cards: parsedCards })
            });

            if (res.ok) {
                setMsg('Flashcards submitted for approval!');
                setTitle(''); setDescription(''); setCourseId(''); setShowForm(false);
                fetchDecks();
            } else {
                const data = await res.json();
                setMsg(data.error || 'Failed to submit flashcards');
            }
        } catch {
            setMsg('Failed to connect to server');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this deck?')) return;
        try {
            const res = await fetch(`/api/flashcards/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setDecks(prev => prev.filter(d => d.id !== id));
                if (activeDeck?.id === id) setActiveDeck(null);
            }
        } catch { }
    }

    async function openDeck(deck, gradient) {
        setOpeningDeckId(deck.id);
        try {
            const res = await fetch(`/api/flashcards/${deck.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) return;
            const detail = await res.json();
            setActiveDeck({ ...detail, gradient });
        } finally {
            setOpeningDeckId(null);
        }
    }

    if (activeDeck) {
        return <FlashcardViewer deck={activeDeck} onBack={() => setActiveDeck(null)} />;
    }

    const totalPages = getTotalPages(total, pageSize);

    return (
        <div className="page-container flex flex-col gap-6">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span>📇</span> Flashcards
                    </h1>
                    <p className="page-subtitle">Study key concepts with community-created flashcard decks.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancel' : '+ Create Deck'}
                </button>
            </div>

            {msg && <div className={`badge ${msg.includes('approval') ? 'badge-success' : 'badge-danger'}`} style={{ padding: 'var(--space-3)' }}>{msg}</div>}

            {showForm && (
                <div className="card-static animate-scale-in" style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)',
                    backgroundImage: 'linear-gradient(135deg, rgba(254,207,239,0.05) 0%, rgba(161,140,209,0.05) 100%)'
                }}>
                    <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Create a New Deck</h2>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 300px' }}>
                                <label className="form-label">Title *</label>
                                <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g., Biology Chapter 1" />
                            </div>
                            <div style={{ flex: '1 1 150px' }}>
                                <label className="form-label">Course (Optional)</label>
                                <select className="form-select" value={courseId} onChange={e => setCourseId(e.target.value)}>
                                    <option value="">None / General</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.course_code}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Description</label>
                            <input type="text" className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description of this deck" />
                        </div>

                        <div>
                            <label className="form-label">Cards (JSON Format) *</label>
                            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                                Provide an array of objects, each with a <code>front</code> and <code>back</code> property.
                            </p>
                            <textarea className="form-textarea" value={cardsText} onChange={e => setCardsText(e.target.value)} rows={8} style={{ fontFamily: 'var(--font-mono)' }} required />
                        </div>

                        <div className="flex justify-end mt-2">
                            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                                {submitting ? 'Submitting...' : 'Submit for Approval'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
            ) : decks.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📇</div>
                    <div className="empty-state-title">No flashcard decks found</div>
                    <p style={{ color: 'var(--text-muted)' }}>Check back later or create your own!</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-5)' }}>
                    {decks.map((deck, idx) => {
                        const gradient = DECK_COLORS[idx % DECK_COLORS.length];
                        return (
                            <div key={deck.id} className="card-static flex flex-col gap-3" style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-xl)',
                                padding: 0,
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                            }}
                                onClick={() => deck.status === 'approved' && openDeck(deck, gradient)}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                {/* Colorful Gradient Header */}
                                <div style={{
                                    background: gradient,
                                    height: '8px',
                                    width: '100%'
                                }} />

                                <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', flex: 1, gap: 'var(--space-3)' }}>
                                    {deck.status !== 'approved' && (
                                        <span className={`badge ${deck.status === 'pending' ? 'badge-warning' : 'badge-danger'}`} style={{ position: 'absolute', top: '16px', right: '16px' }}>
                                            {deck.status.toUpperCase()}
                                        </span>
                                    )}

                                    <div>
                                        <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>{deck.title}</h3>
                                        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                                            {deck.card_count || 0} cards • By {deck.display_name}
                                        </div>
                                    </div>

                                    {deck.course_code && (
                                        <div className="badge badge-primary badge-sm" style={{ alignSelf: 'flex-start', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                                            {deck.course_code}
                                        </div>
                                    )}

                                    {deck.description && (
                                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                                            {deck.description}
                                        </p>
                                    )}

                                    {openingDeckId === deck.id && (
                                        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
                                            Loading deck...
                                        </div>
                                    )}

                                    {(user.id === deck.user_id || user.role === 'admin') && (
                                        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-color)' }}>
                                            <button className="btn btn-ghost btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(deck.id); }}>
                                                🗑️ Delete Deck
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between">
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
        </div>
    );
}

function FlashcardViewer({ deck, onBack }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    if (!deck.cards || deck.cards.length === 0) return <div>No cards in this deck.</div>;

    const currentCard = deck.cards[currentIndex];
    const gradient = deck.gradient || 'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)';

    function handleNext() {
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex(i => Math.min(i + 1, deck.cards.length - 1)), 150);
    }

    function handlePrev() {
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex(i => Math.max(i - 1, 0)), 150);
    }

    return (
        <div className="page-container flex flex-col items-center gap-6" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btn-ghost" onClick={onBack}>← Back to Decks</button>
                <div style={{ fontWeight: 600, padding: '4px 12px', borderRadius: '12px', background: 'var(--bg-input)' }}>
                    {deck.title}
                </div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{currentIndex + 1} / {deck.cards.length}</div>
            </div>

            {/* 3D Flip Container */}
            <div style={{ perspective: '1200px', width: '100%', minHeight: '350px' }}>
                <div
                    style={{
                        width: '100%', height: '100%', minHeight: '350px', cursor: 'pointer',
                        position: 'relative',
                        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        transformStyle: 'preserve-3d',
                        transform: isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)'
                    }}
                    onClick={() => setIsFlipped(!isFlipped)}
                >
                    {/* FRONT OF CARD */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '8px', background: gradient }} />
                        <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.3 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-3.23-2.67M2.5 22v-6h6M2.66 8.43a10 10 0 1 1 .59 9.21l3.23 2.67" /></svg>
                        </div>
                        <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {currentCard.front}
                        </div>
                        <div style={{ position: 'absolute', bottom: '20px', fontSize: 'var(--font-sm)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Question
                        </div>
                    </div>

                    {/* BACK OF CARD */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: gradient,
                        borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        textAlign: 'center', boxShadow: '0 15px 35px rgba(0,0,0,0.1)',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateX(180deg)',
                        color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.6 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-3.23-2.67M2.5 22v-6h6M2.66 8.43a10 10 0 1 1 .59 9.21l3.23 2.67" /></svg>
                        </div>
                        <div style={{ fontSize: 'var(--font-xl)', fontWeight: 500, lineHeight: 1.5 }}>
                            {currentCard.back}
                        </div>
                        <div style={{ position: 'absolute', bottom: '20px', fontSize: 'var(--font-sm)', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Answer
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex gap-4" style={{ marginTop: 'var(--space-4)' }}>
                <button className="btn btn-ghost btn-lg" onClick={handlePrev} disabled={currentIndex === 0} style={{ minWidth: '120px' }}>
                    ← Previous
                </button>
                <button className="btn btn-primary btn-lg" onClick={handleNext} disabled={currentIndex === deck.cards.length - 1} style={{ minWidth: '120px' }}>
                    Next →
                </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Click the card anywhere to flip it over</p>
        </div>
    );
}
