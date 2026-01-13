// Dodatkowe funkcje klienta gry
let gameInvitations = [];
let friendsList = [];
let friendRequests = [];

// Obsługa zaproszeń
socket.on('friendInvitation', (data) => {
    gameInvitations.push(data);
    showNotification(`Zaproszenie od ${data.from} do gry ${data.gameCode}`, 'info');
    updateInvitationsDisplay();
    
    // Pokaż powiadomienie
    const notification = document.getElementById('notification');
    if (notification) {
        notification.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <strong>Zaproszenie do gry!</strong>
                <p>${data.from} zaprasza Cię do gry.</p>
                <div style="display: flex; gap: 10px;">
                    <button onclick="acceptGameInvitation('${data.gameCode}')" class="btn btn-success btn-small">
                        <i class="fas fa-check"></i> Dołącz
                    </button>
                    <button onclick="declineGameInvitation('${data.gameCode}')" class="btn btn-danger btn-small">
                        <i class="fas fa-times"></i> Odrzuć
                    </button>
                </div>
            </div>
        `;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 10000);
    }
});

function acceptGameInvitation(gameCode) {
    socket.emit('joinViaInvite', { gameCode });
    // Usuń zaproszenie z listy
    gameInvitations = gameInvitations.filter(invite => invite.gameCode !== gameCode);
    updateInvitationsDisplay();
}

function declineGameInvitation(gameCode) {
    // Po prostu usuń z listy
    gameInvitations = gameInvitations.filter(invite => invite.gameCode !== gameCode);
    updateInvitationsDisplay();
}

function updateInvitationsDisplay() {
    const container = document.getElementById('invitations-container');
    if (!container) return;
    
    if (gameInvitations.length === 0) {
        container.innerHTML = `
            <div class="empty-state" id="no-invitations">
                <i class="fas fa-envelope-open"></i>
                <h3>Brak zaproszeń</h3>
                <p>Nie masz aktualnie żadnych zaproszeń do gier.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    gameInvitations.forEach((invite, index) => {
        html += `
            <div class="invitation-card">
                <div class="invitation-header">
                    <h4><i class="fas fa-gamepad"></i> Zaproszenie od ${invite.from}</h4>
                    <span class="invitation-date">Teraz</span>
                </div>
                <div class="invitation-details">
                    <p><strong>Kod gry:</strong> ${invite.gameCode}</p>
                    <p><strong>Tryb:</strong> ${invite.gameSettings.gameMode === 'sequential' ? 'Kolejka' : 'Wszyscy'}</p>
                    <p><strong>Gracze w lobby:</strong> ${invite.players.join(', ')}</p>
                </div>
                <div class="invitation-actions">
                    <button onclick="acceptGameInvitation('${invite.gameCode}')" class="btn btn-success btn-small">
                        <i class="fas fa-check"></i> Dołącz
                    </button>
                    <button onclick="declineGameInvitation('${invite.gameCode}')" class="btn btn-danger btn-small">
                        <i class="fas fa-times"></i> Odrzuć
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Obsługa znajomych
async function loadFriends() {
    if (!authSystem.currentSession) return;
    
    const result = await authSystem.getFriends();
    if (result.friends) {
        friendsList = result.friends;
        friendRequests = result.requests;
        updateFriendsDisplay();
        updateFriendRequestsDisplay();
    }
}

function updateFriendsDisplay() {
    const container = document.getElementById('friends-container');
    if (!container) return;
    
    if (friendsList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-friends"></i>
                <h3>Brak znajomych</h3>
                <p>Dodaj znajomych, aby móc ich zapraszać do gier!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    friendsList.forEach(friend => {
        html += `
            <div class="friend-card">
                <div class="friend-avatar ${friend.isOnline ? 'online' : 'offline'}">
                    <i class="fas fa-user"></i>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${friend.username}</div>
                    <div class="friend-status">${friend.isOnline ? 'Online' : 'Ostatnio: ' + formatDate(friend.lastLogin)}</div>
                    <div class="friend-stats">
                        <span class="friend-stat"><i class="fas fa-trophy"></i> ${friend.stats.totalScore || 0} pkt</span>
                        <span class="friend-stat"><i class="fas fa-crown"></i> ${friend.stats.gamesWon || 0} wygranych</span>
                    </div>
                </div>
                <div class="friend-actions">
                    <button onclick="inviteFriendToGame('${friend.id}', '${friend.username}')" class="btn btn-primary btn-small" ${!friend.isOnline ? 'disabled' : ''}>
                        <i class="fas fa-gamepad"></i> Zaproś do gry
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateFriendRequestsDisplay() {
    const container = document.getElementById('requests-container');
    const countElement = document.getElementById('requests-count');
    
    if (countElement) {
        countElement.textContent = friendRequests.length;
    }
    
    if (!container) return;
    
    if (friendRequests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-envelope"></i>
                <h3>Brak próśb</h3>
                <p>Nie masz żadnych próśb o dodanie do znajomych.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    friendRequests.forEach(request => {
        html += `
            <div class="request-card">
                <div class="request-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="request-info">
                    <div class="request-name">${request.username}</div>
                    <div class="request-date">Wysłano: ${formatDate(request.requestDate)}</div>
                </div>
                <div class="request-actions">
                    <button onclick="acceptFriendRequest('${request.id}')" class="btn btn-success btn-small">
                        <i class="fas fa-check"></i> Zaakceptuj
                    </button>
                    <button onclick="declineFriendRequest('${request.id}')" class="btn btn-danger btn-small">
                        <i class="fas fa-times"></i> Odrzuć
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function acceptFriendRequest(friendId) {
    const result = await authSystem.acceptFriend(friendId);
    if (result.success) {
        showNotification('Dodano znajomego!', 'success');
        await loadFriends();
    } else {
        showNotification(result.error || 'Błąd', 'error');
    }
}

function declineFriendRequest(friendId) {
    // W uproszczeniu - w rzeczywistości potrzebujemy endpoint do odrzucania
    friendRequests = friendRequests.filter(req => req.id !== friendId);
    updateFriendRequestsDisplay();
    showNotification('Odrzucono prośbę', 'info');
}

function inviteFriendToGame(friendId, friendName) {
    if (!gameCode) {
        showNotification('Najpierw stwórz lub dołącz do gry', 'error');
        return;
    }
    
    socket.emit('inviteFriend', { friendId, gameCode });
    showNotification(`Zaproszenie wysłane do ${friendName}`, 'success');
}

// Funkcje pomocnicze
function formatDate(dateString) {
    if (!dateString) return 'Nigdy';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Teraz';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min temu';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' godz. temu';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' dni temu';
    
    return date.toLocaleDateString('pl-PL');
}

// Inicjalizacja
document.addEventListener('DOMContentLoaded', () => {
    // Załaduj znajomych po zalogowaniu
    if (authSystem.currentUser) {
        loadFriends();
    }
    
    // Obsługa zakładek znajomych
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Ukryj wszystkie zakładki
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Usuń aktywną klasę ze wszystkich przycisków
            tabBtns.forEach(b => b.classList.remove('active'));
            
            // Pokaż wybraną zakładkę
            document.getElementById(`${tabId}-tab`).classList.add('active');
            btn.classList.add('active');
        });
    });
    
    // Obsługa zakładek rankingu
    const lbTabBtns = document.querySelectorAll('.lb-tab-btn');
    lbTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-lb-tab');
            
            // Ukryj wszystkie zakładki
            document.querySelectorAll('.leaderboard-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Usuń aktywną klasę ze wszystkich przycisków
            lbTabBtns.forEach(b => b.classList.remove('active'));
            
            // Pokaż wybraną zakładkę
            document.getElementById(`${tabId}-leaderboard`).classList.add('active');
            btn.classList.add('active');
        });
    });
    
    // Wyślij prośbę o dodanie znajomego
    const sendRequestBtn = document.getElementById('send-friend-request-btn');
    if (sendRequestBtn) {
        sendRequestBtn.addEventListener('click', async () => {
            const friendUsername = document.getElementById('friend-username').value.trim();
            if (!friendUsername) {
                showNotification('Wpisz nazwę użytkownika', 'error');
                return;
            }
            
            const result = await authSystem.addFriend(friendUsername);
            if (result.success) {
                showNotification(result.message || 'Wysłano prośbę', 'success');
                document.getElementById('friend-username').value = '';
            } else {
                showNotification(result.error || 'Błąd', 'error');
            }
        });
    }
});

// Eksport dla innych plików
window.gameClient = {
    gameInvitations,
    friendsList,
    friendRequests,
    loadFriends,
    inviteFriendToGame,
    acceptFriendRequest,
    declineFriendRequest,
    formatDate
};
