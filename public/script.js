// Zmienne globalne
let socket;
let gameCode = '';
let playerName = '';
let playerId = '';
let isHost = false;
let isImpostor = false;
let currentRound = 0;
let totalRounds = 0;
let roundTime = 45;
let numImpostors = 1;
let gameMode = 'simultaneous';
let timerInterval = null;
let turnTimerInterval = null;
let timeLeft = 45;
let turnTimeLeft = 30;
let gameState = null;
let customWordData = null;
let selectedWordForGame = null;

// Elementy DOM
const screens = {
    start: document.getElementById('start-screen'),
    create: document.getElementById('create-screen'),
    join: document.getElementById('join-screen'),
    waitingHost: document.getElementById('waiting-host-screen'),
    waitingPlayer: document.getElementById('waiting-player-screen'),
    game: document.getElementById('game-screen'),
    finalResults: document.getElementById('final-results-screen')
};

// Funkcje pomocnicze
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function switchScreen(screenId) {
    Object.values(screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    
    if (screens[screenId]) {
        screens[screenId].classList.add('active');
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Kod skopiowany do schowka!', 'success');
    }).catch(err => {
        console.error('Błąd kopiowania: ', err);
    });
}

function updateConnectionStatus(connected) {
    const status = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    
    if (connected) {
        status.classList.remove('disconnected');
        statusText.textContent = 'Połączono';
    } else {
        status.classList.add('disconnected');
        statusText.textContent = 'Rozłączono';
    }
}

// Inicjalizacja połączenia Socket.io
function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Połączono z serwerem');
        playerId = socket.id;
        updateConnectionStatus(true);
        
        // Jeśli gracz był w trakcie gry, przeładuj stronę
        if (gameCode && gameState && gameState.isPlaying) {
            location.reload();
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Rozłączono z serwerem');
        updateConnectionStatus(false);
    });
    
    socket.on('connect_error', (error) => {
        console.error('Błąd połączenia:', error);
        showNotification('Błąd połączenia z serwerem', 'error');
        updateConnectionStatus(false);
    });
    
    socket.on('gameCreated', (data) => {
        gameCode = data.code;
        gameState = data.gameState;
        
        document.getElementById('code-text').textContent = gameCode;
        document.getElementById('waiting-game-mode').textContent = data.gameState.gameMode === 'sequential' ? 'Kolejka' : 'Wszyscy jednocześnie';
        document.getElementById('waiting-impostors').textContent = data.gameState.numImpostors;
        document.getElementById('waiting-rounds').textContent = data.gameState.rounds;
        document.getElementById('waiting-time').textContent = data.gameState.roundTime;
        
        isHost = true;
        switchScreen('waitingHost');
        updatePlayersList();
    });
    
    socket.on('error', (data) => {
        showNotification(data.message, 'error');
    });
    
    socket.on('gameJoined', (data) => {
        gameState = data.gameState;
        
        document.getElementById('waiting-game-code').textContent = gameCode;
        document.getElementById('waiting-player-mode').textContent = data.gameState.gameMode === 'sequential' ? 'Kolejka' : 'Wszyscy jednocześnie';
        document.getElementById('waiting-player-impostors').textContent = data.gameState.numImpostors;
        document.getElementById('waiting-player-rounds').textContent = data.gameState.rounds;
        
        isHost = false;
        switchScreen('waitingPlayer');
        updateWaitingPlayersList();
    });
    
    socket.on('playerJoined', (data) => {
        gameState = data.gameState;
        
        if (isHost) {
            updatePlayersList();
            
            const startBtn = document.getElementById('start-game-btn');
            if (gameState.players.length >= 3) {
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-play"></i> Rozpocznij grę';
            }
        } else {
            updateWaitingPlayersList();
        }
    });
    
    socket.on('gameStarted', (data) => {
        gameState = data.gameState;
        startGame();
    });
    
    socket.on('associationSubmitted', (data) => {
        gameState = data.gameState;
        
        if (isHost) {
            updateGamePlayersList();
        }
        
        updateProgress();
    });
    
    socket.on('nextTurn', (data) => {
        gameState = data.gameState;
        showNextTurn(data.nextPlayerId);
    });
    
    socket.on('decisionPhaseStarted', (data) => {
        gameState = data.gameState;
        showDecisionPhase();
    });
    
    socket.on('decisionSubmitted', (data) => {
        gameState = data.gameState;
        updateGamePlayersList();
    });
    
    socket.on('votingStarted', (data) => {
        gameState = data.gameState;
        if (data.decisionResult) {
            const voteCount = data.decisionResult.voteCount;
            const continueCount = data.decisionResult.continueCount;
            showNotification(`Wynik decyzji: ${voteCount} za głosowaniem, ${continueCount} za kontynuacją. Rozpoczynamy głosowanie!`, 'info');
        }
        startVoting();
    });
    
    socket.on('nextRoundStarted', (data) => {
        gameState = data.gameState;
        startNextRound();
    });
    
    socket.on('wordGuessed', (data) => {
        gameState = data.gameState;
        showWordGuessed(data);
    });
    
    socket.on('guessFailed', (data) => {
        gameState = data.gameState;
        showGuessFailed(data);
    });
    
    socket.on('voteResults', (data) => {
        gameState = data.gameState;
        showVoteResults(data.results, data.outcome);
    });
    
    socket.on('gameEnded', (data) => {
        gameState = data.gameState;
        
        if (timerInterval) clearInterval(timerInterval);
        if (turnTimerInterval) clearInterval(turnTimerInterval);
        
        setTimeout(() => {
            if (data.reason === 'wordGuessed' || data.reason === 'guessFailed' || data.reason === 'allImpostorsFound') {
                showFinalResults(data.reason);
            } else {
                showFinalResults('normal');
            }
            
            // Pokaż przycisk powrotu na pełnym ekranie po 2 sekundach
            setTimeout(() => {
                document.getElementById('fullscreen-back-button').classList.add('active');
            }, 2000);
        }, 1000);
    });
    
    socket.on('gameRestarted', (data) => {
        gameState = data.gameState;
        
        if (isHost) {
            switchScreen('waitingHost');
            updatePlayersList();
        } else {
            switchScreen('waitingPlayer');
            updateWaitingPlayersList();
        }
    });
    
    socket.on('forceReload', () => {
        location.reload();
    });
    
    socket.on('newChatMessage', (data) => {
        gameState = data.gameState;
        addChatMessage(data.chatMessage);
    });
    
    socket.on('playerLeft', (data) => {
        gameState = data.gameState;
        
        if (isHost) {
            updatePlayersList();
        } else {
            updateGamePlayersList();
        }
    });
    
    socket.on('hostDisconnected', () => {
        showNotification('Host opuścił grę. Gra zostanie zakończona.', 'error');
        setTimeout(() => {
            switchScreen('start');
        }, 3000);
    });
}

function updatePlayersList() {
    const playersList = document.getElementById('players-list');
    const playerCount = document.getElementById('player-count');
    
    if (!playersList || !playerCount) return;
    
    playersList.innerHTML = '';
    playerCount.textContent = gameState.players.length;
    
    gameState.players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${player.isHost ? 'host' : ''}`;
        
        playerCard.innerHTML = `
            <div class="player-name">${player.name}</div>
            <div class="player-role">${player.isHost ? 'HOST' : 'GRACZ'}</div>
        `;
        
        playersList.appendChild(playerCard);
    });
}

function updateWaitingPlayersList() {
    const playersList = document.getElementById('waiting-players-list');
    const playerCount = document.getElementById('waiting-player-count');
    
    if (!playersList || !playerCount) return;
    
    playersList.innerHTML = '';
    playerCount.textContent = gameState.players.length;
    
    gameState.players.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${player.isHost ? 'host' : ''}`;
        
        playerCard.innerHTML = `
            <div class="player-name">${player.name}</div>
            <div class="player-role">${player.isHost ? 'HOST' : 'GRACZ'}</div>
        `;
        
        playersList.appendChild(playerCard);
    });
}

function updateGamePlayersList() {
    const playersList = document.getElementById('game-players-list');
    const playersCount = document.getElementById('players-count');
    
    if (!playersList || !playersCount) return;
    
    playersList.innerHTML = '';
    playersCount.textContent = gameState.players.length;
    
    gameState.players.forEach(player => {
        const showImpostor = player.isImpostor && 
            (!gameState.isPlaying || gameState.wordGuessed || gameState.guessFailed || player.id === socket.id);
        
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${showImpostor ? 'impostor' : ''} ${player.isHost ? 'host' : ''}`;
        
        let status = '';
        if (gameState.isPlaying && !gameState.isVoting && !gameState.isDeciding && !gameState.wordGuessed && !gameState.guessFailed) {
            if (gameState.gameMode === 'sequential') {
                status = player.turnCompleted ? 'ready' : 'waiting';
            } else {
                status = player.hasSubmitted ? 'ready' : 'waiting';
            }
        } else if (gameState.isVoting) {
            status = gameState.votes.some(v => v[0] === player.id) ? 'ready' : 'waiting';
        } else if (gameState.isDeciding) {
            status = gameState.decisions.some(d => d[0] === player.id) ? 'ready' : 'waiting';
        }
        
        playerCard.innerHTML = `
            ${status ? `<div class="player-status ${status}"></div>` : ''}
            <div class="player-name">${player.name}</div>
            <div class="player-role">
                ${player.isHost ? 'HOST' : ''}
            </div>
        `;
        
        playersList.appendChild(playerCard);
    });
}

// Rozpoczęcie gry
function startGame() {
    gameState = gameState;
    currentRound = gameState.currentRound;
    totalRounds = gameState.rounds;
    roundTime = gameState.roundTime;
    numImpostors = gameState.numImpostors;
    gameMode = gameState.gameMode;
    
    const playerInfo = gameState.players.find(p => p.id === socket.id);
    if (playerInfo) {
        isImpostor = playerInfo.isImpostor;
        playerName = playerInfo.name;
    }
    
    switchScreen('game');
    updateGameInterface();
    updateGamePlayersList();
    updateSidebarInfo();
    loadChatMessages();
}

function updateGameInterface() {
    document.getElementById('current-round').textContent = gameState.currentRound;
    document.getElementById('total-rounds').textContent = gameState.rounds;
    document.getElementById('impostor-count').textContent = gameState.numImpostors;
    document.getElementById('game-mode-badge').textContent = gameState.gameMode === 'sequential' ? 'Kolejka' : 'Wszyscy';
    
    if (gameState.gameMode === 'sequential') {
        timeLeft = 30;
    } else {
        timeLeft = roundTime;
    }
    
    document.getElementById('timer').textContent = timeLeft;
    
    const wordDisplay = document.getElementById('word-display');
    const roleHint = document.getElementById('role-hint');
    
    // Impostor widzi podpowiedź, nie hasło, ale MOŻE wysyłać skojarzenia we wszystkich rundach!
    if (isImpostor && gameState.isPlaying && !gameState.wordGuessed && !gameState.guessFailed) {
        wordDisplay.textContent = gameState.hint; // TYLKO podpowiedź dla impostora
        roleHint.innerHTML = '<i class="fas fa-user-secret"></i> Jesteś IMPOSTOREM! Nie znasz hasła, widzisz tylko podpowiedź. Spróbuj udawać, że znasz hasło!';
        roleHint.style.color = '#fb8f8f';
        
        // Pokaż listę współimpostorów, jeśli istnieją
        if (gameState.coImpostors && gameState.coImpostors.length > 0) {
            roleHint.innerHTML += `<br><small>Współimpostorzy: ${gameState.coImpostors.join(', ')}</small>`;
        }
        
        // Impostor MOŻE wysyłać skojarzenia we wszystkich rundach!
        // Dodatkowo w trybie sequential może też zgadywać hasło
        if (gameState.gameMode === 'sequential' && !gameState.isVoting && !gameState.isDeciding && !gameState.wordGuessed && !gameState.guessFailed) {
            document.getElementById('guess-section').style.display = 'block';
        } else {
            document.getElementById('guess-section').style.display = 'none';
        }
    } else {
        // Gracz (nie impostor) widzi hasło
        wordDisplay.textContent = gameState.word; // Gracz widzi hasło
        if (isHost) {
            roleHint.innerHTML = '<i class="fas fa-crown"></i> Jesteś HOSTEM. Znajdź impostora po jego skojarzeniach!';
        } else {
            roleHint.innerHTML = '<i class="fas fa-user-check"></i> Jesteś GRACZEM. Znajdź impostora po jego skojarzeniach!';
        }
        roleHint.style.color = '#8f94fb';
        document.getElementById('guess-section').style.display = 'none';
    }
    
    // Aktualizuj wskaźnik rundy w chacie
    document.getElementById('chat-round-indicator').textContent = `Runda: ${gameState.currentRound}`;
    
    if (gameState.gameMode === 'sequential') {
        const turnSection = document.getElementById('turn-section');
        const currentTurnPlayerId = gameState.currentTurnPlayerId;
        
        if (currentTurnPlayerId && !gameState.isVoting && !gameState.isDeciding && !gameState.wordGuessed && !gameState.guessFailed) {
            turnSection.style.display = 'block';
            const currentPlayer = gameState.players.find(p => p.id === currentTurnPlayerId);
            document.getElementById('current-turn-player').innerHTML = `
                <div class="player-card ${currentPlayer.isImpostor ? 'impostor' : ''}" style="display: inline-block; padding: 10px 20px;">
                    <div class="player-name">${currentPlayer.name}</div>
                </div>
            `;
            
            if (currentTurnPlayerId === socket.id) {
                document.getElementById('association-section').style.display = 'block';
                document.getElementById('waiting-section').style.display = 'none';
                document.getElementById('association-instruction').textContent = 'Twoja kolej! Wpisz skojarzenie:';
                document.getElementById('association-input').disabled = false;
                document.getElementById('submit-association-btn').disabled = false;
                
                // Jeśli to impostor, pokaż też sekcję zgadywania
                if (isImpostor) {
                    document.getElementById('guess-section').style.display = 'block';
                }
                
                startTurnTimer();
            } else {
                document.getElementById('association-section').style.display = 'none';
                document.getElementById('waiting-section').style.display = 'block';
                document.getElementById('waiting-message-text').textContent = `Oczekiwanie na ${currentPlayer.name}...`;
            }
        } else {
            turnSection.style.display = 'none';
        }
    }
    
    if (gameState.wordGuessed || gameState.guessFailed) {
        document.getElementById('association-section').style.display = 'none';
        document.getElementById('waiting-section').style.display = 'none';
        document.getElementById('voting-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('decision-section').style.display = 'none';
        document.getElementById('turn-section').style.display = 'none';
        document.getElementById('word-guessed-section').style.display = 'block';
    } else if (gameState.isDeciding) {
        showDecisionPhase();
    } else if (gameState.isVoting) {
        startVoting();
    } else if (!gameState.isPlaying || gameState.gameEnded) {
        document.getElementById('association-section').style.display = 'none';
        document.getElementById('waiting-section').style.display = 'none';
        document.getElementById('voting-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('decision-section').style.display = 'none';
        document.getElementById('turn-section').style.display = 'none';
        document.getElementById('word-guessed-section').style.display = 'none';
    } else if (gameState.gameMode === 'simultaneous') {
        // W trybie simultaneous wszyscy grają jednocześnie
        document.getElementById('association-section').style.display = 'block';
        document.getElementById('waiting-section').style.display = 'none';
        document.getElementById('voting-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('decision-section').style.display = 'none';
        document.getElementById('turn-section').style.display = 'none';
        document.getElementById('word-guessed-section').style.display = 'none';
        
        document.getElementById('association-input').value = '';
        document.getElementById('submitted-message').style.display = 'none';
        document.getElementById('guessed-message').style.display = 'none';
        
        const player = gameState.players.find(p => p.id === socket.id);
        if (player && player.hasSubmitted) {
            document.getElementById('association-input').style.display = 'none';
            document.getElementById('submit-association-btn').style.display = 'none';
            document.getElementById('submitted-message').style.display = 'flex';
            
            // Jeśli impostor już wysłał skojarzenie, pokaż sekcję zgadywania
            if (isImpostor) {
                document.getElementById('guess-section').style.display = 'block';
            }
        } else {
            document.getElementById('association-input').style.display = 'block';
            document.getElementById('submit-association-btn').style.display = 'flex';
            
            // Jeśli impostor, pokaż też sekcję zgadywania
            if (isImpostor) {
                document.getElementById('guess-section').style.display = 'block';
            }
        }
        
        startTimer();
    }
    
    if (isHost && gameState.isPlaying && !gameState.wordGuessed && !gameState.guessFailed && !gameState.isVoting && !gameState.isDeciding) {
        document.getElementById('host-controls').style.display = 'flex';
    } else {
        document.getElementById('host-controls').style.display = 'none';
    }
    
    updateProgress();
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timeLeft = roundTime;
    document.getElementById('timer').textContent = timeLeft;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);
}

function startTurnTimer() {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    
    turnTimeLeft = 30;
    document.getElementById('turn-timer').textContent = turnTimeLeft;
    
    turnTimerInterval = setInterval(() => {
        turnTimeLeft--;
        document.getElementById('turn-timer').textContent = turnTimeLeft;
        
        if (turnTimeLeft <= 0) {
            clearInterval(turnTimerInterval);
        }
    }, 1000);
}

function showNextTurn(nextPlayerId) {
    if (nextPlayerId === socket.id) {
        showNotification('Twoja kolej!', 'info');
    }
    updateGameInterface();
}

function updateProgress() {
    if (!gameState || !gameState.players) return;
    
    let submittedPlayers = 0;
    let totalPlayers = gameState.players.length;
    
    if (gameState.isDeciding) {
        submittedPlayers = gameState.players.filter(p => p.hasDecided).length;
    } else if (gameState.gameMode === 'sequential') {
        submittedPlayers = gameState.players.filter(p => p.turnCompleted).length;
    } else {
        submittedPlayers = gameState.players.filter(p => p.hasSubmitted).length;
    }
    
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    
    if (progressText && progressFill) {
        if (gameState.isDeciding) {
            progressText.textContent = `${submittedPlayers}/${totalPlayers} podjęło decyzję`;
        } else if (gameState.gameMode === 'sequential') {
            progressText.textContent = `${submittedPlayers}/${totalPlayers} graczy skończyło turę`;
        } else {
            progressText.textContent = `${submittedPlayers}/${totalPlayers} graczy gotowych`;
        }
        const progressPercent = totalPlayers > 0 ? (submittedPlayers / totalPlayers) * 100 : 0;
        progressFill.style.width = `${progressPercent}%`;
    }
}

// Faza decyzji
function showDecisionPhase() {
    document.getElementById('association-section').style.display = 'none';
    document.getElementById('waiting-section').style.display = 'none';
    document.getElementById('voting-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('turn-section').style.display = 'none';
    document.getElementById('word-guessed-section').style.display = 'none';
    document.getElementById('decision-section').style.display = 'block';
    
    displayAssociationsWithNames();
    
    document.getElementById('decision-status').textContent = 'Oczekiwanie na twoją decysję...';
    document.getElementById('vote-impostor-btn').disabled = false;
    document.getElementById('continue-game-btn').disabled = false;
}

function displayAssociationsWithNames() {
    const container = document.getElementById('decision-associations-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!gameState || !gameState.associations) return;
    
    gameState.associations.forEach((assoc, index) => {
        const associationCard = document.createElement('div');
        associationCard.className = 'association-card';
        associationCard.style.border = '2px solid #4e54c8';
        associationCard.style.background = 'rgba(78, 84, 200, 0.1)';
        associationCard.style.minWidth = '200px';
        associationCard.style.padding = '15px';
        associationCard.style.borderRadius = '10px';
        
        const hasAssociation = assoc.association && assoc.association.trim() !== '';
        const associationText = hasAssociation ? assoc.association : '(brak skojarzenia)';
        const textColor = hasAssociation ? '#ffffff' : '#888888';
        const textStyle = hasAssociation ? 'normal' : 'italic';
        
        associationCard.innerHTML = `
            <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.3); color: #fff; width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                ${index + 1}
            </div>
            <div style="font-weight: bold; color: #8f94fb; margin-bottom: 10px; text-align: center;">
                <i class="fas fa-user"></i> ${assoc.playerName}
            </div>
            <div style="font-size: 1.3rem; font-weight: bold; text-align: center; color: ${textColor}; font-style: ${textStyle};">${associationText}</div>
        `;
        
        container.appendChild(associationCard);
    });
}

// Głosowanie
function startVoting() {
    document.getElementById('association-section').style.display = 'none';
    document.getElementById('waiting-section').style.display = 'none';
    document.getElementById('decision-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('turn-section').style.display = 'none';
    document.getElementById('word-guessed-section').style.display = 'none';
    document.getElementById('voting-section').style.display = 'block';
    
    loadAssociationsForVoting();
    loadVoteOptions();
    
    document.getElementById('voted-message').style.display = 'none';
}

function loadAssociationsForVoting() {
    const associationsList = document.getElementById('associations-list');
    if (!associationsList) return;
    
    associationsList.innerHTML = '';
    
    if (!gameState || !gameState.associations) return;
    
    gameState.associations.forEach((assoc, index) => {
        const associationCard = document.createElement('div');
        associationCard.className = 'association-card';
        associationCard.style.border = '2px solid #4e54c8';
        associationCard.style.background = 'rgba(78, 84, 200, 0.1)';
        
        const hasAssociation = assoc.association && assoc.association.trim() !== '';
        const associationText = hasAssociation ? assoc.association : '(brak skojarzenia)';
        const textColor = hasAssociation ? '#ffffff' : '#888888';
        const textStyle = hasAssociation ? 'normal' : 'italic';
        
        associationCard.innerHTML = `
            <div class="association-number">${index + 1}</div>
            <div class="player-name" style="color: #8f94fb; margin-bottom: 10px;">
                <i class="fas fa-user"></i> ${assoc.playerName}
            </div>
            <div class="association-text" style="color: ${textColor}; font-style: ${textStyle};">${associationText}</div>
        `;
        
        associationsList.appendChild(associationCard);
    });
}

function loadVoteOptions() {
    const voteOptions = document.getElementById('vote-options');
    if (!voteOptions) return;
    
    voteOptions.innerHTML = '';
    
    if (!gameState || !gameState.players) return;
    
    gameState.players.forEach(player => {
        const voteBtn = document.createElement('button');
        voteBtn.className = 'vote-btn';
        voteBtn.textContent = player.name;
        voteBtn.dataset.playerId = player.id;
        
        voteBtn.addEventListener('click', () => {
            document.querySelectorAll('.vote-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            voteBtn.classList.add('selected');
            
            if (!document.getElementById('submit-vote-btn')) {
                const submitVoteBtn = document.createElement('button');
                submitVoteBtn.id = 'submit-vote-btn';
                submitVoteBtn.className = 'btn btn-primary';
                submitVoteBtn.innerHTML = '<i class="fas fa-vote-yea"></i> Zagłosuj';
                submitVoteBtn.style.marginTop = '20px';
                submitVoteBtn.style.width = '100%';
                
                submitVoteBtn.addEventListener('click', () => {
                    const selectedVoteBtn = document.querySelector('.vote-btn.selected');
                    if (!selectedVoteBtn) return;
                    
                    const votedPlayerId = selectedVoteBtn.dataset.playerId;
                    socket.emit('submitVote', { votedPlayerId });
                    
                    submitVoteBtn.disabled = true;
                    submitVoteBtn.textContent = 'Głos oddany';
                    document.getElementById('voted-message').style.display = 'flex';
                });
                
                voteOptions.appendChild(submitVoteBtn);
            }
            
            document.getElementById('submit-vote-btn').disabled = false;
        });
        
        voteOptions.appendChild(voteBtn);
    });
}

function showVoteResults(results, outcome) {
    document.getElementById('voting-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    
    const resultsContent = document.getElementById('results-content');
    
    let resultsHTML = '';
    
    if (outcome.type === 'impostorVotedOut') {
        const votedOutPlayer = gameState.players.find(p => p.id === outcome.votedOutId);
        
        resultsHTML = `
            <div class="results-card win">
                <h2 class="results-title"><i class="fas fa-trophy"></i> GRACZE WYGRYWAJĄ!</h2>
                <p class="results-message">Wykryto impostora: <strong>${votedOutPlayer.name}</strong></p>
                
                <div class="impostor-reveal">
                    <h4>PRAWDZIWI IMPOSTORZY:</h4>
                    ${gameState.impostorIds.map(impostorId => {
                        const impostor = gameState.players.find(p => p.id === impostorId);
                        return impostor ? `<p style="font-size: 1.5rem; font-weight: bold; color: #fb8f8f;">
                            ${impostor.name} ${impostorId === outcome.votedOutId ? '✅ (wykryty)' : ''}
                        </p>` : '';
                    }).join('')}
                    <p>Hasło w tej rundzie było: <strong>${gameState.word}</strong></p>
                    <p>Impostorzy widzieli podpowiedź: <strong>${gameState.hint}</strong></p>
                </div>
            </div>
        `;
    } else if (outcome.type === 'innocentVotedOut') {
        const votedOutPlayer = gameState.players.find(p => p.id === outcome.votedOutId);
        
        resultsHTML = `
            <div class="results-card lose">
                <h2 class="results-title"><i class="fas fa-user-secret"></i> IMPOSTORZY WYGRYWAJĄ!</h2>
                <p class="results-message">Głosowano na niewinnego gracza: <strong>${votedOutPlayer.name}</strong></p>
                
                <div class="impostor-reveal">
                    <h4>PRAWDZIWI IMPOSTORZY:</h4>
                    ${gameState.impostorIds.map(impostorId => {
                        const impostor = gameState.players.find(p => p.id === impostorId);
                        return impostor ? `<p style="font-size: 1.5rem; font-weight: bold; color: #fb8f8f;">
                            ${impostor.name}
                        </p>` : '';
                    }).join('')}
                    <p>Hasło w tej rundzie było: <strong>${gameState.word}</strong></p>
                    <p>Impostorzy widzieli podpowiedź: <strong>${gameState.hint}</strong></p>
                </div>
            </div>
        `;
    } else {
        resultsHTML = `
            <div class="results-card">
                <h2 class="results-title"><i class="fas fa-handshake"></i> REMIS!</h2>
                <p class="results-message">Nikt nie został wybrany lub głosy były równe.</p>
                
                <div class="impostor-reveal">
                    <h4>PRAWDZIWI IMPOSTORZY:</h4>
                    ${gameState.impostorIds.map(impostorId => {
                        const impostor = gameState.players.find(p => p.id === impostorId);
                        return impostor ? `<p style="font-size: 1.5rem; font-weight: bold; color: #fb8f8f;">
                            ${impostor.name}
                        </p>` : '';
                    }).join('')}
                    <p>Hasło w tej rundzie było: <strong>${gameState.word}</strong></p>
                </div>
            </div>
        `;
    }
    
    resultsContent.innerHTML = resultsHTML;
    
    if (isHost && gameState.isPlaying && !gameState.gameEnded) {
        document.getElementById('host-controls').style.display = 'flex';
    }
}

function showWordGuessed(data) {
    const wordGuessedSection = document.getElementById('word-guessed-section');
    const wordGuessedContent = document.getElementById('word-guessed-content');
    
    wordGuessedSection.style.display = 'block';
    
    wordGuessedContent.innerHTML = `
        <p style="font-size: 1.5rem; color: #ffffff;">
            Impostor <strong style="color: #fb8f8f;">${data.guesserName}</strong> odgadł hasło!
        </p>
        <p style="font-size: 1.8rem; font-weight: bold; color: #8ffb8f; margin: 20px 0;">
            Hasło: ${data.word}
        </p>
        <p style="color: #fb8f8f; font-size: 1.2rem;">
            Impostorzy wygrywają rundę!
        </p>
        <p style="margin-top: 30px; color: #b0b0d0;">
            Gra zakończona.
        </p>
    `;
}

function showGuessFailed(data) {
    const wordGuessedSection = document.getElementById('word-guessed-section');
    const wordGuessedContent = document.getElementById('word-guessed-content');
    
    wordGuessedSection.style.display = 'block';
    
    wordGuessedContent.innerHTML = `
        <p style="font-size: 1.5rem; color: #ffffff;">
            Impostor <strong style="color: #fb8f8f;">${data.guesserName}</strong> nie odgadł hasła!
        </p>
        <p style="font-size: 1.8rem; font-weight: bold; color: #8ffb8f; margin: 20px 0;">
            Hasło: ${data.word}
        </p>
        <p style="color: #8ffb8f; font-size: 1.2rem;">
            Gracze wygrywają!
        </p>
        <p style="margin-top: 30px; color: #b0b0d0;">
            Gra zakończona.
        </p>
    `;
}

function startNextRound() {
    if (timerInterval) clearInterval(timerInterval);
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    
    updateGameInterface();
}

function updateSidebarInfo() {
    document.getElementById('sidebar-game-mode').textContent = gameState.gameMode === 'sequential' ? 'Kolejka' : 'Wszyscy';
    document.getElementById('sidebar-impostor-count').textContent = gameState.numImpostors;
    
    if (isImpostor && gameState.isPlaying) {
        document.getElementById('sidebar-current-word').textContent = gameState.hint;
    } else {
        document.getElementById('sidebar-current-word').textContent = gameState.word;
    }
}

function showFinalResults(reason) {
    const sortedPlayers = [...gameState.players].sort((a, b) => {
        if (a.isImpostor && !b.isImpostor) return -1;
        if (!a.isImpostor && b.isImpostor) return 1;
        return 0;
    });
    
    let resultsHTML = '';
    
    if (reason === 'wordGuessed') {
        resultsHTML = `
            <div class="results-card lose">
                <h2 class="results-title">
                    <i class="fas fa-user-secret"></i> IMPOSTORZY WYGRYWAJĄ!
                </h2>
                <p style="font-size: 1.3rem; color: #fb8f8f; margin: 20px 0;">
                    Impostor odgadł hasło: <strong>${gameState.word}</strong>
                </p>
        `;
    } else if (reason === 'guessFailed') {
        resultsHTML = `
            <div class="results-card win">
                <h2 class="results-title">
                    <i class="fas fa-trophy"></i> GRACZE WYGRYWAJĄ!
                </h2>
                <p style="font-size: 1.3rem; color: #8ffb8f; margin: 20px 0;">
                    Impostor nie odgadł hasła: <strong>${gameState.word}</strong>
                </p>
        `;
    } else if (reason === 'allImpostorsFound') {
        resultsHTML = `
            <div class="results-card win">
                <h2 class="results-title">
                    <i class="fas fa-trophy"></i> GRACZE WYGRYWAJĄ!
                </h2>
                <p style="font-size: 1.3rem; color: #8ffb8f; margin: 20px 0;">
                    Wszyscy impostorzy zostali wykryci!
                </p>
        `;
    } else {
        resultsHTML = `
            <div class="results-card">
                <h2 class="results-title">
                    <i class="fas fa-flag-checkered"></i> KONIEC GRY!
                </h2>
        `;
    }
    
    resultsHTML += `
        <div style="margin: 30px 0;">
            <h3 style="color: #8f94fb; margin-bottom: 20px;">Role graczy:</h3>
            <div style="background: rgba(15, 21, 48, 0.5); border-radius: 10px; padding: 20px;">
                ${sortedPlayers.map((player, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; 
                                padding: 15px; border-bottom: ${index < sortedPlayers.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'};
                                background: ${player.isImpostor ? 'rgba(200, 78, 78, 0.2)' : 'rgba(78, 84, 200, 0.2)'}; border-radius: 8px; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.2rem;">${player.name}</div>
                                <div style="font-size: 0.9rem; color: ${player.isImpostor ? '#fb8f8f' : '#8f94fb'}">
                                    ${player.isImpostor ? 'IMPOSTOR' : player.isHost ? 'HOST' : 'GRACZ'}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background: rgba(15, 21, 48, 0.5); border-radius: 10px;">
            <h4 style="color: #8f94fb; margin-bottom: 15px;">Podsumowanie:</h4>
            <ul style="color: #b0b0d0; line-height: 1.8;">
                <li>Ostatnie hasło: <strong>${gameState.word}</strong></li>
                <li>Impostorzy widzieli: <strong>${gameState.hint}</strong></li>
                <li>Rozegrane rundy: <strong>${gameState.currentRound}</strong></li>
                <li>Impostorzy: <strong>${gameState.impostorIds.length}</strong></li>
            </ul>
        </div>
        
        <p style="margin-top: 30px; color: #b0b0d0; font-style: italic;">
            Dziękujemy za grę!
        </p>
    </div>`;
    
    document.getElementById('final-results-content').innerHTML = resultsHTML;
    switchScreen('finalResults');
}

// Kontynuacja funkcji loadChatMessages
function loadChatMessages() {
    const chatMessagesContainer = document.getElementById('chat-messages');
    if (!chatMessagesContainer || !gameState || !gameState.chatMessages) return;
    
    chatMessagesContainer.innerHTML = '';
    
    gameState.chatMessages.forEach(chatMessage => {
        addChatMessage(chatMessage);
    });
    
    // Przewiń na dół
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function addChatMessage(chatMessage) {
    const chatMessagesContainer = document.getElementById('chat-messages');
    if (!chatMessagesContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    // Sprawdź czy to wiadomość od aktualnego gracza
    const isCurrentUser = chatMessage.playerId === socket.id;
    
    messageElement.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-message-sender">${chatMessage.playerName}</span>
            <span class="chat-message-time">${chatMessage.timestamp}</span>
            ${chatMessage.round ? `<span class="chat-message-round">Runda ${chatMessage.round}</span>` : ''}
        </div>
        <div class="chat-message-content">${chatMessage.message}</div>
    `;
    
    if (isCurrentUser) {
        messageElement.classList.add('current-user');
    }
    
    chatMessagesContainer.appendChild(messageElement);
    
    // Przewiń na dół
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Funkcje dla strony głównej
function createGame() {
    const nameInput = document.getElementById('create-name');
    const roundsInput = document.getElementById('rounds');
    const timeInput = document.getElementById('round-time');
    const impostorsInput = document.getElementById('impostors');
    const gameModeSelect = document.getElementById('game-mode');
    const customWordCheckbox = document.getElementById('custom-word-checkbox');
    const customWordSection = document.getElementById('custom-word-section');
    const customWordInput = document.getElementById('custom-word');
    const customHintInput = document.getElementById('custom-hint');
    
    playerName = nameInput.value.trim();
    
    if (!playerName) {
        showNotification('Wprowadź swoje imię', 'error');
        return;
    }
    
    const rounds = parseInt(roundsInput.value);
    const roundTime = parseInt(timeInput.value);
    const numImpostors = parseInt(impostorsInput.value);
    const gameMode = gameModeSelect.value;
    
    if (customWordCheckbox.checked) {
        const customWord = customWordInput.value.trim();
        const customHint = customHintInput.value.trim();
        
        if (!customWord || !customHint) {
            showNotification('Wprowadź hasło i podpowiedź', 'error');
            return;
        }
        
        customWordData = {
            word: customWord.toUpperCase(),
            hint: customHint
        };
    } else {
        customWordData = null;
    }
    
    if (customWordData) {
        selectedWordForGame = {
            word: customWordData.word,
            hint: customWordData.hint
        };
    }
    
    socket.emit('createGame', {
        playerName,
        rounds,
        roundTime,
        numImpostors,
        gameMode,
        customWordData
    });
}

function joinGame() {
    const nameInput = document.getElementById('join-name');
    const codeInput = document.getElementById('game-code');
    
    playerName = nameInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();
    
    if (!playerName || !code) {
        showNotification('Wprowadź imię i kod gry', 'error');
        return;
    }
    
    gameCode = code;
    socket.emit('joinGame', { code, playerName });
}

// Obsługa zdarzeń DOM
document.addEventListener('DOMContentLoaded', () => {
    // Przycisk tworzenia gry
    const createBtn = document.getElementById('create-btn');
    if (createBtn) {
        createBtn.addEventListener('click', createGame);
    }
    
    // Przycisk dołączania do gry
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn) {
        joinBtn.addEventListener('click', joinGame);
    }
    
    // Kopiowanie kodu
    const copyCodeBtn = document.getElementById('copy-code-btn');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', () => {
            copyToClipboard(gameCode);
        });
    }
    
    // Powrót do menu głównego
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (socket && gameCode) {
                socket.disconnect();
            }
            location.reload();
        });
    }
    
    const backBtnWaiting = document.getElementById('back-btn-waiting');
    if (backBtnWaiting) {
        backBtnWaiting.addEventListener('click', () => {
            if (socket && gameCode) {
                socket.disconnect();
            }
            location.reload();
        });
    }
    
    const backBtnWaitingPlayer = document.getElementById('back-btn-waiting-player');
    if (backBtnWaitingPlayer) {
        backBtnWaitingPlayer.addEventListener('click', () => {
            if (socket && gameCode) {
                socket.disconnect();
            }
            location.reload();
        });
    }
    
    // Start gry (host)
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            if (gameState.players.length < 3) {
                showNotification('Potrzeba co najmniej 3 graczy aby rozpocząć grę', 'error');
                return;
            }
            socket.emit('startGame');
        });
    }
    
    // Przełącznik dla custom słowa
    const customWordCheckbox = document.getElementById('custom-word-checkbox');
    const customWordSection = document.getElementById('custom-word-section');
    if (customWordCheckbox && customWordSection) {
        customWordCheckbox.addEventListener('change', (e) => {
            customWordSection.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    // Wysyłanie skojarzenia
    const submitAssociationBtn = document.getElementById('submit-association-btn');
    const associationInput = document.getElementById('association-input');
    
    if (submitAssociationBtn && associationInput) {
        submitAssociationBtn.addEventListener('click', () => {
            const association = associationInput.value.trim();
            
            if (!association) {
                showNotification('Wpisz skojarzenie', 'error');
                return;
            }
            
            socket.emit('submitAssociation', { association });
            
            associationInput.value = '';
            associationInput.disabled = true;
            submitAssociationBtn.disabled = true;
        });
        
        // Wysyłanie na Enter
        associationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitAssociationBtn.click();
            }
        });
    }
    
    // Zgadywanie hasła przez impostora
    const submitGuessBtn = document.getElementById('submit-guess-btn');
    const guessInput = document.getElementById('guess-input');
    
    if (submitGuessBtn && guessInput) {
        submitGuessBtn.addEventListener('click', () => {
            const guess = guessInput.value.trim();
            
            if (!guess) {
                showNotification('Wpisz swoje zgadnięcie hasła', 'error');
                return;
            }
            
            socket.emit('submitGuess', { guess });
            
            guessInput.value = '';
            guessInput.disabled = true;
            submitGuessBtn.disabled = true;
        });
        
        // Wysyłanie na Enter
        guessInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitGuessBtn.click();
            }
        });
    }
    
    // Decyzje głosowania
    const voteImpostorBtn = document.getElementById('vote-impostor-btn');
    const continueGameBtn = document.getElementById('continue-game-btn');
    
    if (voteImpostorBtn) {
        voteImpostorBtn.addEventListener('click', () => {
            socket.emit('submitDecision', { decision: true });
            
            voteImpostorBtn.disabled = true;
            continueGameBtn.disabled = true;
            
            document.getElementById('decision-status').textContent = 'Twoja decyzja została wysłana';
        });
    }
    
    if (continueGameBtn) {
        continueGameBtn.addEventListener('click', () => {
            socket.emit('submitDecision', { decision: false });
            
            voteImpostorBtn.disabled = true;
            continueGameBtn.disabled = true;
            
            document.getElementById('decision-status').textContent = 'Twoja decyzja została wysłana';
        });
    }
    
    // Następna runda (host)
    const nextRoundBtn = document.getElementById('next-round-btn');
    if (nextRoundBtn) {
        nextRoundBtn.addEventListener('click', () => {
            socket.emit('nextRound');
        });
    }
    
    // Restart gry (host)
    const restartGameBtn = document.getElementById('restart-game-btn');
    if (restartGameBtn) {
        restartGameBtn.addEventListener('click', () => {
            if (confirm('Czy na pewno chcesz zrestartować grę? Wszyscy gracze zostaną rozłączeni.')) {
                socket.emit('restartGame');
            }
        });
    }
    
    // Obsługa chatu
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    
    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener('click', () => {
            sendChatMessage();
        });
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
        
        function sendChatMessage() {
            const message = chatInput.value.trim();
            
            if (!message) {
                showNotification('Wpisz wiadomość', 'error');
                return;
            }
            
            if (!gameState || !gameState.isPlaying) {
                showNotification('Możesz pisać tylko podczas gry', 'error');
                return;
            }
            
            socket.emit('sendChatMessage', { message });
            
            chatInput.value = '';
            chatInput.focus();
        }
    }
    
    // Toggle chat
    const toggleChatBtn = document.getElementById('toggle-chat-btn');
    const chatContainer = document.getElementById('chat-container');
    
    if (toggleChatBtn && chatContainer) {
        toggleChatBtn.addEventListener('click', () => {
            if (chatContainer.style.display === 'none') {
                chatContainer.style.display = 'flex';
                toggleChatBtn.innerHTML = '<i class="fas fa-times"></i>';
            } else {
                chatContainer.style.display = 'none';
                toggleChatBtn.innerHTML = '<i class="fas fa-comments"></i>';
            }
        });
    }
    
    // Toggle sidebar
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    
    if (toggleSidebarBtn && sidebar) {
        toggleSidebarBtn.addEventListener('click', () => {
            if (sidebar.style.display === 'none') {
                sidebar.style.display = 'flex';
                toggleSidebarBtn.innerHTML = '<i class="fas fa-times"></i>';
            } else {
                sidebar.style.display = 'none';
                toggleSidebarBtn.innerHTML = '<i class="fas fa-info-circle"></i>';
            }
        });
    }
    
    // Przycisk powrotu na pełnym ekranie wyników
    const fullscreenBackBtn = document.getElementById('fullscreen-back-button');
    if (fullscreenBackBtn) {
        fullscreenBackBtn.addEventListener('click', () => {
            location.reload();
        });
    }
    
    // Przejścia między ekranami
    document.getElementById('create-game-link').addEventListener('click', () => {
        switchScreen('create');
    });
    
    document.getElementById('join-game-link').addEventListener('click', () => {
        switchScreen('join');
    });
    
    document.getElementById('back-to-start-create').addEventListener('click', () => {
        switchScreen('start');
    });
    
    document.getElementById('back-to-start-join').addEventListener('click', () => {
        switchScreen('start');
    });
    
    // Obsługa trybu pełnoekranowego
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    function handleFullscreenChange() {
        const isFullscreen = document.fullscreenElement || 
                            document.webkitFullscreenElement || 
                            document.mozFullScreenElement || 
                            document.msFullscreenElement;
        
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = isFullscreen ? 
                '<i class="fas fa-compress-alt"></i>' : 
                '<i class="fas fa-expand-alt"></i>';
        }
    }
    
    // Przycisk pełnoekranowy
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    function toggleFullscreen() {
        const elem = document.documentElement;
        
        if (!document.fullscreenElement && 
            !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && 
            !document.msFullscreenElement) {
            
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }
    
    // Automatyczne ukrywanie notification po czasie
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    });
    
    // Ustaw domyślne wartości dla tworzenia gry
    const roundsInput = document.getElementById('rounds');
    const timeInput = document.getElementById('round-time');
    const impostorsInput = document.getElementById('impostors');
    
    if (roundsInput) roundsInput.value = 5;
    if (timeInput) timeInput.value = 45;
    if (impostorsInput) impostorsInput.value = 1;
    
    // Testowy słownik
    const testWord = document.getElementById('test-word');
    if (testWord) {
        testWord.addEventListener('click', () => {
            const testWords = [
                { word: "KOT", hint: "Zwierzę domowe" },
                { word: "SAMOCHÓD", hint: "Środek transportu" },
                { word: "TELEFON", hint: "Urządzenie do komunikacji" }
            ];
            
            const randomWord = testWords[Math.floor(Math.random() * testWords.length)];
            
            document.getElementById('custom-word').value = randomWord.word;
            document.getElementById('custom-hint').value = randomWord.hint;
            
            showNotification(`Wylosowano hasło: ${randomWord.word} z podpowiedzią: ${randomWord.hint}`, 'success');
        });
    }
    
    // Inicjalizacja Socket.io
    initSocket();
    
    // Ukrywanie chat i sidebar na poczatku
    if (chatContainer) {
        chatContainer.style.display = 'none';
    }
    
    if (sidebar) {
        sidebar.style.display = 'none';
    }
    
    // Ukryj przycisk powrotu na pełnym ekranie
    if (fullscreenBackBtn) {
        fullscreenBackBtn.classList.remove('active');
    }
});

// Obsługa offline
window.addEventListener('offline', () => {
    showNotification('Utracono połączenie z internetem', 'error');
    updateConnectionStatus(false);
});

window.addEventListener('online', () => {
    showNotification('Przywrócono połączenie z internetem', 'success');
    updateConnectionStatus(true);
});
