import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import QuizCard from '../components/QuizCard';

export default function QuizBank() {
    const { token } = useAuth();
    const [quizzes, setQuizzes] = useState([]);
    const [courses, setCourses] = useState([]);
    const [search, setSearch] = useState('');
    const [courseFilter, setCourseFilter] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [bookmarks, setBookmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [allTags, setAllTags] = useState([]);
    const [liveMode, setLiveMode] = useState(false); // New state for live quiz filtering

    useEffect(() => {
        Promise.all([
            fetch('/api/courses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetchQuizzes(),
            fetch('/api/bookmarks', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch('/api/quizzes/tags/recent', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([c, , b, t]) => {
            setCourses(c);
            setBookmarks(b);
            if (Array.isArray(t)) setAllTags(t);
        });
    }, []);

    async function fetchQuizzes() {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (courseFilter) params.set('course_id', courseFilter);
        if (tagFilter) params.set('tag', tagFilter);
        // If in live mode, only fetch approved quizzes
        if (liveMode) params.set('status', 'approved');

        const res = await fetch(`/api/quizzes?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setQuizzes(data);
        setLoading(false);
        return data;
    }

    useEffect(() => {
        const timer = setTimeout(fetchQuizzes, 300);
        return () => clearTimeout(timer);
    }, [search, courseFilter, tagFilter, liveMode]);

    const displayQuizzes = showBookmarks ? bookmarks : quizzes;

    return (
        <div className="page-container">
            <div className="page-header animate-slide-up">
                <h1 className="page-title">Quiz Bank</h1>
                <p className="page-subtitle">Browse, search, and practice quizzes from all courses</p>
            </div>

            <div className="filter-bar animate-slide-up" style={{ animationDelay: '100ms' }}>
                <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
                    <span className="search-bar-icon">Q</span>
                    <input placeholder="Search quizzes..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="form-select" style={{ width: 'auto', minWidth: '150px' }}
                    value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                    <option value="">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.course_code}</option>)}
                </select>
                <div className="btn-group">
                    <button className={`btn ${!liveMode && !showBookmarks ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                        onClick={() => { setLiveMode(false); setShowBookmarks(false); }}>
                        All Quizzes
                    </button>
                    <button className={`btn ${liveMode ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                        onClick={() => { setLiveMode(true); setShowBookmarks(false); }}>
                        Live Quiz
                    </button>
                    <button className={`btn ${showBookmarks ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                        onClick={() => setShowBookmarks(!showBookmarks)}>
                        Saved
                    </button>
                </div>
            </div>

            {allTags.length > 0 && !showBookmarks && (
                <div className="flex flex-wrap gap-2 mb-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
                    <span className={`tag ${!tagFilter ? 'active' : ''}`} onClick={() => setTagFilter('')}>All</span>
                    {allTags.map(t => (
                        <span key={t} className={`tag ${tagFilter === t ? 'active' : ''}`} onClick={() => setTagFilter(tagFilter === t ? '' : t)}>
                            #{t}
                        </span>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
            ) : displayQuizzes.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-title">{showBookmarks ? 'No saved quizzes' : 'No quizzes found'}</div>
                    <div className="empty-state-text">{showBookmarks ? 'Bookmark quizzes to find them here' : 'Try adjusting your search or filters'}</div>
                </div>
            ) : (
                <div className="grid-2 stagger-children">
                    {displayQuizzes.map(q => <QuizCard key={q.id} quiz={q} />)}
                </div>
            )}
        </div>
    );
}
