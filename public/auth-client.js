// System autentykacji po stronie klienta
let currentUser = null;
let currentSession = localStorage.getItem('impostor_session');
let userStats = null;

// API Functions
async function apiRegister(username, password, email = '') {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email })
        });
        return await response.json();
    } catch (error) {
        console.error('Błąd rejestracji:', error);
        return { success: false, error: 'Błąd połączenia z serwerem' };
    }
}

async function apiLogin(username, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return await response.json();
    } catch (error) {
        console.error('Błąd logowania:', error);
        return { success: false, error: 'Błąd połączenia z serwerem' };
    }
}

async function apiLogout(sessionId) {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        return { success: true };
    } catch (error) {
        console.error('Błąd wylogowania:', error);
        return { success: false };
    }
}

async function apiValidateSession(sessionId) {
    try {
        const response = await fetch('/api/validate-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        return await response.json();
    } catch (error) {
        console.error('Błąd walidacji sesji:', error);
        return { valid: false };
    }
}

async function apiUpdateProfile(sessionId, updates) {
    try {
        const response = await fetch('/api/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, updates })
        });
        return await response.json();
    } catch (error) {
        console.error('Błąd aktualizacji profilu:', error);
        return { success: false, error: 'Błąd połączenia' };
    }
}

async function apiAddFriend(sessionId, friendUsername) {
    try {
        const response = await fetch('/api/add-friend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, friendUsername })
        });
        return await response.json();
    } catch (error) {
        console.error('Błąd dodawania znajomego:', error);
        return { success: false, error: 'Błąd połączenia' };
    }
}

async function apiAcceptFriend(sessionId, friendId) {
    try {
        const response = await fetch('/api/accept-friend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, friendId })
        });
        return await response.json();
    } catch (error) {
        console.error('Błąd akceptowania znajomego:', error);
        return { success: false, error: 'Błąd połączenia' };
    }
}

async function apiGetFriends(sessionId) {
    try {
        const response = await fetch(`/api/friends/${sessionId}`);
        return await response.json();
    } catch (error) {
        console.error('Błąd pobierania znajomych:', error);
        return { friends: [], requests: [] };
    }
}

async function apiGetLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        return await response.json();
    } catch (error) {
        console.error('Błąd pobierania rankingu:', error);
        return { byScore: [], byWins: [], byImpostorWins: [], totalPlayers: 0, totalGames: 0 };
    }
}

async function apiGetUser(userId) {
    try {
        const response = await fetch(`/api/user/${userId}`);
        return await response.json();
    } catch (error) {
        console.error('Błąd pobierania użytkownika:', error);
        return null;
    }
}

// Authentication Functions
async function register(username, password, email) {
    const result = await apiRegister(username, password, email);
    
    if (result.success) {
        currentUser = result.user;
        currentSession = result.sessionId;
        userStats = result.stats;
        
        localStorage.setItem('impostor_session', currentSession);
        localStorage.setItem('impostor_user', JSON.stringify(currentUser));
        
        // Uwierzytelnij socket
        if (socket && socket.connected) {
            socket.emit('authenticate', { sessionId: currentSession });
        }
        
        return { success: true, user: currentUser };
    }
    
    return result;
}

async function login(username, password) {
    const result = await apiLogin(username, password);
    
    if (result.success) {
        currentUser = result.user;
        currentSession = result.sessionId;
        userStats = result.stats;
        
        localStorage.setItem('impostor_session', currentSession);
        localStorage.setItem('impostor_user', JSON.stringify(currentUser));
        
        // Uwierzytelnij socket
        if (socket && socket.connected) {
            socket.emit('authenticate', { sessionId: currentSession });
        }
        
        return { success: true, user: currentUser };
    }
    
    return result;
}

async function logout() {
    if (currentSession) {
        await apiLogout(currentSession);
    }
    
    currentUser = null;
    currentSession = null;
    userStats = null;
    
    localStorage.removeItem('impostor_session');
    localStorage.removeItem('impostor_user');
    
    // Rozłącz socket
    if (socket) {
        socket.disconnect();
    }
    
    return { success: true };
}

async function validateSession() {
    if (!currentSession) return false;
    
    const result = await apiValidateSession(currentSession);
    
    if (result.valid) {
        currentUser = result.user;
        userStats = result.stats;
        return true;
    } else {
        // Sesja wygasła
        currentUser = null;
        currentSession = null;
        userStats = null;
        localStorage.removeItem('impostor_session');
        localStorage.removeItem('impostor_user');
        return false;
    }
}

async function updateProfile(updates) {
    if (!currentSession) return { success: false, error: 'Nie jesteś zalogowany' };
    
    const result = await apiUpdateProfile(currentSession, updates);
    
    if (result.success) {
        currentUser = result.user;
        localStorage.setItem('impostor_user', JSON.stringify(currentUser));
    }
    
    return result;
}

async function addFriend(friendUsername) {
    if (!currentSession) return { success: false, error: 'Nie jesteś zalogowany' };
    return await apiAddFriend(currentSession, friendUsername);
}

async function acceptFriend(friendId) {
    if (!currentSession) return { success: false, error: 'Nie jesteś zalogowany' };
    return await apiAcceptFriend(currentSession, friendId);
}

async function getFriends() {
    if (!currentSession) return { friends: [], requests: [] };
    return await apiGetFriends(currentSession);
}

async function getLeaderboard() {
    return await apiGetLeaderboard();
}

async function getUser(userId) {
    return await apiGetUser(userId);
}

// Load saved session on page load
window.addEventListener('load', async () => {
    const savedSession = localStorage.getItem('impostor_session');
    const savedUser = localStorage.getItem('impostor_user');
    
    if (savedSession && savedUser) {
        currentSession = savedSession;
        currentUser = JSON.parse(savedUser);
        
        // Validate session
        const isValid = await validateSession();
        if (isValid) {
            console.log('Sesja przywrócona:', currentUser.username);
            // Uwierzytelnij socket po połączeniu
            if (socket) {
                socket.on('connect', () => {
                    socket.emit('authenticate', { sessionId: currentSession });
                });
            }
        } else {
            console.log('Sesja wygasła');
        }
    }
});

// Export for use in other files
window.authSystem = {
    currentUser,
    currentSession,
    userStats,
    register,
    login,
    logout,
    validateSession,
    updateProfile,
    addFriend,
    acceptFriend,
    getFriends,
    getLeaderboard,
    getUser
};
