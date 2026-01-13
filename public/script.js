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
let timerInterval = null;
let timeLeft = 45;
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
        document.getElementById('waiting-player-rounds').textContent = data.gameState.rounds;
        document.getElementById('waiting-player-time').textContent = data.gameState.roundTime;
        
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
            showNotification(`Wynik decyzji: ${continueCount} za kontynuacją, ${voteCount} za głosowaniem. Gramy dalej!`, 'success');
        }
        startNextRound();
    });
    
    socket.on('gameEnded', (data) => {
        gameState = data.gameState;
        showFinalResults();
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
            updateScoreboard();
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
            status = player.hasSubmitted ? 'ready' : 'waiting';
        } else if (gameState.isVoting) {
            status = gameState.votes.some(v => v[0] === player.id) ? 'ready' : 'waiting';
        } else if (gameState.isDeciding) {
            status = gameState.decisions.some(d => d[0] === player.id) ? 'ready' : 'waiting';
        }
        
        playerCard.innerHTML = `
            ${status ? `<div class="player-status ${status}"></div>` : ''}
            <div class="player-name">${player.name}</div>
            <div class="player-score">${player.score} pkt</div>
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
    
    const playerInfo = gameState.players.find(p => p.id === socket.id);
    if (playerInfo) {
        isImpostor = playerInfo.isImpostor;
        playerName = playerInfo.name;
    }
    
    switchScreen('game');
    updateGameInterface();
    updateGamePlayersList();
    updateScoreboard();
}

function updateGameInterface() {
    document.getElementById('current-round').textContent = gameState.currentRound;
    document.getElementById('total-rounds').textContent = gameState.rounds;
    
    timeLeft = roundTime;
    document.getElementById('timer').textContent = timeLeft;
    
    const wordDisplay = document.getElementById('word-display');
    const roleHint = document.getElementById('role-hint');
    
    if (isImpostor) {
        wordDisplay.textContent = gameState.playerWord || gameState.hint;
        roleHint.innerHTML = '<i class="fas fa-user-secret"></i> Jesteś IMPOSTOREM! Nie znasz hasła, widzisz tylko podpowiedź. Udawaj, że wiesz o co chodzi!';
        roleHint.style.color = '#fb8f8f';
    } else {
        wordDisplay.textContent = gameState.playerWord || gameState.word;
        roleHint.innerHTML = '<i class="fas fa-user-check"></i> Jesteś GRACZEM. Znajdź impostora po jego skojarzeniach!';
        roleHint.style.color = '#8f94fb';
    }
    
    // Pokaż odpowiednią sekcję
    if (gameState.isDeciding) {
        document.getElementById('association-section').style.display = 'none';
        document.getElementById('waiting-section').style.display = 'none';
        document.getElementById('voting-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('decision-section').style.display = 'block';
        
        displayAssociationsWithNames();
    } else if (gameState.isVoting) {
        document.getElementById('association-section').style.display = 'none';
        document.getElementById('waiting-section').style.display = 'none';
        document.getElementById('decision-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('voting-section').style.display = 'block';
        
        loadAssociationsForVoting();
    } else if (!gameState.isPlaying) {
        document.getElementById('association-section').style.display = 'none';
        document.getElementById('waiting-section').style.display = 'block';
        document.getElementById('voting-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('decision-section').style.display = 'none';
    } else {
        document.getElementById('association-section').style.display = 'block';
        document.getElementById('waiting-section').style.display = 'none';
        document.getElementById('voting-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('decision-section').style.display = 'none';
        
        document.getElementById('association-input').value = '';
        document.getElementById('submitted-message').style.display = 'none';
        
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

function updateProgress() {
    if (!gameState || !gameState.players) return;
    
    const nonHostPlayers = gameState.players.filter(p => !p.isHost);
    let submittedPlayers = 0;
    let totalPlayers = nonHostPlayers.length;
    
    if (gameState.isDeciding) {
        submittedPlayers = nonHostPlayers.filter(p => p.hasDecided).length;
    } else {
        submittedPlayers = nonHostPlayers.filter(p => p.hasSubmitted).length;
    }
    
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    
    if (progressText && progressFill) {
        if (gameState.isDeciding) {
            progressText.textContent = `${submittedPlayers}/${totalPlayers} podjęło decyzję`;
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
    document.getElementById('decision-section').style.display = 'block';
    
    displayAssociationsWithNames();
    
    document.getElementById('decision-status').textContent = 'Oczekiwanie na twoją decyzję...';
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
        associationCard.style.border = assoc.isImpostor ? '2px solid #c84e4e' : '2px solid #4e54c8';
        associationCard.style.background = assoc.isImpostor ? 'rgba(200, 78, 78, 0.1)' : 'rgba(78, 84, 200, 0.1)';
        associationCard.style.minWidth = '200px';
        associationCard.style.padding = '15px';
        associationCard.style.borderRadius = '10px';
        
        associationCard.innerHTML = `
            <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.3); color: #fff; width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                ${index + 1}
            </div>
            <div style="font-weight: bold; color: ${assoc.isImpostor ? '#fb8f8f' : '#8f94fb'}; margin-bottom: 10px; text-align: center;">
                <i class="fas fa-user"></i> ${assoc.playerName}
            </div>
            <div style="font-size: 1.3rem; font-weight: bold; text-align: center; color: #ffffff;">${assoc.association}</div>
        `;
        
        container.appendChild(associationCard);
    });
}

// Głosowanie
function loadAssociationsForVoting() {
    const associationsList = document.getElementById('associations-list');
    const voteOptions = document.getElementById('vote-options');
    
    if (!associationsList || !voteOptions) return;
    
    associationsList.innerHTML = '';
    voteOptions.innerHTML = '';
    
    if (!gameState || !gameState.associations) return;
    
    gameState.associations.forEach((assoc, index) => {
        const associationCard = document.createElement('div');
        associationCard.className = 'association-card';
        associationCard.style.border = assoc.isImpostor ? '2px solid #c84e4e' : '2px solid #4e54c8';
        associationCard.style.background = assoc.isImpostor ? 'rgba(200, 78, 78, 0.1)' : 'rgba(78, 84, 200, 0.1)';
        
        associationCard.innerHTML = `
            <div class="association-number">${index + 1}</div>
            <div class="player-name" style="color: ${assoc.isImpostor ? '#fb8f8f' : '#8f94fb'}; margin-bottom: 10px;">
                <i class="fas fa-user"></i> ${assoc.playerName}
            </div>
            <div class="association-text">${assoc.association}</div>
        `;
        
        associationsList.appendChild(associationCard);
        
        if (assoc.playerId !== socket.id) {
            const voteBtn = document.createElement('button');
            voteBtn.className = 'vote-btn';
            voteBtn.textContent = assoc.playerName;
            voteBtn.dataset.playerId = assoc.playerId;
            
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
    const votedOutPlayer = gameState.players.find(p => p.id === results.votedOutId);
    
    let resultsHTML = '';
    
    if (results.impostorDetected) {
        resultsHTML = `
            <div class="results-card win">
                <h2 class="results-title"><i class="fas fa-trophy"></i> GRACZE WYGRYWAJĄ!</h2>
                <p class="results-message">Impostor został wykryty!</p>
                
                <div class="impostor-reveal">
                    <h4>IMPOSTOR:</h4>
                    <p style="font-size: 1.8rem; font-weight: bold; color: #fb8f8f;">
                        ${votedOutPlayer ? votedOutPlayer.name : 'Nieznany'}
                    </p>
                    <p>Hasło w tej rundzie było: <strong>${gameState.word}</strong></p>
                    <p>Impostor widział podpowiedź: <strong>${gameState.hint}</strong></p>
                </div>
                
                <h3 style="margin-top: 30px; color: #8f94fb;">Wyniki głosowania:</h3>
                <div style="margin-top: 20px;">
                    ${gameState.players.map(player => {
                        const voteCount = results.voteCounts.find(v => v[0] === player.id);
                        return `
                            <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <span>${player.name}</span>
                                <span style="color: ${player.id === results.votedOutId ? '#fb8f8f' : '#8f94fb'}">
                                    ${voteCount ? voteCount[1] : 0} głosów
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } else {
        const actualImpostor = gameState.players.find(p => p.isImpostor);
        
        resultsHTML = `
            <div class="results-card lose">
                <h2 class="results-title"><i class="fas fa-user-secret"></i> IMPOSTOR WYGRYWA!</h2>
                <p class="results-message">Impostor nie został wykryty!</p>
                
                <div class="impostor-reveal">
                    <h4>IMPOSTOR BYŁ:</h4>
                    <p style="font-size: 1.8rem; font-weight: bold; color: #fb8f8f;">
                        ${actualImpostor ? actualImpostor.name : 'Nieznany'}
                    </p>
                    <p>Hasło w tej rundzie było: <strong>${gameState.word}</strong></p>
                    <p>Impostor widział podpowiedź: <strong>${gameState.hint}</strong></p>
                </div>
                
                <div style="margin-top: 20px; color: #fb8f8f; font-style: italic;">
                    <p>Głosowaliście na: <strong>${votedOutPlayer ? votedOutPlayer.name : 'nikogo'}</strong></p>
                </div>
                
                <h3 style="margin-top: 30px; color: #8f94fb;">Wyniki głosowania:</h3>
                <div style="margin-top: 20px;">
                    ${gameState.players.map(player => {
                        const voteCount = results.voteCounts.find(v => v[0] === player.id);
                        return `
                            <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <span>${player.name}</span>
                                <span style="color: ${player.id === results.votedOutId ? '#fb8f8f' : '#8f94fb'}">
                                    ${voteCount ? voteCount[1] : 0} głosów
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    resultsContent.innerHTML = resultsHTML;
    
    updateScoreboard();
}

function startVoting() {
    document.getElementById('association-section').style.display = 'none';
    document.getElementById('waiting-section').style.display = 'none';
    document.getElementById('decision-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('voting-section').style.display = 'block';
    
    loadAssociationsForVoting();
    
    document.getElementById('voted-message').style.display = 'none';
}

function startNextRound() {
    if (timerInterval) clearInterval(timerInterval);
    
    updateGameInterface();
}

// Tabela wyników
function updateScoreboard() {
    const scoreboard = document.getElementById('scoreboard');
    if (!scoreboard) return;
    
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    
    let scoreboardHTML = '';
    
    sortedPlayers.forEach((player, index) => {
        scoreboardHTML += `
            <div class="score-row">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.2rem; color: #8f94fb;">${index + 1}.</span>
                    <span class="score-name">${player.name}</span>
                    ${player.isImpostor ? '<span style="color: #fb8f8f; font-size: 0.8rem;">(IMPOSTOR)</span>' : ''}
                </div>
                <span class="score-points">${player.score} pkt</span>
            </div>
        `;
    });
    
    scoreboard.innerHTML = scoreboardHTML;
}

// Wyniki końcowe
function showFinalResults() {
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    
    let resultsHTML = `
        <div class="results-card ${winner.isImpostor ? 'lose' : 'win'}">
            <h2 class="results-title">
                <i class="fas fa-flag-checkered"></i> KONIEC GRY!
            </h2>
            <p class="results-message" style="font-size: 1.5rem;">
                Zwycięzca: <strong style="color: ${winner.isImpostor ? '#fb8f8f' : '#8ffb8f'}">${winner.name}</strong>
            </p>
            
            <div style="margin: 30px 0;">
                <h3 style="color: #8f94fb; margin-bottom: 20px;">Klasyfikacja końcowa:</h3>
                <div style="background: rgba(15, 21, 48, 0.5); border-radius: 10px; padding: 20px;">
                    ${sortedPlayers.map((player, index) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; 
                                    padding: 15px; border-bottom: ${index < sortedPlayers.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'};
                                    background: ${index === 0 ? 'rgba(78, 84, 200, 0.2)' : 'transparent'}; border-radius: ${index === 0 ? '8px' : '0'};">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div style="width: 30px; height: 30px; background: ${index === 0 ? '#4e54c8' : '#2d3561'}; 
                                            color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                    ${index + 1}
                                </div>
                                <div>
                                    <div style="font-weight: bold; font-size: 1.2rem;">${player.name}</div>
                                    <div style="font-size: 0.9rem; color: ${player.isImpostor ? '#fb8f8f' : '#8f94fb'}">
                                        ${player.isImpostor ? 'IMPOSTOR' : 'GRACZ'}
                                    </div>
                                </div>
                            </div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #8f94fb;">
                                ${player.score} pkt
                            </div>
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
        
        if (!playerName) {
            showNotification('Wpisz swój pseudonim!', 'error');
            return;
        }
        
        socket.emit('createGame', {
            playerName,
            rounds,
            roundTime
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
    
    // Ekran gry
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
    });
    
    // Nowe przyciski decyzji
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
    });
    
    // Enter w polu skojarzenia
    document.getElementById('association-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('submit-association-btn').click();
        }
    });
});
