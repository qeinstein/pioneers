import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('darkMode');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
        localStorage.setItem('darkMode', JSON.stringify(darkMode));
    }, [darkMode]);

    useEffect(() => {
        if (token) {
            fetchProfile();
        } else {
            setLoading(false);
        }
    }, []);

    async function fetchProfile() {
        try {
            const res = await fetch('/api/auth/profile', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                logout();
            }
        } catch {
            logout();
        } finally {
            setLoading(false);
        }
    }

    async function login(matric_no, password) {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matric_no, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }

    async function register(matric_no) {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matric_no }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    }

    function logout() {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    }

    async function updateProfile(updates) {
        const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (res.ok) setUser(prev => ({ ...prev, ...data }));
        return data;
    }

    async function uploadAvatar(file) {
        const formData = new FormData();
        formData.append('avatar', file);
        const res = await fetch('/api/auth/avatar', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        });
        const data = await res.json();
        if (res.ok) setUser(prev => ({ ...prev, profile_pic_url: data.profile_pic_url }));
        return data;
    }

    async function changePassword(current_password, new_password) {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ current_password, new_password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setUser(prev => ({ ...prev, is_first_login: false }));
        return data;
    }

    const value = {
        user, token, loading, darkMode,
        login, logout, register, updateProfile, uploadAvatar, changePassword,
        setDarkMode: (val) => setDarkMode(val),
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isFirstLogin: user?.is_first_login,
        refreshProfile: fetchProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
