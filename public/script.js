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
    
    // KLUCZOWA POPRAWKA: impostor widzi podpowiedź, nie hasło
    if (isImpostor && gameState.isPlaying && !gameState.wordGuessed && !gameState.guessFailed) {
        wordDisplay.textContent = gameState.hint; // TYLKO podpowiedź dla impostora
        roleHint.innerHTML = '<i class="fas fa-user-secret"></i> Jesteś IMPOSTOREM! Nie znasz hasła, widzisz tylko podpowiedź. Spróbuj zgadnąć hasło!';
        roleHint.style.color = '#fb8f8f';
        
        // Pokaż listę współimpostorów, jeśli istnieją
        if (gameState.coImpostors && gameState.coImpostors.length > 0) {
            roleHint.innerHTML += `<br><small>Współimpostorzy: ${gameState.coImpostors.join(', ')}</small>`;
        }
        
        // Sprawdź czy impostor może wysyłać skojarzenie (tylko w pierwszej rundzie)
        if (gameState.currentRound > 1) {
            // W drugiej i kolejnych rundach impostor nie może wysyłać skojarzeń
            document.getElementById('association-section').style.display = 'none';
            document.getElementById('guess-section').style.display = 'block';
            document.getElementById('waiting-section').style.display = 'none';
        } else if (gameState.gameMode === 'sequential' && !gameState.isVoting && !gameState.isDeciding && !gameState.wordGuessed && !gameState.guessFailed) {
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
        // Sprawdź czy impostor może wysyłać skojarzenie w trybie simultaneous
        if (isImpostor && gameState.currentRound > 1) {
            document.getElementById('association-section').style.display = 'none';
            document.getElementById('guess-section').style.display = 'block';
            document.getElementById('waiting-section').style.display = 'none';
        } else {
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
            } else {
                document.getElementById('association-input').style.display = 'block';
                document.getElementById('submit-association-btn').style.display = 'flex';
            }
            
            startTimer();
        }
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

// Funkcje dla chatu
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
    
    messageElement.innerHTML = `
        <div class="message-header">
            <div>
                <span class="message-player">${chatMessage.playerName}</span>
                <span class="message-round"> (Runda ${chatMessage.round})</span>
            </div>
            <div class="message-time">${chatMessage.timestamp}</div>
        </div>
        <div class="message-text">${chatMessage.message}</div>
    `;
    
    chatMessagesContainer.appendChild(messageElement);
    
    // Przewiń na dół
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Funkcje dla opcji zaawansowanych
function loadWordsTable() {
    const words = [
        { word: "KOT", hint: "Zwierzę domowe" },
        { word: "SAMOCHÓD", hint: "Środek transportu" },
        { word: "KSIĄŻKA", hint: "Źródło wiedzy" },
        { word: "TELEFON", hint: "Urządzenie do komunikacji" },
        { word: "OKNO", hint: "Element budynku" },
        { word: "DRZEWO", hint: "Roślina" },
        { word: "SŁOŃCE", hint: "Gwiazda" },
        { word: "WODA", hint: "Płyn" },
        { word: "OGIEŃ", hint: "Żywioł" },
        { word: "ZAMEK", hint: "Budowla" },
        { word: "PIES", hint: "Przyjaciel człowieka" },
        { word: "MIASTO", hint: "Duża osada" },
        { word: "RZEKA", hint: "Płynąca woda" },
        { word: "GÓRY", hint: "Wysokie tereny" },
        { word: "MORZE", hint: "Duża woda" },
        { word: "LAS", hint: "Wiele drzew" },
        { word: "SZKŁO", hint: "Przezroczysty materiał" },
        { word: "PAPIER", hint: "Do pisania" },
        { word: "STÓŁ", hint: "Meble" },
        { word: "KRZESŁO", hint: "Do siedzenia" }
    ];
    
    let tableHTML = `
        <table class="words-table">
            <thead>
                <tr>
                    <th>Słowo</th>
                    <th>Podpowiedź</th>
                    <th>Akcja</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    words.forEach(wordPair => {
        tableHTML += `
            <tr>
                <td><strong>${wordPair.word}</strong></td>
                <td>${wordPair.hint}</td>
                <td>
                    <button class="word-select-btn" data-word="${wordPair.word}" data-hint="${wordPair.hint}">
                        Wybierz
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    document.getElementById('words-table-container').innerHTML = tableHTML;
    
    // Dodaj event listeners do przycisków wyboru
    document.querySelectorAll('.word-select-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const word = this.getAttribute('data-word');
            const hint = this.getAttribute('data-hint');
            
            // Zresetuj wszystkie przyciski
            document.querySelectorAll('.word-select-btn').forEach(b => {
                b.classList.remove('selected');
                b.textContent = 'Wybierz';
            });
            
            // Zaznacz wybrany przycisk
            this.classList.add('selected');
            this.textContent = 'Wybrano ✓';
            
            // Zapisz wybrane słowo
            selectedWordForGame = { word, hint };
            
            // Pokaż informację o wybranym słowie
            document.getElementById('selected-word-info').style.display = 'block';
            document.getElementById('selected-word-text').textContent = word;
            document.getElementById('selected-hint-text').textContent = `Podpowiedź: ${hint}`;
            
            // Aktywuj przycisk potwierdzenia
            document.getElementById('confirm-word-btn').disabled = false;
        });
    });
}

// Obsługa przycisków
document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    
    // Ekran startowy
    document.getElementById('create-game-btn').addEventListener('click', () => {
        switchScreen('create');
    });
    
    document.getElementById('join-game-btn').addEventListener('click', () => {
        switchScreen('join');
    });
    
    // Ekran tworzenia gry
    document.getElementById('create-game-final-btn').addEventListener('click', () => {
        const playerName = document.getElementById('player-name-host').value.trim();
        const rounds = document.getElementById('rounds-count').value;
        const roundTime = document.getElementById('round-time').value;
        const numImpostors = document.getElementById('num-impostors').value;
        const gameMode = document.getElementById('game-mode').value;
        
        if (!playerName) {
            showNotification('Wpisz swój pseudonim!', 'error');
            return;
        }
        
        socket.emit('createGame', {
            playerName,
            rounds,
            roundTime,
            numImpostors,
            gameMode,
            customWordData: selectedWordForGame
        });
        
        // Zresetuj wybrane słowo
        selectedWordForGame = null;
    });
    
    document.getElementById('back-to-start-from-create').addEventListener('click', () => {
        switchScreen('start');
    });
    
    // Przycisk opcji zaawansowanych
    document.getElementById('advanced-options-btn').addEventListener('click', () => {
        document.getElementById('advanced-options-modal').style.display = 'flex';
        document.getElementById('password-section').style.display = 'block';
        document.getElementById('word-selection-section').style.display = 'none';
        document.getElementById('advanced-password').value = '';
    });
    
    // Zamykanie modala
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('advanced-options-modal').style.display = 'none';
    });
    
    // Sprawdzanie hasła
    document.getElementById('check-password-btn').addEventListener('click', () => {
        const password = document.getElementById('advanced-password').value;
        
        if (password === 'jasiu23#') {
            document.getElementById('password-section').style.display = 'none';
            document.getElementById('word-selection-section').style.display = 'block';
            
            // Załaduj tabelę słów
            loadWordsTable();
            
            // Zresetuj wybrane słowo
            selectedWordForGame = null;
            document.getElementById('selected-word-info').style.display = 'none';
            document.getElementById('confirm-word-btn').disabled = true;
        } else {
            showNotification('Niepoprawne hasło!', 'error');
        }
    });
    
    // Przycisk użycia własnego słowa
    document.getElementById('use-custom-word-btn').addEventListener('click', () => {
        const customWord = document.getElementById('custom-word').value.trim();
        const customHint = document.getElementById('custom-hint').value.trim();
        
        if (!customWord) {
            showNotification('Wprowadź słowo!', 'error');
            return;
        }
        
        if (!customHint) {
            showNotification('Wprowadź podpowiedź!', 'error');
            return;
        }
        
        // Zresetuj wszystkie przyciski w tabeli
        document.querySelectorAll('.word-select-btn').forEach(b => {
            b.classList.remove('selected');
            b.textContent = 'Wybierz';
        });
        
        // Zapisz własne słowo
        selectedWordForGame = { 
            word: customWord.toUpperCase(), 
            hint: customHint 
        };
        
        // Pokaż informację o wybranym słowie
        document.getElementById('selected-word-info').style.display = 'block';
        document.getElementById('selected-word-text').textContent = customWord.toUpperCase();
        document.getElementById('selected-hint-text').textContent = `Podpowiedź: ${customHint}`;
        
        // Aktywuj przycisk potwierdzenia
        document.getElementById('confirm-word-btn').disabled = false;
        
        showNotification(`Wybrano własne słowo: ${customWord}`, 'success');
    });
    
    // Potwierdzenie wyboru słowa
    document.getElementById('confirm-word-btn').addEventListener('click', () => {
        if (selectedWordForGame) {
            showNotification(`Wybrano słowo: ${selectedWordForGame.word}`, 'success');
            document.getElementById('advanced-options-modal').style.display = 'none';
        }
    });
    
    // Czyszczenie wyboru
    document.getElementById('clear-selection-btn').addEventListener('click', () => {
        selectedWordForGame = null;
        document.querySelectorAll('.word-select-btn').forEach(b => {
            b.classList.remove('selected');
            b.textContent = 'Wybierz';
        });
        document.getElementById('custom-word').value = '';
        document.getElementById('custom-hint').value = '';
        document.getElementById('selected-word-info').style.display = 'none';
        document.getElementById('confirm-word-btn').disabled = true;
    });
    
    // Ekran dołączania do gry
    document.getElementById('join-game-final-btn').addEventListener('click', () => {
        const code = document.getElementById('game-code-input').value.trim().toUpperCase();
        const playerName = document.getElementById('player-name-input').value.trim();
        
        if (!code || code.length !== 6) {
            showNotification('Wpisz poprawny 6-znakowy kod!', 'error');
            return;
        }
        
        if (!playerName) {
            showNotification('Wpisz swój pseudonim!', 'error');
            return;
        }
        
        gameCode = code;
        socket.emit('joinGame', { code, playerName });
    });
    
    document.getElementById('back-to-start-from-join').addEventListener('click', () => {
        switchScreen('start');
    });
    
    document.getElementById('copy-code-btn').addEventListener('click', () => {
        copyToClipboard(gameCode);
    });
    
    document.getElementById('start-game-btn').addEventListener('click', () => {
        socket.emit('startGame');
    });
    
    document.getElementById('cancel-game-btn').addEventListener('click', () => {
        if (confirm('Czy na pewno chcesz anulować grę?')) {
            socket.disconnect();
            initSocket();
            switchScreen('start');
        }
    });
    
    // Ekran gry - skojarzenie
    document.getElementById('submit-association-btn').addEventListener('click', () => {
        const association = document.getElementById('association-input').value.trim();
        
        if (!association) {
            showNotification('Wpisz swoje skojarzenie!', 'error');
            return;
        }
        
        // Sprawdź czy impostor próbuje wysłać skojarzenie w drugiej rundzie
        if (isImpostor && gameState && gameState.currentRound > 1) {
            showNotification('Jesteś impostorem! W tej rundzie możesz tylko zgadywać hasło.', 'error');
            return;
        }
        
        socket.emit('submitAssociation', { association });
        
        document.getElementById('association-input').style.display = 'none';
        document.getElementById('submit-association-btn').style.display = 'none';
        document.getElementById('submitted-message').style.display = 'flex';
        document.getElementById('association-input').value = '';
    });
    
    // Zgadywanie hasła (dla impostora)
    document.getElementById('submit-guess-btn').addEventListener('click', () => {
        const guess = document.getElementById('guess-input').value.trim();
        
        if (!guess) {
            showNotification('Wpisz swoje zgadywanie!', 'error');
            return;
        }
        
        socket.emit('submitGuess', { guess });
        document.getElementById('guess-input').value = '';
        document.getElementById('guessed-message').style.display = 'flex';
    });
    
    // Przyciski decyzji
    document.getElementById('vote-impostor-btn').addEventListener('click', () => {
        socket.emit('submitDecision', { decision: true });
        document.getElementById('decision-status').textContent = 'Wybrałeś: Głosuj na impostora';
        document.getElementById('vote-impostor-btn').disabled = true;
        document.getElementById('continue-game-btn').disabled = true;
    });
    
    document.getElementById('continue-game-btn').addEventListener('click', () => {
        socket.emit('submitDecision', { decision: false });
        document.getElementById('decision-status').textContent = 'Wybrałeś: Graj dalej';
        document.getElementById('vote-impostor-btn').disabled = true;
        document.getElementById('continue-game-btn').disabled = true;
    });
    
    document.getElementById('next-round-btn').addEventListener('click', () => {
        socket.emit('nextRound');
    });
    
    document.getElementById('end-game-btn').addEventListener('click', () => {
        if (confirm('Czy na pewno chcesz zakończyć grę?')) {
            socket.emit('nextRound');
        }
    });
    
    // Ekran wyników końcowych
    document.getElementById('play-again-btn').addEventListener('click', () => {
        if (isHost) {
            socket.emit('restartGame');
        } else {
            showNotification('Poczekaj, aż host zrestartuje grę', 'info');
        }
    });
    
    document.getElementById('back-to-menu-btn').addEventListener('click', () => {
        socket.disconnect();
        initSocket();
        switchScreen('start');
        document.getElementById('fullscreen-back-button').classList.remove('active');
    });
    
    // Przycisk powrotu na pełnym ekranie
    document.getElementById('fullscreen-back-to-menu').addEventListener('click', () => {
        document.getElementById('fullscreen-back-button').classList.remove('active');
        socket.disconnect();
        initSocket();
        switchScreen('start');
    });
    
    // Chat - wysyłanie wiadomości
    document.getElementById('send-chat-btn').addEventListener('click', () => {
        sendChatMessage();
    });
    
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    function sendChatMessage() {
        const message = document.getElementById('chat-input').value.trim();
        
        if (!message) {
            return;
        }
        
        if (!gameState || !gameState.isPlaying) {
            showNotification('Czat jest dostępny tylko podczas gry', 'error');
            return;
        }
        
        socket.emit('sendChatMessage', { message });
        document.getElementById('chat-input').value = '';
    }
    
    // Enter w polu skojarzenia
    document.getElementById('association-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submit-association-btn').click();
        }
    });
    
    // Enter w polu zgadywania
    document.getElementById('guess-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submit-guess-btn').click();
        }
    });
    
    // Automatyczna wielka litera w kodzie gry
    document.getElementById('game-code-input').addEventListener('input', function(e) {
        this.value = this.value.toUpperCase();
    });
    
    // Zamykanie modala po kliknięciu poza nim
    document.getElementById('advanced-options-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
        }
    });
});
