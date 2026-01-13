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
        updateConnectionStatus(true);
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
    
    socket.on('voteSubmitted', (data) => {
        gameState = data.gameState;
        updateGamePlayersList();
        updateVoteProgress();
    });
    
    socket.on('voteResults', (data) => {
        gameState = data.gameState;
        showVoteResults(data.results);
    });
    
    socket.on('nextRoundStarted', (data) => {
        gameState = data.gameState;
        if (data.decisionResult) {
            const voteCount = data.decisionResult.voteCount;
            const continueCount = data.decisionResult.continueCount;
            const wordKept = data.keepSameWord ? ' (zachowano hasło)' : '';
            showNotification(`Wynik decyzji: ${continueCount} za kontynuacją, ${voteCount} za głosowaniem${wordKept}. Gramy dalej!`, 'success');
        }
        startNextRound();
    });
    
    socket.on('wordGuessed', (data) => {
        gameState = data.gameState;
        showWordGuessed(data);
    });
    
    socket.on('guessResult', (data) => {
        if (data.correct === false) {
            showNotification('Nieprawidłowe zgadywanie!', 'error');
        }
    });
    
    socket.on('gameEnded', (data) => {
        gameState = data.gameState;
        if (data.reason === 'wordGuessed') {
            setTimeout(() => {
                showFinalResults();
            }, 3000);
        } else {
            showFinalResults();
        }
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
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${player.isImpostor ? 'impostor' : ''} ${player.isHost ? 'host' : ''}`;
        
        let status = '';
        if (gameState.isPlaying && !gameState.isVoting && !gameState.isDeciding) {
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
                ${player.isHost ? 'HOST' : player.isImpostor ? 'IMPOSTOR' : 'GRACZ'}
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
}

function updateGameInterface() {
    document.getElementById('current-round').textContent = gameState.currentRound;
    document.getElementById('total-rounds').textContent = gameState.rounds;
    document.getElementById('impostor-count').textContent = gameState.numImpostors;
    document.getElementById('game-mode-badge').textContent = gameState.gameMode === 'sequential' ? 'Kolejka' : 'Wszyscy';
    
    // Ustaw czas w zależności od trybu
    if (gameState.gameMode === 'sequential') {
        timeLeft = 30; // Czas na turę w trybie sequential
    } else {
        timeLeft = roundTime;
    }
    
    document.getElementById('timer').textContent = timeLeft;
    
    const wordDisplay = document.getElementById('word-display');
    const roleHint = document.getElementById('role-hint');
    
    if (isImpostor) {
        wordDisplay.textContent = gameState.playerWord || gameState.hint;
        roleHint.innerHTML = '<i class="fas fa-user-secret"></i> Jesteś IMPOSTOREM! Nie znasz hasła, widzisz tylko podpowiedź. Udawaj, że wiesz o co chodzi! Możesz też zgadywać hasło!';
        roleHint.style.color = '#fb8f8f';
        
        // Pokaż sekcję zgadywania w zależności od trybu
        if (gameState.gameMode === 'sequential' && !gameState.isVoting && !gameState.isDeciding && !gameState.wordGuessed) {
            document.getElementById('guess-section').style.display = 'block';
        } else {
            document.getElementById('guess-section').style.display = 'none';
        }
    } else {
        wordDisplay.textContent = gameState.playerWord || gameState.word;
        roleHint.innerHTML = '<i class="fas fa-user-check"></i> Jesteś GRACZEM. Znajdź impostora po jego skojarzeniach!';
        roleHint.style.color = '#8f94fb';
        document.getElementById('guess-section').style.display = 'none';
    }
    
    // Obsługa sekcji tury dla trybu sequential
    if (gameState.gameMode === 'sequential') {
        const turnSection = document.getElementById('turn-section');
        const currentTurnPlayerId = gameState.currentTurnPlayerId;
        
        if (currentTurnPlayerId && !gameState.isVoting && !gameState.isDeciding && !gameState.wordGuessed) {
            turnSection.style.display = 'block';
            const currentPlayer = gameState.players.find(p => p.id === currentTurnPlayerId);
            document.getElementById('current-turn-player').innerHTML = `
                <div class="player-card ${currentPlayer.isImpostor ? 'impostor' : ''}" style="display: inline-block; padding: 10px 20px;">
                    <div class="player-name">${currentPlayer.name}</div>
                    <div class="player-role">${currentPlayer.isImpostor ? 'IMPOSTOR' : 'GRACZ'}</div>
                </div>
            `;
            
            // Jeśli to nasza tura, pokaż input
            if (currentTurnPlayerId === socket.id) {
                document.getElementById('association-section').style.display = 'block';
                document.getElementById('waiting-section').style.display = 'none';
                document.getElementById('association-instruction').textContent = 'Twoja kolej! Wpisz skojarzenie:';
                document.getElementById('association-input').disabled = false;
                document.getElementById('submit-association-btn').disabled = false;
                
                // Uruchom timer tury
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
    
    // Pokaż odpowiednią sekcję
    if (gameState.wordGuessed) {
        // Impostor odgadł hasło
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
    } else if (!gameState.isPlaying) {
        document.getElementById('association-section').style.display = 'none';
        document.getElementById('waiting-section').style.display = 'block';
        document.getElementById('voting-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('decision-section').style.display = 'none';
        document.getElementById('turn-section').style.display = 'none';
        document.getElementById('word-guessed-section').style.display = 'none';
    } else if (gameState.gameMode === 'simultaneous') {
        // Tryb simultaneous
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
    
    if (isHost) {
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
            
            if (isHost && !gameState.isVoting && !gameState.isDeciding) {
                socket.emit('startGame');
            }
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
            // Czas się skończył - automatycznie przejdź dalej (serwer powinien to obsłużyć)
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
    
    const nonHostPlayers = gameState.players.filter(p => !p.isHost);
    let submittedPlayers = 0;
    let totalPlayers = nonHostPlayers.length;
    
    if (gameState.gameMode === 'sequential') {
        submittedPlayers = nonHostPlayers.filter(p => p.turnCompleted).length;
    } else if (gameState.isDeciding) {
        submittedPlayers = nonHostPlayers.filter(p => p.hasDecided).length;
    } else {
        submittedPlayers = nonHostPlayers.filter(p => p.hasSubmitted).length;
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
    
    document.getElementById('decision-status').textContent = 'Oczekiwanie na twoją decyzję...';
    document.getElementById('vote-impostor-btn').disabled = false;
    document.getElementById('continue-game-btn').disabled = false;
    document.getElementById('keep-same-word').checked = false;
}

function displayAssociationsWithNames() {
    const container = document.getElementById('decision-associations-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!gameState || !gameState.associations) return;
    
    gameState.associations.forEach((assoc, index) => {
        const associationCard = document.createElement('div');
        associationCard.className = 'association-card';
        associationCard.style.border = assoc.isImpostor ? '2px solid #c84e4e' : '2px solid #4e54c8';
        associationCard.style.background = assoc.isImpostor ? 'rgba(200, 78, 78, 0.1)' : 'rgba(78, 84, 200, 0.1)';
        associationCard.style.minWidth = '200px';
        associationCard.style.padding = '15px';
        associationCard.style.borderRadius = '10px';
        
        // Dodaj informację jeśli gracz nie wysłał skojarzenia
        const hasAssociation = assoc.association && assoc.association.trim() !== '';
        const associationText = hasAssociation ? assoc.association : '(brak skojarzenia)';
        const textColor = hasAssociation ? '#ffffff' : '#888888';
        const textStyle = hasAssociation ? 'normal' : 'italic';
        
        associationCard.innerHTML = `
            <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.3); color: #fff; width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                ${index + 1}
            </div>
            <div style="font-weight: bold; color: ${assoc.isImpostor ? '#fb8f8f' : '#8f94fb'}; margin-bottom: 10px; text-align: center;">
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
        associationCard.style.border = assoc.isImpostor ? '2px solid #c84e4e' : '2px solid #4e54c8';
        associationCard.style.background = assoc.isImpostor ? 'rgba(200, 78, 78, 0.1)' : 'rgba(78, 84, 200, 0.1)';
        
        // Dodaj informację jeśli gracz nie wysłał skojarzenia
        const hasAssociation = assoc.association && assoc.association.trim() !== '';
        const associationText = hasAssociation ? assoc.association : '(brak skojarzenia)';
        const textColor = hasAssociation ? '#ffffff' : '#888888';
        const textStyle = hasAssociation ? 'normal' : 'italic';
        
        associationCard.innerHTML = `
            <div class="association-number">${index + 1}</div>
            <div class="player-name" style="color: ${assoc.isImpostor ? '#fb8f8f' : '#8f94fb'}; margin-bottom: 10px;">
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
    
    // Dodaj opcję głosowania na każdego gracza (oprócz siebie i hosta)
    gameState.players.forEach(player => {
        if (player.id !== socket.id && !player.isHost) {
            const voteBtn = document.createElement('button');
            voteBtn.className = 'vote-btn';
            voteBtn.textContent = player.name;
            voteBtn.dataset.playerId = player.id;
            
            voteBtn.addEventListener('click', () => {
                document.querySelectorAll('.vote-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                voteBtn.classList.add('selected');
                document.getElementById('submit-vote-btn').disabled = false;
            });
            
            voteOptions.appendChild(voteBtn);
        }
    });
    
    // Dodaj przycisk głosowania
    const submitVoteBtn = document.createElement('button');
    submitVoteBtn.id = 'submit-vote-btn';
    submitVoteBtn.className = 'btn btn-primary';
    submitVoteBtn.innerHTML = '<i class="fas fa-vote-yea"></i> Zagłosuj';
    submitVoteBtn.disabled = true;
    
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

function updateVoteProgress() {
    if (!gameState || !gameState.players) return;
    
    gameState.votes.forEach(([voterId, votedId]) => {
        const voteBtn = document.querySelector(`.vote-btn[data-player-id="${votedId}"]`);
        if (voteBtn) {
            voteBtn.classList.add('voted');
        }
    });
}

function showVoteResults(results) {
    document.getElementById('voting-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    
    const resultsContent = document.getElementById('results-content');
    
    let resultsHTML = '';
    
    if (results.votedOutIds.length > 0) {
        const votedOutPlayers = results.votedOutIds.map(id => {
            const player = gameState.players.find(p => p.id === id);
            return player ? player.name : 'Nieznany';
        }).join(', ');
        
        const isImpostorVotedOut = results.votedOutIds.some(id => 
            gameState.impostorIds.includes(id)
        );
        
        if (isImpostorVotedOut) {
            // Gracze wygrywają
            resultsHTML = `
                <div class="results-card win">
                    <h2 class="results-title"><i class="fas fa-trophy"></i> GRACZE WYGRYWAJĄ!</h2>
                    <p class="results-message">Wykryto impostora: ${votedOutPlayers}</p>
                    
                    <div class="impostor-reveal">
                        <h4>PRAWDZIWI IMPOSTORZY:</h4>
                        ${gameState.impostorIds.map(impostorId => {
                            const impostor = gameState.players.find(p => p.id === impostorId);
                            return impostor ? `<p style="font-size: 1.5rem; font-weight: bold; color: #fb8f8f;">
                                ${impostor.name} ${results.votedOutIds.includes(impostorId) ? '✅ (wykryty)' : '❌ (niewykryty)'}
                            </p>` : '';
                        }).join('')}
                        <p>Hasło w tej rundzie było: <strong>${gameState.word}</strong></p>
                    </div>
                </div>
            `;
        } else {
            // Impostorzy wygrywają
            resultsHTML = `
                <div class="results-card lose">
                    <h2 class="results-title"><i class="fas fa-user-secret"></i> IMPOSTORZY WYGRYWAJĄ!</h2>
                    <p class="results-message">Głosowano na niewinnych graczy: ${votedOutPlayers}</p>
                    
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
        }
    } else {
        // Remis
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
            ${gameState.gameMode === 'sequential' ? 'Gra kończy się natychmiast!' : 'Gra kontynuuje głosowanie...'}
        </p>
    `;
}

function startNextRound() {
    if (timerInterval) clearInterval(timerInterval);
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    
    updateGameInterface();
}

// Aktualizacja sidebaru
function updateSidebarInfo() {
    document.getElementById('sidebar-game-mode').textContent = gameState.gameMode === 'sequential' ? 'Kolejka' : 'Wszyscy';
    document.getElementById('sidebar-impostor-count').textContent = gameState.numImpostors;
    document.getElementById('sidebar-current-word').textContent = isImpostor ? gameState.hint : gameState.word;
}

// Wyniki końcowe
function showFinalResults() {
    const impostors = gameState.players.filter(p => p.isImpostor);
    const civilians = gameState.players.filter(p => !p.isImpostor && !p.isHost);
    
    let resultsHTML = `
        <div class="results-card">
            <h2 class="results-title">
                <i class="fas fa-flag-checkered"></i> KONIEC GRY!
            </h2>
            
            <div style="margin: 30px 0;">
                <h3 style="color: #8f94fb; margin-bottom: 20px;">Ostatnia runda:</h3>
                <div style="background: rgba(15, 21, 48, 0.5); border-radius: 10px; padding: 20px;">
                    <p><strong>Hasło:</strong> ${gameState.word}</p>
                    <p><strong>Podpowiedź dla impostorów:</strong> ${gameState.hint}</p>
                </div>
            </div>
            
            <div style="margin: 30px 0;">
                <h3 style="color: #8f94fb; margin-bottom: 20px;">Impostorzy:</h3>
                <div style="background: rgba(200, 78, 78, 0.1); border-radius: 10px; padding: 20px;">
                    ${impostors.map(impostor => `
                        <div style="display: flex; justify-content: space-between; align-items: center; 
                                    padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-weight: bold; color: #fb8f8f;">${impostor.name}</div>
                            <div style="color: #ffffff;">IMPOSTOR</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div style="margin: 30px 0;">
                <h3 style="color: #8f94fb; margin-bottom: 20px;">Gracze:</h3>
                <div style="background: rgba(78, 84, 200, 0.1); border-radius: 10px; padding: 20px;">
                    ${civilians.map(civilian => `
                        <div style="display: flex; justify-content: space-between; align-items: center; 
                                    padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-weight: bold; color: #8f94fb;">${civilian.name}</div>
                            <div style="color: #ffffff;">GRACZ</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <p style="margin-top: 30px; color: #b0b0d0; font-style: italic;">
                Dziękujemy za grę! Czy chcesz zagrać ponownie?
            </p>
        </div>
    `;
    
    document.getElementById('final-results-content').innerHTML = resultsHTML;
    switchScreen('finalResults');
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
            gameMode
        });
    });
    
    document.getElementById('back-to-start-from-create').addEventListener('click', () => {
        switchScreen('start');
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
    
    // Ekran oczekiwania (host)
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
        
        socket.emit('submitAssociation', { association });
        
        document.getElementById('association-input').style.display = 'none';
        document.getElementById('submit-association-btn').style.display = 'none';
        document.getElementById('submitted-message').style.display = 'flex';
        document.getElementById('association-input').value = '';
    });
    
    // Zgadywanie hasła (tryb sequential)
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
    
    // Nowe przyciski decyzji
    document.getElementById('vote-impostor-btn').addEventListener('click', () => {
        const keepSameWord = document.getElementById('keep-same-word').checked;
        socket.emit('submitDecision', { decision: true, keepSameWord: false });
        document.getElementById('decision-status').textContent = 'Wybrałeś: Głosuj na impostora';
        document.getElementById('vote-impostor-btn').disabled = true;
        document.getElementById('continue-game-btn').disabled = true;
    });
    
    document.getElementById('continue-game-btn').addEventListener('click', () => {
        const keepSameWord = document.getElementById('keep-same-word').checked;
        socket.emit('submitDecision', { decision: false, keepSameWord });
        document.getElementById('decision-status').textContent = 'Wybrałeś: Graj dalej' + (keepSameWord ? ' (zachowaj hasło)' : '');
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
    });
    
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
});
