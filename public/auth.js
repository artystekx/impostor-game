// System uwierzytelniania użytkowników - uproszczony, bez szyfrowania haseł
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'users.json');
const STATS_FILE = path.join(__dirname, 'stats.json');

class User {
    constructor(username, password, email = '') {
        this.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        this.username = username;
        this.password = password; // BEZ szyfrowania - admin może zmieniać
        this.email = email;
        this.createdAt = new Date().toISOString();
        this.isOnline = false;
        this.lastLogin = null;
        this.friends = []; // Lista ID znajomych
        this.friendRequests = []; // Prośby o dodanie do znajomych
        this.blockedUsers = []; // Zablokowani użytkownicy
        this.settings = {
            theme: 'dark',
            language: 'pl',
            notifications: true,
            sound: true
        };
    }
}

class Stats {
    constructor(userId) {
        this.userId = userId;
        this.totalGames = 0;
        this.gamesWon = 0;
        this.gamesLost = 0;
        this.impostorGames = 0;
        this.impostorWins = 0;
        this.totalScore = 0;
        this.bestScore = 0;
        this.favoriteWord = '';
        this.longestWinStreak = 0;
        this.lastPlayed = null;
        this.achievements = [];
        this.rank = 'Nowicjusz';
        this.level = 1;
        this.experience = 0;
    }
}

// Ładowanie danych z plików
let users = new Map();
let stats = new Map();
let sessions = new Map();

function loadData() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            users = new Map(Object.entries(usersData));
        }
        
        if (fs.existsSync(STATS_FILE)) {
            const statsData = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
            stats = new Map(Object.entries(statsData));
        }
        
        console.log(`Załadowano ${users.size} użytkowników i ${stats.size} statystyk`);
    } catch (error) {
        console.error('Błąd ładowania danych:', error);
        // Tworzymy domyślne pliki jeśli nie istnieją
        saveData();
    }
}

function saveData() {
    try {
        const usersObj = Object.fromEntries(users);
        const statsObj = Object.fromEntries(stats);
        
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersObj, null, 2));
        fs.writeFileSync(STATS_FILE, JSON.stringify(statsObj, null, 2));
    } catch (error) {
        console.error('Błąd zapisywania danych:', error);
    }
}

// Funkcje pomocnicze
function findUserByUsername(username) {
    for (const user of users.values()) {
        if (user.username.toLowerCase() === username.toLowerCase()) {
            return user;
        }
    }
    return null;
}

function findUserById(userId) {
    return users.get(userId);
}

function createSession(userId) {
    const sessionId = Math.random().toString(36).substr(2) + Date.now().toString(36);
    sessions.set(sessionId, {
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dni
    });
    return sessionId;
}

function validateSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    
    if (Date.now() > session.expiresAt) {
        sessions.delete(sessionId);
        return null;
    }
    
    return session;
}

function registerUser(username, password, email = '') {
    if (findUserByUsername(username)) {
        return { success: false, error: 'Użytkownik już istnieje' };
    }
    
    if (username.length < 3 || username.length > 20) {
        return { success: false, error: 'Nazwa użytkownika musi mieć 3-20 znaków' };
    }
    
    if (password.length < 4) {
        return { success: false, error: 'Hasło musi mieć co najmniej 4 znaki' };
    }
    
    const user = new User(username, password, email);
    const userStats = new Stats(user.id);
    
    users.set(user.id, user);
    stats.set(user.id, userStats);
    
    saveData();
    
    const sessionId = createSession(user.id);
    
    return {
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt
        },
        sessionId,
        stats: userStats
    };
}

function loginUser(username, password) {
    const user = findUserByUsername(username);
    if (!user) {
        return { success: false, error: 'Nieprawidłowy login lub hasło' };
    }
    
    if (user.password !== password) {
        return { success: false, error: 'Nieprawidłowy login lub hasło' };
    }
    
    user.lastLogin = new Date().toISOString();
    user.isOnline = true;
    
    const userStats = stats.get(user.id) || new Stats(user.id);
    const sessionId = createSession(user.id);
    
    saveData();
    
    return {
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            isOnline: true,
            lastLogin: user.lastLogin
        },
        sessionId,
        stats: userStats
    };
}

function logoutUser(sessionId) {
    const session = validateSession(sessionId);
    if (session) {
        const user = findUserById(session.userId);
        if (user) {
            user.isOnline = false;
        }
        sessions.delete(sessionId);
        saveData();
    }
}

function updateUser(userId, updates) {
    const user = findUserById(userId);
    if (!user) return { success: false, error: 'Użytkownik nie znaleziony' };
    
    // Aktualizuj tylko dozwolone pola
    if (updates.username && updates.username !== user.username) {
        if (findUserByUsername(updates.username)) {
            return { success: false, error: 'Nazwa użytkownika jest już zajęta' };
        }
        user.username = updates.username;
    }
    
    if (updates.password) {
        user.password = updates.password;
    }
    
    if (updates.email) {
        user.email = updates.email;
    }
    
    if (updates.settings) {
        user.settings = { ...user.settings, ...updates.settings };
    }
    
    saveData();
    
    return {
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            settings: user.settings
        }
    };
}

function updateStats(userId, gameResult) {
    let userStats = stats.get(userId);
    if (!userStats) {
        userStats = new Stats(userId);
        stats.set(userId, userStats);
    }
    
    userStats.totalGames++;
    userStats.totalScore += gameResult.score || 0;
    userStats.lastPlayed = new Date().toISOString();
    
    if (gameResult.won) {
        userStats.gamesWon++;
        userStats.experience += 50;
        
        // Sprawdź czy to nowy najlepszy wynik
        if ((gameResult.score || 0) > userStats.bestScore) {
            userStats.bestScore = gameResult.score;
        }
        
        // Aktualizuj rank
        if (userStats.experience >= 1000) {
            userStats.rank = 'Mistrz';
            userStats.level = Math.floor(userStats.experience / 1000) + 1;
        } else if (userStats.experience >= 500) {
            userStats.rank = 'Ekspert';
        } else if (userStats.experience >= 200) {
            userStats.rank = 'Zaawansowany';
        } else if (userStats.experience >= 50) {
            userStats.rank = 'Średniozaawansowany';
        }
    } else {
        userStats.gamesLost++;
        userStats.experience += 10;
    }
    
    if (gameResult.wasImpostor) {
        userStats.impostorGames++;
        if (gameResult.won) {
            userStats.impostorWins++;
        }
    }
    
    saveData();
    
    return userStats;
}

function addFriend(userId, friendUsername) {
    const user = findUserById(userId);
    const friend = findUserByUsername(friendUsername);
    
    if (!user) return { success: false, error: 'Użytkownik nie znaleziony' };
    if (!friend) return { success: false, error: 'Znajomy nie znaleziony' };
    
    if (userId === friend.id) {
        return { success: false, error: 'Nie możesz dodać samego siebie' };
    }
    
    if (user.friends.includes(friend.id)) {
        return { success: false, error: 'Ten użytkownik jest już twoim znajomym' };
    }
    
    if (user.blockedUsers.includes(friend.id)) {
        return { success: false, error: 'Ten użytkownik jest zablokowany' };
    }
    
    // Sprawdź czy jest już prośba
    if (!user.friendRequests.includes(friend.id)) {
        // Wyślij prośbę o dodanie do znajomych
        friend.friendRequests.push(userId);
        saveData();
        return { success: true, message: 'Wysłano prośbę o dodanie do znajomych' };
    }
    
    return { success: false, error: 'Prośba już została wysłana' };
}

function acceptFriendRequest(userId, friendId) {
    const user = findUserById(userId);
    const friend = findUserById(friendId);
    
    if (!user || !friend) {
        return { success: false, error: 'Użytkownik nie znaleziony' };
    }
    
    // Usuń z listy próśb
    const requestIndex = user.friendRequests.indexOf(friendId);
    if (requestIndex === -1) {
        return { success: false, error: 'Prośba nie znaleziona' };
    }
    
    user.friendRequests.splice(requestIndex, 1);
    
    // Dodaj do znajomych obustronnie
    if (!user.friends.includes(friendId)) {
        user.friends.push(friendId);
    }
    
    if (!friend.friends.includes(userId)) {
        friend.friends.push(userId);
    }
    
    saveData();
    
    return {
        success: true,
        message: 'Dodano do znajomych',
        friends: user.friends
    };
}

function getFriends(userId) {
    const user = findUserById(userId);
    if (!user) return [];
    
    const friendsList = [];
    for (const friendId of user.friends) {
        const friend = findUserById(friendId);
        if (friend) {
            const friendStats = stats.get(friendId) || new Stats(friendId);
            friendsList.push({
                id: friend.id,
                username: friend.username,
                isOnline: friend.isOnline,
                lastLogin: friend.lastLogin,
                stats: friendStats
            });
        }
    }
    
    return friendsList;
}

function getFriendRequests(userId) {
    const user = findUserById(userId);
    if (!user) return [];
    
    const requests = [];
    for (const requesterId of user.friendRequests) {
        const requester = findUserById(requesterId);
        if (requester) {
            requests.push({
                id: requester.id,
                username: requester.username,
                requestDate: new Date().toISOString()
            });
        }
    }
    
    return requests;
}

function getLeaderboard(limit = 50) {
    const allStats = Array.from(stats.values());
    
    // Sortuj według punktów
    const sortedByScore = [...allStats]
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, limit)
        .map(stat => {
            const user = findUserById(stat.userId);
            return {
                userId: stat.userId,
                username: user ? user.username : 'Nieznany',
                totalScore: stat.totalScore,
                gamesWon: stat.gamesWon,
                totalGames: stat.totalGames,
                bestScore: stat.bestScore,
                rank: stat.rank,
                level: stat.level
            };
        });
    
    // Sortuj według wygranych
    const sortedByWins = [...allStats]
        .sort((a, b) => b.gamesWon - a.gamesWon)
        .slice(0, limit)
        .map(stat => {
            const user = findUserById(stat.userId);
            return {
                userId: stat.userId,
                username: user ? user.username : 'Nieznany',
                gamesWon: stat.gamesWon,
                winRate: stat.totalGames > 0 ? ((stat.gamesWon / stat.totalGames) * 100).toFixed(1) : 0
            };
        });
    
    // Sortuj według impostor wygranych
    const sortedByImpostorWins = [...allStats]
        .sort((a, b) => b.impostorWins - a.impostorWins)
        .slice(0, limit)
        .map(stat => {
            const user = findUserById(stat.userId);
            return {
                userId: stat.userId,
                username: user ? user.username : 'Nieznany',
                impostorWins: stat.impostorWins,
                impostorGames: stat.impostorGames,
                impostorWinRate: stat.impostorGames > 0 ? ((stat.impostorWins / stat.impostorGames) * 100).toFixed(1) : 0
            };
        });
    
    return {
        byScore: sortedByScore,
        byWins: sortedByWins,
        byImpostorWins: sortedByImpostorWins,
        totalPlayers: users.size,
        totalGames: allStats.reduce((sum, stat) => sum + stat.totalGames, 0)
    };
}

// Inicjalizacja przy starcie
loadData();

// Eksport dla server.js
module.exports = {
    users,
    stats,
    sessions,
    loadData,
    saveData,
    findUserByUsername,
    findUserById,
    validateSession,
    createSession,
    registerUser,
    loginUser,
    logoutUser,
    updateUser,
    updateStats,
    addFriend,
    acceptFriendRequest,
    getFriends,
    getFriendRequests,
    getLeaderboard
};
