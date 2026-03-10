import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LeaderboardTable from '../components/LeaderboardTable';

export default function Leaderboard() {
    const { token, user } = useAuth();
    const [tab, setTab] = useState('global');
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/courses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setCourses);
    }, []);

    useEffect(() => {
        setLoading(true);
        const url = tab === 'global' ? '/api/leaderboard/global' : `/api/leaderboard/course/${selectedCourse}`;
        if (tab === 'course' && !selectedCourse) { setLoading(false); return; }
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setData).finally(() => setLoading(false));
    }, [tab, selectedCourse]);

    return (
        <div className="page-container">
            <div className="page-header animate-slide-up">
                <h1 className="page-title">Leaderboard</h1>
                <p className="page-subtitle">Rankings across the department</p>
            </div>

            <div className="flex items-center gap-4 mb-6 flex-wrap animate-slide-up" style={{ animationDelay: '100ms' }}>
                <div className="tabs" style={{ marginBottom: 0, maxWidth: '300px' }}>
                    <button className={`tab ${tab === 'global' ? 'active' : ''}`} onClick={() => setTab('global')}>Global</button>
                    <button className={`tab ${tab === 'course' ? 'active' : ''}`} onClick={() => setTab('course')}>By Course</button>
                </div>
                {tab === 'course' && (
                    <select className="form-select" style={{ width: 'auto', minWidth: '200px' }} value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
                        <option value="">Select a course</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.course_code}</option>)}
                    </select>
                )}
            </div>

            <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                {loading ? (
                    <div className="loading-spinner"><div className="spinner"></div></div>
                ) : tab === 'course' && !selectedCourse ? (
                    <div className="empty-state">
                        <div className="empty-state-title">Select a course</div>
                        <div className="empty-state-text">Choose a course to view its leaderboard</div>
                    </div>
                ) : (
                    <LeaderboardTable data={data} currentUserId={user?.id} />
                )}
            </div>
        </div>
    );
}
