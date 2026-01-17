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
let decisionTime = 30;
let numImpostors = 1;
let gameMode = 'simultaneous';
let timerInterval = null;
let turnTimerInterval = null;
let votingTimerInterval = null;
let decisionTimerInterval = null;
let timeLeft = 45;
let turnTimeLeft = 30;
let votingTimeLeft = 30;
let decisionTimeLeft = 30;
let gameState = null;
let customWordData = null;
let selectedWordForGame = null;
let autoSubmitEnabled = true;

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

function updateTimerDisplay(time) {
    const timerElement = document.getElementById('timer');
    if (!timerElement) return;

    timerElement.textContent = time;

    // Aktualizuj klasy CSS w zależności od pozostałego czasu
    timerElement.classList.remove('warning', 'danger');

    if (time <= 10) {
        timerElement.classList.add('danger');
    } else if (time <= 20) {
        timerElement.classList.add('warning');
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
        console.log('Otrzymano gameCreated:', data);
        try {
            gameCode = data.code;
            gameState = data.gameState;

            const codeText = document.getElementById('code-text');
            const waitingGameMode = document.getElementById('waiting-game-mode');
            const waitingImpostors = document.getElementById('waiting-impostors');
            const waitingRounds = document.getElementById('waiting-rounds');
            const waitingTime = document.getElementById('waiting-time');

            if (codeText) codeText.textContent = gameCode;
            if (waitingGameMode) waitingGameMode.textContent = data.gameState.gameMode === 'sequential' ? 'Kolejka' : 'Wszyscy jednocześnie';
            if (waitingImpostors) waitingImpostors.textContent = data.gameState.numImpostors;
            if (waitingRounds) waitingRounds.textContent = data.gameState.rounds;
            if (waitingTime) waitingTime.textContent = data.gameState.roundTime;

            isHost = true;
            switchScreen('waitingHost');
            updatePlayersList();
        } catch (error) {
            console.error('Błąd przy przetwarzaniu gameCreated:', error);
            showNotification('Błąd przy tworzeniu gry. Sprawdź konsolę.', 'error');
        }
    });

    socket.on('error', (data) => {
        showNotification(data.message, 'error');

        // Jeśli błąd dotyczy restartu gry i host nie istnieje, wróć do menu
        if (data.message && (data.message.includes('host') || data.message.includes('Host') || data.message.includes('Tylko host'))) {
            setTimeout(() => {
                socket.disconnect();
                initSocket();
                switchScreen('start');
            }, 2000);
        }
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
        showCountdown(() => {
            startGame();
        });
    });

    socket.on('associationSubmitted', (data) => {
        gameState = data.gameState;

        // ✅ NAPRAWIONE: Usunięto duplikację - wiadomości są już dodawane przez newChatMessage z serwera

        if (isHost) {
            updateGamePlayersList();
        }

        updateProgress();
    });

    socket.on('guessSubmitted', (data) => {
        gameState = data.gameState;

        // Dodaj wiadomość do czatu
        const player = gameState.players.find(p => p.id === data.playerId);
        if (player) {
            addChatMessage({
                type: 'guess',
                playerName: player.name,
                message: `Zgadł: "${data.guess}"`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                round: gameState.currentRound
            });
        }
    });

    socket.on('nextTurn', (data) => {
        gameState = data.gameState;
        showNextTurn(data.nextPlayerId);
    });

    socket.on('turnTimerUpdate', (data) => {
        gameState = data.gameState;
        const timeLeft = data.timeLeft;

        // Aktualizuj timer dla wszystkich graczy
        const turnTimerElement = document.getElementById('turn-timer');
        if (turnTimerElement) {
            turnTimerElement.textContent = timeLeft;
            // Pokaż sekcję timera jeśli jest ukryta
            const turnSection = document.getElementById('turn-section');
            if (turnSection && gameState.gameMode === 'sequential' && gameState.isPlaying) {
                turnSection.style.display = 'block';
            }
        }

        // Zatrzymaj lokalny timer i użyj czasu z serwera
        if (turnTimerInterval) {
            clearInterval(turnTimerInterval);
            turnTimerInterval = null;
        }

        turnTimeLeft = timeLeft;
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

        // ✅ NAPRAWIONE: Zatrzymaj wszystkie timery
        if (timerInterval) clearInterval(timerInterval);
        if (turnTimerInterval) clearInterval(turnTimerInterval);
        if (votingTimerInterval) clearInterval(votingTimerInterval);
        if (decisionTimerInterval) clearInterval(decisionTimerInterval);

        // Dodaj wiadomość do czatu
        addChatMessage({
            type: 'system',
            playerName: 'SYSTEM',
            message: `🎉 ${data.guesserName} odgadł hasło "${data.word}"! Impostorzy wygrywają rundę!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            round: gameState.currentRound
        });
    });

    socket.on('guessFailed', (data) => {
        gameState = data.gameState;
        showGuessFailed(data);

        // Dodaj wiadomość do czatu
        addChatMessage({
            type: 'system',
            playerName: 'SYSTEM',
            message: `❌ ${data.guesserName} nie odgadł hasła. Gracze wygrywają!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            round: gameState.currentRound
        });
    });

    socket.on('voteResults', (data) => {
        gameState = data.gameState;
        showVoteResults(data.results, data.outcome);
    });

    socket.on('gameEnded', (data) => {
        gameState = data.gameState;

        if (timerInterval) clearInterval(timerInterval);
        if (turnTimerInterval) clearInterval(turnTimerInterval);
        if (votingTimerInterval) clearInterval(votingTimerInterval);
        if (decisionTimerInterval) clearInterval(decisionTimerInterval);

        setTimeout(() => {
            if (data.reason === 'wordGuessed' || data.reason === 'guessFailed' || data.reason === 'allImpostorsFound') {
                showFinalResults(data.reason);
            } else if (data.reason === 'notEnoughPlayers') {
                showNotification('Gra zakończona - zbyt mało graczy (minimum 3)', 'error');
                setTimeout(() => {
                    if (isHost) {
                        switchScreen('waitingHost');
                        updatePlayersList();
                    } else {
                        switchScreen('waitingPlayer');
                        updateWaitingPlayersList();
                    }
                }, 2000);
            } else {
                showFinalResults('normal');
            }

            // ✅ NAPRAWIONE: Nie pokazujemy fullscreen-back-button, tylko zostawiamy ekran z wynikami i przyciskami
        }, 1000);
    });

    socket.on('gameRestarted', (data) => {
        gameState = data.gameState;

        // Zatrzymaj wszystkie timery
        if (timerInterval) clearInterval(timerInterval);
        if (turnTimerInterval) clearInterval(turnTimerInterval);
        if (votingTimerInterval) clearInterval(votingTimerInterval);
        if (decisionTimerInterval) clearInterval(decisionTimerInterval);

        timerInterval = null;
        turnTimerInterval = null;
        votingTimerInterval = null;
        decisionTimerInterval = null;

        // ✅ NAPRAWIONE: Zresetuj rolę gracza (zostanie zaktualizowana przy starcie nowej gry)
        isImpostor = false;

        // Zresetuj zmienne
        currentRound = 0;
        timeLeft = roundTime;
        turnTimeLeft = 30;
        votingTimeLeft = decisionTime;
        decisionTimeLeft = decisionTime;

        // Pokaż powiadomienie
        showNotification('Gra została zrestartowana. Wracasz do lobby.', 'info');

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

        // Dodaj wiadomość do czatu
        addChatMessage({
            type: 'system',
            playerName: 'SYSTEM',
            message: `👋 Gracz opuścił grę`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            round: gameState.currentRound
        });

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

    socket.on('systemMessage', (data) => {
        addChatMessage({
            type: 'system',
            playerName: 'SYSTEM',
            message: data.message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            round: gameState ? gameState.currentRound : 1
        });
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
        // NIE pokazuj impostora na czerwono innym graczom (tylko jeśli gra się zakończyła)
        const showImpostor = player.isImpostor &&
            (gameState.wordGuessed || gameState.guessFailed || gameState.gameEnded || gameState.isVoting || player.id === socket.id);

        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${showImpostor ? 'impostor' : ''} ${player.isHost ? 'host' : ''}`;

        let status = '';
        if (gameState.isPlaying && !gameState.isVoting && !gameState.isDeciding && !gameState.wordGuessed && !gameState.guessFailed) {
            if (gameState.gameMode === 'sequential') {
                // W trybie sequential pokazuj status tylko dla obecnego gracza
                if (gameState.currentTurnPlayerId === player.id) {
                    status = player.hasSubmitted ? 'ready' : 'waiting';
                }
            } else {
                status = player.hasSubmitted ? 'ready' : 'waiting';
            }
        } else if (gameState.isVoting) {
            status = player.voteSubmitted ? 'ready' : 'waiting';
        } else if (gameState.isDeciding) {
            status = player.hasDecided ? 'ready' : 'waiting';
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
function showCountdown(callback) {
    // Pokaż ekran gry ale z odliczaniem
    switchScreen('game');

    // Ukryj wszystkie sekcje gry
    document.getElementById('association-section').style.display = 'none';
    document.getElementById('waiting-section').style.display = 'none';
    document.getElementById('voting-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('decision-section').style.display = 'none';
    document.getElementById('turn-section').style.display = 'none';
    document.getElementById('word-guessed-section').style.display = 'none';
    document.getElementById('host-controls').style.display = 'none';

    // Stwórz overlay z odliczaniem
    let countdownOverlay = document.getElementById('countdown-overlay');
    if (!countdownOverlay) {
        countdownOverlay = document.createElement('div');
        countdownOverlay.id = 'countdown-overlay';
        countdownOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            flex-direction: column;
        `;
        document.body.appendChild(countdownOverlay);
    }

    const countdownText = document.createElement('div');
    countdownText.style.cssText = `
        font-size: 8rem;
        font-weight: bold;
        color: #00ffcc;
        text-shadow: 0 0 30px rgba(0, 255, 204, 0.8);
        animation: pulse 0.5s ease-in-out;
    `;
    countdownOverlay.innerHTML = '';
    countdownOverlay.appendChild(countdownText);
    countdownOverlay.style.display = 'flex';

    let count = 3;
    countdownText.textContent = count;

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.textContent = count;
            countdownText.style.animation = 'none';
            setTimeout(() => {
                countdownText.style.animation = 'pulse 0.5s ease-in-out';
            }, 10);
        } else if (count === 0) {
            countdownText.textContent = 'ZACZYNAMY!';
            countdownText.style.fontSize = '5rem';
            countdownText.style.color = '#00ff99';
            setTimeout(() => {
                countdownOverlay.style.display = 'none';
                clearInterval(countdownInterval);
                callback();
            }, 1000);
        }
    }, 1000);
}

function startGame() {
    // ✅ NAPRAWIONE: Usunięto bezsensowne przypisanie gameState = gameState;
    currentRound = gameState.currentRound;
    totalRounds = gameState.rounds;
    roundTime = gameState.roundTime;
    decisionTime = gameState.decisionTime || 30;
    numImpostors = gameState.numImpostors;
    gameMode = gameState.gameMode;

    const playerInfo = gameState.players.find(p => p.id === socket.id);
    if (playerInfo) {
        isImpostor = playerInfo.isImpostor;
        playerName = playerInfo.name;
    }

    updateGameInterface();
    updateGamePlayersList();
    updateSidebarInfo();
    loadChatMessages();

    // Dodaj wiadomość powitalną do czatu
    addChatMessage({
        type: 'system',
        playerName: 'SYSTEM',
        message: `🎮 Rozpoczęto grę! Runda ${currentRound}. Impostorów: ${numImpostors}. Tryb: ${gameMode === 'sequential' ? 'Kolejka' : 'Wszyscy'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        round: currentRound
    });
}

function updateGameInterface() {
    document.getElementById('current-round').textContent = gameState.currentRound;
    document.getElementById('total-rounds').textContent = gameState.rounds;
    document.getElementById('impostor-count').textContent = gameState.numImpostors;
    document.getElementById('game-mode-badge').textContent = gameState.gameMode === 'sequential' ? 'Kolejka' : 'Wszyscy';

    // Resetujemy wszystkie sekcje przed pokazaniem właściwej
    document.getElementById('association-section').style.display = 'none';
    document.getElementById('waiting-section').style.display = 'none';
    document.getElementById('voting-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('decision-section').style.display = 'none';
    document.getElementById('turn-section').style.display = 'none';
    document.getElementById('word-guessed-section').style.display = 'none';
    document.getElementById('host-controls').style.display = 'none';

    const wordDisplay = document.getElementById('word-display');
    const roleHint = document.getElementById('role-hint');

    // impostor widzi podpowiedź, nie hasło
    if (isImpostor && gameState.isPlaying && !gameState.wordGuessed && !gameState.guessFailed) {
        wordDisplay.textContent = gameState.hint; // TYLKO podpowiedź dla impostora
        roleHint.innerHTML = '<i class="fas fa-user-secret"></i> Jesteś IMPOSTOREM! Nie znasz hasła, widzisz tylko podpowiedź. Spróbuj zgadnąć hasło!';
        roleHint.style.color = '#ff3366';

        // Pokaż listę współimpostorów, jeśli istnieją
        if (gameState.coImpostors && gameState.coImpostors.length > 0) {
            roleHint.innerHTML += `<br><small>Współimpostorzy: ${gameState.coImpostors.join(', ')}</small>`;
        }

        // Impostor może wysyłać skojarzenia w każdej rundzie!
        document.getElementById('guess-section').style.display = 'block';

    } else {
        // Gracz (nie impostor) widzi hasło
        wordDisplay.textContent = gameState.word; // Gracz widzi hasło
        if (isHost) {
            roleHint.innerHTML = '<i class="fas fa-crown"></i> Jesteś HOSTEM. Znajdź impostora po jego skojarzeniach!';
        } else {
            roleHint.innerHTML = '<i class="fas fa-user-check"></i> Jesteś GRACZEM. Znajdź impostora po jego skojarzeniach!';
        }
        roleHint.style.color = '#00ffcc';
        document.getElementById('guess-section').style.display = 'none';
    }

    // Aktualizuj wskaźnik rundy w chacie
    document.getElementById('chat-round-indicator').textContent = `Runda: ${gameState.currentRound}`;

    // Teraz pokazujemy właściwą sekcję w zależności od stanu gry
    if (gameState.wordGuessed || gameState.guessFailed) {
        document.getElementById('word-guessed-section').style.display = 'block';
    } else if (gameState.isDeciding) {
        showDecisionPhase();
    } else if (gameState.isVoting) {
        startVoting();
    } else if (!gameState.isPlaying || gameState.gameEnded) {
        // Gra zakończona
    } else if (gameState.gameMode === 'sequential') {
        // Tryb kolejkowy
        const currentTurnPlayerId = gameState.currentTurnPlayerId;

        if (currentTurnPlayerId) {
            const turnSection = document.getElementById('turn-section');
            turnSection.style.display = 'block';

            const currentPlayer = gameState.players.find(p => p.id === currentTurnPlayerId);
            // ✅ NAPRAWIONE: Dodano sprawdzenie czy gracz istnieje
            if (currentPlayer) {
                document.getElementById('current-turn-player').innerHTML = `
                    <div class="player-card" style="display: inline-block; padding: 15px 30px;">
                        <div class="player-name">${currentPlayer.name}</div>
                    </div>
                `;
            } else {
                document.getElementById('current-turn-player').innerHTML = `
                    <div class="player-card" style="display: inline-block; padding: 15px 30px;">
                        <div class="player-name">Nieznany gracz</div>
                    </div>
                `;
            }

            // ✅ NAPRAWIONE: Timer widoczny dla wszystkich graczy w trybie sequential
            // Uruchom timer tury dla wszystkich (nie tylko dla gracza który pisze)
            startTurnTimer();

            // Sprawdzamy czy to moja kolej i czy już wysłałem skojarzenie
            const player = gameState.players.find(p => p.id === socket.id);

            if (currentTurnPlayerId === socket.id) {
                // To moja kolej
                if (player && player.hasSubmitted) {
                    // Już wysłałem skojarzenie - pokazuję tylko komunikat
                    document.getElementById('waiting-section').style.display = 'block';
                    document.getElementById('waiting-message-text').textContent = 'Czekam na innych graczy...';
                    document.getElementById('association-section').style.display = 'none';
                } else {
                    // Nie wysłałem jeszcze skojarzenia
                    document.getElementById('association-section').style.display = 'block';
                    document.getElementById('waiting-section').style.display = 'none';
                    document.getElementById('association-instruction').textContent = 'Twoja kolej! Wpisz skojarzenie:';
                    document.getElementById('association-input').disabled = false;
                    document.getElementById('submit-association-btn').disabled = false;
                    document.getElementById('association-input').value = '';
                    document.getElementById('submitted-message').style.display = 'none';

                    // Resetujemy pole input
                    document.getElementById('association-input').style.display = 'block';
                    document.getElementById('submit-association-btn').style.display = 'flex';
                }
            } else {
                // Nie moja kolej
                document.getElementById('association-section').style.display = 'none';
                document.getElementById('waiting-section').style.display = 'block';
                // ✅ NAPRAWIONE: Dodano sprawdzenie przed użyciem currentPlayer.name
                const waitingPlayerName = currentPlayer ? currentPlayer.name : 'gracza';
                document.getElementById('waiting-message-text').textContent = `Oczekiwanie na ${waitingPlayerName}...`;
            }
        }
    } else {
        // Tryb simultaneous (wszyscy jednocześnie)
        document.getElementById('association-section').style.display = 'block';

        document.getElementById('association-input').value = '';
        document.getElementById('submitted-message').style.display = 'none';
        document.getElementById('guessed-message').style.display = 'none';

        const player = gameState.players.find(p => p.id === socket.id);
        if (player && player.hasSubmitted) {
            // Gracz już wysłał skojarzenie
            document.getElementById('association-input').style.display = 'none';
            document.getElementById('submit-association-btn').style.display = 'none';

            // Pokaż listę oczekujących graczy
            const waitingPlayers = gameState.players.filter(p => !p.hasSubmitted);
            const waitingNames = waitingPlayers.length > 0
                ? waitingPlayers.map(p => p.name).join(', ')
                : 'wszyscy gotowi!';

            const submittedMsg = document.getElementById('submitted-message');
            submittedMsg.style.display = 'flex';
            submittedMsg.innerHTML = `
                <div><i class="fas fa-check-circle"></i> Twoje skojarzenie zostało wysłane!</div>
                <div style="margin-top: 10px; font-size: 0.9rem; color: #aaa;">
                    Oczekiwanie na: <span style="color: #fff;">${waitingNames}</span>
                </div>
            `;
        } else {
            // Gracz jeszcze nie wysłał skojarzenia
            document.getElementById('association-input').style.display = 'block';
            document.getElementById('submit-association-btn').style.display = 'flex';
        }

        startTimer();
    }

    // Zawsze pokazujemy sekcję guess dla impostora w trybie simultaneous
    if (isImpostor && gameState.isPlaying && !gameState.wordGuessed && !gameState.guessFailed && gameState.gameMode === 'simultaneous') {
        document.getElementById('guess-section').style.display = 'block';
    }

    if (isHost && gameState.isPlaying && !gameState.wordGuessed && !gameState.guessFailed && !gameState.isVoting && !gameState.isDeciding) {
        document.getElementById('host-controls').style.display = 'flex';
    }

    updateProgress();
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timeLeft = roundTime;
    updateTimerDisplay(timeLeft);

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);

        if (timeLeft <= 0 && autoSubmitEnabled) {
            clearInterval(timerInterval);
            // Automatycznie przejdź do następnego etapu
            if (gameState.isPlaying && !gameState.wordGuessed && !gameState.guessFailed) {
                const player = gameState.players.find(p => p.id === socket.id);
                if (player && !player.hasSubmitted) {
                    socket.emit('submitAssociation', { association: '' });
                    showNotification('Czas minął! Automatycznie wysłano puste skojarzenie.', 'warning');
                }
            }
        }
    }, 1000);
}

function startTurnTimer() {
    // ✅ NAPRAWIONE: Timer jest teraz synchronizowany przez serwer
    // Nie uruchamiamy lokalnego timera, tylko czekamy na aktualizacje z serwera
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    turnTimerInterval = null;

    // Timer będzie aktualizowany przez turnTimerUpdate z serwera
}

function startVotingTimer() {
    if (votingTimerInterval) clearInterval(votingTimerInterval);

    votingTimeLeft = decisionTime;
    updateTimerDisplay(votingTimeLeft);

    votingTimerInterval = setInterval(() => {
        votingTimeLeft--;
        updateTimerDisplay(votingTimeLeft);

        if (votingTimeLeft <= 0) {
            clearInterval(votingTimerInterval);
            showNotification('Czas na głosowanie minął!', 'warning');
        }
    }, 1000);
}

function startDecisionTimer() {
    if (decisionTimerInterval) clearInterval(decisionTimerInterval);

    decisionTimeLeft = decisionTime;
    updateTimerDisplay(decisionTimeLeft);

    decisionTimerInterval = setInterval(() => {
        decisionTimeLeft--;
        updateTimerDisplay(decisionTimeLeft);

        if (decisionTimeLeft <= 0) {
            clearInterval(decisionTimerInterval);
            showNotification('Czas na decyzję minął!', 'warning');
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
    } else if (gameState.isVoting) {
        submittedPlayers = gameState.players.filter(p => p.voteSubmitted).length;
    } else if (gameState.gameMode === 'sequential') {
        submittedPlayers = gameState.players.filter(p => p.hasSubmitted).length;
    } else {
        submittedPlayers = gameState.players.filter(p => p.hasSubmitted).length;
    }

    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');

    if (progressText && progressFill) {
        if (gameState.isDeciding) {
            progressText.textContent = `${submittedPlayers}/${totalPlayers} podjęło decyzję`;
        } else if (gameState.isVoting) {
            progressText.textContent = `${submittedPlayers}/${totalPlayers} oddało głos`;
        } else if (gameState.gameMode === 'sequential') {
            progressText.textContent = `${submittedPlayers}/${totalPlayers} wysłało skojarzenie`;
        } else {
            progressText.textContent = `${submittedPlayers}/${totalPlayers} graczy gotowych`;
        }
        const progressPercent = totalPlayers > 0 ? (submittedPlayers / totalPlayers) * 100 : 0;
        progressFill.style.width = `${progressPercent}%`;
    }
}

// Faza decyzji
function showDecisionPhase() {
    document.getElementById('decision-section').style.display = 'block';

    displayAssociationsWithNames();

    document.getElementById('decision-status').textContent = 'Oczekiwanie na twoją decyzję...';
    document.getElementById('vote-impostor-btn').disabled = false;
    document.getElementById('continue-game-btn').disabled = false;

    // ✅ NAPRAWIONE: Uruchom timer dla fazy decyzji
    startDecisionTimer();
}

function displayAssociationsWithNames() {
    const container = document.getElementById('decision-associations-list');
    if (!container) return;

    container.innerHTML = '';

    if (!gameState || !gameState.associations) return;

    gameState.associations.forEach((assoc, index) => {
        const associationCard = document.createElement('div');
        associationCard.className = 'association-card';
        associationCard.style.border = '3px solid #00ccff';
        associationCard.style.background = 'linear-gradient(145deg, rgba(0, 204, 255, 0.1) 0%, rgba(45, 27, 105, 0.8) 100%)';
        associationCard.style.minWidth = '220px';
        associationCard.style.padding = '20px';
        associationCard.style.borderRadius = '15px';

        const hasAssociation = assoc.association && assoc.association.trim() !== '';
        const associationText = hasAssociation ? assoc.association : '(brak skojarzenia)';
        const textColor = hasAssociation ? '#ffffff' : '#888888';
        const textStyle = hasAssociation ? 'normal' : 'italic';

        associationCard.innerHTML = `
            <div style="position: absolute; top: 10px; left: 10px; background: linear-gradient(90deg, #00ccff, #8a2be2); color: #fff; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem; box-shadow: 0 5px 15px rgba(0, 204, 255, 0.4);">
                ${index + 1}
            </div>
            <div style="font-weight: bold; color: #00ffcc; margin-bottom: 15px; text-align: center; font-size: 1.1rem;">
                <i class="fas fa-user"></i> ${assoc.playerName}
            </div>
            <div style="font-size: 1.5rem; font-weight: bold; text-align: center; color: ${textColor}; font-style: ${textStyle}; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 10px;">${associationText}</div>
        `;

        container.appendChild(associationCard);
    });
}

// Głosowanie
function startVoting() {
    document.getElementById('voting-section').style.display = 'block';

    loadAssociationsForVoting();
    loadVoteOptions();

    document.getElementById('voted-message').style.display = 'none';

    // Uruchom timer głosowania
    startVotingTimer();
}

function loadAssociationsForVoting() {
    const associationsList = document.getElementById('associations-list');
    if (!associationsList) return;

    associationsList.innerHTML = '';

    if (!gameState || !gameState.associations) return;

    gameState.associations.forEach((assoc, index) => {
        const associationCard = document.createElement('div');
        associationCard.className = 'association-card';
        associationCard.style.border = '3px solid #00ccff';
        associationCard.style.background = 'linear-gradient(145deg, rgba(0, 204, 255, 0.1) 0%, rgba(45, 27, 105, 0.8) 100%)';

        const hasAssociation = assoc.association && assoc.association.trim() !== '';
        const associationText = hasAssociation ? assoc.association : '(brak skojarzenia)';
        const textColor = hasAssociation ? '#ffffff' : '#888888';
        const textStyle = hasAssociation ? 'normal' : 'italic';

        associationCard.innerHTML = `
            <div class="association-number">${index + 1}</div>
            <div class="player-name" style="color: #00ffcc; margin-bottom: 15px; font-size: 1.2rem;">
                <i class="fas fa-user"></i> ${assoc.playerName}
            </div>
            <div class="association-text" style="color: ${textColor}; font-style: ${textStyle}; font-size: 1.3rem;">${associationText}</div>
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
                submitVoteBtn.style.marginTop = '25px';
                submitVoteBtn.style.width = '100%';
                submitVoteBtn.style.padding = '18px';
                submitVoteBtn.style.fontSize = '1.3rem';

                submitVoteBtn.addEventListener('click', () => {
                    const selectedVoteBtn = document.querySelector('.vote-btn.selected');
                    if (!selectedVoteBtn) {
                        showNotification('Wybierz gracza, na którego chcesz zagłosować!', 'error');
                        return;
                    }

                    const votedPlayerId = selectedVoteBtn.dataset.playerId;
                    socket.emit('submitVote', { votedPlayerId });

                    submitVoteBtn.disabled = true;
                    submitVoteBtn.textContent = 'Głos oddany ✓';
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
    document.getElementById('results-section').style.display = 'block';

    const resultsContent = document.getElementById('results-content');

    let resultsHTML = '';

    if (outcome.type === 'impostorVotedOut') {
        const votedOutPlayer = gameState.players.find(p => p.id === outcome.votedOutId);

        // ✅ NAPRAWIONE: Dodano sprawdzenie czy gracz istnieje
        if (!votedOutPlayer) {
            console.error('Gracz nie został znaleziony:', outcome.votedOutId);
            resultsHTML = `
                <div class="results-card win">
                    <h2 class="results-title"><i class="fas fa-trophy"></i> GRACZE WYGRYWAJĄ!</h2>
                    <p class="results-message">Impostor został wykryty!</p>
                </div>
            `;
        } else {
            resultsHTML = `
                <div class="results-card win">
                    <h2 class="results-title"><i class="fas fa-trophy"></i> GRACZE WYGRYWAJĄ!</h2>
                    <p class="results-message">Wykryto impostora: <strong style="color: #00ff99;">${votedOutPlayer.name}</strong></p>
                    
                    <div class="impostor-reveal">
                        <h4>PRAWDZIWI IMPOSTORZY:</h4>
                        ${gameState.impostorIds.map(impostorId => {
                const impostor = gameState.players.find(p => p.id === impostorId);
                return impostor ? `<p style="font-size: 1.8rem; font-weight: bold; color: #ff3366; margin: 10px 0;">
                                ${impostor.name} ${impostorId === outcome.votedOutId ? '✅ (wykryty)' : ''}
                            </p>` : '';
            }).join('')}
                        <p style="font-size: 1.2rem; margin-top: 20px;">Hasło w tej rundzie było: <strong style="color: #00ccff;">${gameState.word}</strong></p>
                        <p style="font-size: 1.2rem;">Impostorzy widzieli podpowiedź: <strong style="color: #ffcc00;">${gameState.hint}</strong></p>
                    </div>
                </div>
            `;
        }
    } else if (outcome.type === 'innocentVotedOut') {
        const votedOutPlayer = gameState.players.find(p => p.id === outcome.votedOutId);

        // ✅ NAPRAWIONE: Dodano sprawdzenie czy gracz istnieje
        if (!votedOutPlayer) {
            console.error('Gracz nie został znaleziony:', outcome.votedOutId);
            resultsHTML = `
                <div class="results-card lose">
                    <h2 class="results-title"><i class="fas fa-user-secret"></i> IMPOSTORZY WYGRYWAJĄ!</h2>
                    <p class="results-message">Niewinny gracz został wybrany.</p>
                </div>
            `;
        } else {
            resultsHTML = `
                <div class="results-card lose">
                    <h2 class="results-title"><i class="fas fa-user-secret"></i> IMPOSTORZY WYGRYWAJĄ!</h2>
                    <p class="results-message">Niewinny gracz został wybrany: <strong style="color: #ff3366;">${votedOutPlayer.name}</strong></p>
                    
                    <div class="impostor-reveal">
                        <h4>PRAWDZIWI IMPOSTORZY:</h4>
                        ${gameState.impostorIds.map(impostorId => {
                const impostor = gameState.players.find(p => p.id === impostorId);
                return impostor ? `<p style="font-size: 1.8rem; font-weight: bold; color: #ff3366; margin: 10px 0;">
                                ${impostor.name}
                            </p>` : '';
            }).join('')}
                        <p style="font-size: 1.2rem; margin-top: 20px;">Hasło w tej rundzie było: <strong style="color: #00ccff;">${gameState.word}</strong></p>
                    </div>
                </div>
            `;
        }
    } else {
        resultsHTML = `
            <div class="results-card">
                <h2 class="results-title"><i class="fas fa-handshake"></i> REMIS!</h2>
                <p class="results-message">Nikt nie został wybrany lub głosy były równe.</p>
                
                <div class="impostor-reveal">
                    <h4>PRAWDZIWI IMPOSTORZY:</h4>
                    ${gameState.impostorIds.map(impostorId => {
            const impostor = gameState.players.find(p => p.id === impostorId);
            return impostor ? `<p style="font-size: 1.8rem; font-weight: bold; color: #ff3366; margin: 10px 0;">
                            ${impostor.name}
                        </p>` : '';
        }).join('')}
                    <p style="font-size: 1.2rem; margin-top: 20px;">Hasło w tej rundzie było: <strong style="color: #00ccff;">${gameState.word}</strong></p>
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
        <p style="font-size: 1.8rem; color: #ffffff; margin-bottom: 20px;">
            Impostor <strong style="color: #ff3366;">${data.guesserName}</strong> odgadł hasło!
        </p>
        <p style="font-size: 2.5rem; font-weight: bold; color: #00ff99; margin: 30px 0; text-shadow: 0 0 20px rgba(0, 255, 153, 0.5);">
            Hasło: ${data.word}
        </p>
        <p style="color: #ff3366; font-size: 1.5rem; font-weight: bold;">
            Impostorzy wygrywają rundę!
        </p>
        <p style="margin-top: 40px; color: #e0e0ff; font-size: 1.1rem;">
            Gra zakończona.
        </p>
    `;
}

function showGuessFailed(data) {
    const wordGuessedSection = document.getElementById('word-guessed-section');
    const wordGuessedContent = document.getElementById('word-guessed-content');

    wordGuessedSection.style.display = 'block';

    wordGuessedContent.innerHTML = `
        <p style="font-size: 1.8rem; color: #ffffff; margin-bottom: 20px;">
            Impostor <strong style="color: #ff3366;">${data.guesserName}</strong> nie odgadł hasła!
        </p>
        <p style="font-size: 2.5rem; font-weight: bold; color: #00ff99; margin: 30px 0; text-shadow: 0 0 20px rgba(0, 255, 153, 0.5);">
            Hasło: ${data.word}
        </p>
        <p style="color: #00ff99; font-size: 1.5rem; font-weight: bold;">
            Gracze wygrywają!
        </p>
        <p style="margin-top: 40px; color: #e0e0ff; font-size: 1.1rem;">
            Gra zakończona.
        </p>
    `;
}

function startNextRound() {
    if (timerInterval) clearInterval(timerInterval);
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    if (votingTimerInterval) clearInterval(votingTimerInterval);
    if (decisionTimerInterval) clearInterval(decisionTimerInterval);

    // Resetujemy stan inputów dla nowej rundy
    document.getElementById('association-input').value = '';
    document.getElementById('guess-input').value = '';
    document.getElementById('submitted-message').style.display = 'none';
    document.getElementById('guessed-message').style.display = 'none';
    document.getElementById('association-input').style.display = 'block';
    document.getElementById('submit-association-btn').style.display = 'flex';
    document.getElementById('guess-input').style.display = 'block';
    document.getElementById('submit-guess-btn').style.display = 'flex';

    updateGameInterface();

    // Dodaj wiadomość o nowej rundzie do czatu
    addChatMessage({
        type: 'system',
        playerName: 'SYSTEM',
        message: `🔄 Rozpoczyna się runda ${gameState.currentRound}!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        round: gameState.currentRound
    });
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
                <p style="font-size: 1.5rem; color: #ff3366; margin: 30px 0;">
                    Impostor odgadł hasło: <strong>${gameState.word}</strong>
                </p>
        `;
    } else if (reason === 'guessFailed') {
        resultsHTML = `
            <div class="results-card win">
                <h2 class="results-title">
                    <i class="fas fa-trophy"></i> GRACZE WYGRYWAJĄ!
                </h2>
                <p style="font-size: 1.5rem; color: #00ff99; margin: 30px 0;">
                    Impostor nie odgadł hasła: <strong>${gameState.word}</strong>
                </p>
        `;
    } else if (reason === 'allImpostorsFound') {
        resultsHTML = `
            <div class="results-card win">
                <h2 class="results-title">
                    <i class="fas fa-trophy"></i> GRACZE WYGRYWAJĄ!
                </h2>
                <p style="font-size: 1.5rem; color: #00ff99; margin: 30px 0;">
                    Wszyscy impostorzy zostali wykryci!
                </p>
                
                <div class="impostor-reveal" style="margin-top: 30px;">
                    <h4 style="color: #00ffcc; font-size: 1.5rem; margin-bottom: 20px;">PRAWDZIWI IMPOSTORZY:</h4>
                    ${gameState.impostorIds && gameState.impostorIds.length > 0 ? gameState.impostorIds.map(impostorId => {
            const impostor = gameState.players.find(p => p.id === impostorId);
            return impostor ? `<p style="font-size: 1.8rem; font-weight: bold; color: #ff3366; margin: 10px 0;">
                            ${impostor.name}
                        </p>` : '';
        }).join('') : '<p style="color: #888; font-style: italic;">Brak impostorów do wyświetlenia</p>'}
                </div>
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
        <div style="margin: 40px 0;">
            <h3 style="color: #00ffcc; margin-bottom: 25px; font-size: 1.8rem;">Role graczy:</h3>
            <div style="background: linear-gradient(145deg, rgba(26, 26, 46, 0.8) 0%, rgba(45, 27, 105, 0.8) 100%); border-radius: 15px; padding: 25px; border: 3px solid #8a2be2;">
                ${sortedPlayers.map((player, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; 
                                padding: 20px; border-bottom: ${index < sortedPlayers.length - 1 ? '2px solid rgba(255,255,255,0.1)' : 'none'};
                                background: ${player.isImpostor ? 'linear-gradient(145deg, rgba(255, 51, 102, 0.2) 0%, rgba(45, 27, 105, 0.8) 100%)' : 'linear-gradient(145deg, rgba(0, 204, 255, 0.2) 0%, rgba(45, 27, 105, 0.8) 100%)'}; 
                                border-radius: 12px; margin-bottom: 15px; border-left: 5px solid ${player.isImpostor ? '#ff3366' : player.isHost ? '#00ff99' : '#00ccff'};">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <div style="width: 50px; height: 50px; border-radius: 50%; background: ${player.isImpostor ? '#ff3366' : player.isHost ? '#00ff99' : '#00ccff'}; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                                ${player.isImpostor ? '👤' : player.isHost ? '👑' : '😊'}
                            </div>
                            <div>
                                <div style="font-weight: bold; font-size: 1.4rem;">${player.name}</div>
                                <div style="font-size: 1rem; color: ${player.isImpostor ? '#ff3366' : player.isHost ? '#00ff99' : '#00ccff'}">
                                    ${player.isImpostor ? 'IMPOSTOR' : player.isHost ? 'HOST' : 'GRACZ'}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div style="margin-top: 40px; padding: 30px; background: linear-gradient(145deg, rgba(26, 26, 46, 0.8) 0%, rgba(45, 27, 105, 0.8) 100%); border-radius: 15px; border: 3px solid #00ccff;">
            <h4 style="color: #00ffcc; margin-bottom: 20px; font-size: 1.5rem;">Podsumowanie:</h4>
            <ul style="color: #e0e0ff; line-height: 2; font-size: 1.1rem;">
                <li><i class="fas fa-key" style="color: #00ccff;"></i> Ostatnie hasło: <strong>${gameState.word}</strong></li>
                <li><i class="fas fa-eye" style="color: #ff3366;"></i> Impostorzy widzieli: <strong>${gameState.hint}</strong></li>
                <li><i class="fas fa-redo" style="color: #00ff99;"></i> Rozegrane rundy: <strong>${gameState.currentRound}</strong></li>
                <li><i class="fas fa-user-secret" style="color: #ffcc00;"></i> Impostorzy: <strong>${gameState.impostorIds.length}</strong></li>
            </ul>
        </div>
        
        <p style="margin-top: 40px; color: #00ffcc; font-style: italic; font-size: 1.2rem;">
            Dziękujemy za grę! 🎮
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
    messageElement.className = `chat-message ${chatMessage.type || 'chat'}`;

    let icon = 'fa-user';
    let playerNameDisplay = chatMessage.playerName;

    if (chatMessage.type === 'system') {
        icon = 'fa-bullhorn';
        playerNameDisplay = `<span style="color: #ffcc00;">${chatMessage.playerName}</span>`;
    } else if (chatMessage.type === 'association') {
        icon = 'fa-comment';
        playerNameDisplay = `<span style="color: #00ccff;">${chatMessage.playerName}</span>`;
    } else if (chatMessage.type === 'guess') {
        icon = 'fa-lightbulb';
        playerNameDisplay = `<span style="color: #00ff99;">${chatMessage.playerName}</span>`;
    }

    messageElement.innerHTML = `
        <div class="message-header">
            <div>
                <span class="message-player"><i class="fas ${icon}"></i> ${playerNameDisplay}</span>
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
                <td><strong style="color: #00ffcc;">${wordPair.word}</strong></td>
                <td style="color: #e0e0ff;">${wordPair.hint}</td>
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
        btn.addEventListener('click', function () {
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
    console.log('DOM załadowany, inicjalizacja...');
    initSocket();

    // Ekran startowy
    const createGameBtn = document.getElementById('create-game-btn');
    if (createGameBtn) {
        createGameBtn.addEventListener('click', () => {
            switchScreen('create');
        });
    } else {
        console.error('Nie znaleziono przycisku create-game-btn');
    }

    const joinGameBtn = document.getElementById('join-game-btn');
    if (joinGameBtn) {
        joinGameBtn.addEventListener('click', () => {
            switchScreen('join');
        });
    } else {
        console.error('Nie znaleziono przycisku join-game-btn');
    }

    // Ekran tworzenia gry
    const createGameFinalBtn = document.getElementById('create-game-final-btn');
    if (!createGameFinalBtn) {
        console.error('Nie znaleziono przycisku create-game-final-btn');
        return;
    }

    createGameFinalBtn.addEventListener('click', () => {
        try {
            const playerName = document.getElementById('player-name-host').value.trim();
            const rounds = document.getElementById('rounds-count').value;
            const roundTime = document.getElementById('round-time').value;
            const numImpostors = document.getElementById('num-impostors').value;
            const gameMode = document.getElementById('game-mode').value;
            const decisionTimeElement = document.getElementById('decision-time');
            const decisionTime = decisionTimeElement ? decisionTimeElement.value : '30';

            if (!playerName) {
                showNotification('Wpisz swój pseudonim!', 'error');
                return;
            }

            if (!socket || !socket.connected) {
                showNotification('Brak połączenia z serwerem. Spróbuj odświeżyć stronę.', 'error');
                console.error('Socket nie jest połączony');
                return;
            }

            console.log('Tworzenie gry:', { playerName, rounds, roundTime, numImpostors, gameMode, decisionTime });

            socket.emit('createGame', {
                playerName,
                rounds,
                roundTime,
                numImpostors,
                gameMode,
                decisionTime,
                customWordData: selectedWordForGame
            });

            // Zresetuj wybrane słowo
            selectedWordForGame = null;
        } catch (error) {
            console.error('Błąd przy tworzeniu gry:', error);
            showNotification('Wystąpił błąd przy tworzeniu gry. Sprawdź konsolę.', 'error');
        }
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
        socket.emit('verifyAdminPassword', password);
    });

    socket.on('adminAccessGranted', () => {
        document.getElementById('password-section').style.display = 'none';
        document.getElementById('word-selection-section').style.display = 'block';

        // Załaduj tabelę słów
        loadWordsTable();

        // Zresetuj wybrane słowo
        selectedWordForGame = null;
        document.getElementById('selected-word-info').style.display = 'none';
        document.getElementById('confirm-word-btn').disabled = true;
    });

    socket.on('adminAccessDenied', () => {
        showNotification('Niepoprawne hasło!', 'error');
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
            socket.emit('endGame');
        }
    });

    // Ekran wyników końcowych
    document.getElementById('play-again-btn').addEventListener('click', () => {
        if (isHost) {
            socket.emit('restartGame');
        } else {
            // ✅ NAPRAWIONE: Sprawdź czy host istnieje
            if (!gameState || !gameState.players || !gameState.players.find(p => p.isHost)) {
                showNotification('Host opuścił grę. Wracasz do menu głównego.', 'error');
                setTimeout(() => {
                    socket.disconnect();
                    initSocket();
                    switchScreen('start');
                }, 2000);
            } else {
                showNotification('Host musi najpierw kliknąć "Zagraj ponownie". Poczekaj na hosta.', 'info');
            }
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

    // ✅ NAPRAWIONE: Usunięto możliwość wpisywania w chat - tylko systemowe powiadomienia

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
    document.getElementById('game-code-input').addEventListener('input', function (e) {
        this.value = this.value.toUpperCase();
    });

    // Zamykanie modala po kliknięciu poza nim
    document.getElementById('advanced-options-modal').addEventListener('click', function (e) {
        if (e.target === this) {
            this.style.display = 'none';
        }
    });

    // Automatyczne wysyłanie pustych odpowiedzi po czasie
    document.getElementById('round-time').addEventListener('change', function () {
        roundTime = parseInt(this.value);
    });
});


