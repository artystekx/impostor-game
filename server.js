const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serwowanie plików statycznych
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rozszerzona lista haseł
const wordPairs = [
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
  { word: "KRZESŁO", hint: "Do siedzenia" },
  { word: "OGRODNIK", hint: "Zawód" },
  { word: "KWIAT", hint: "Roślina ozdobna" },
  { word: "SAMOLOT", hint: "Środek transportu powietrznego" },
  { word: "ROWER", hint: "Pojazd dwukołowy" },
  { word: "KOMPUTER", hint: "Urządzenie elektroniczne" },
  { word: "LAMPKA", hint: "Źródło światła" },
  { word: "KALENDARZ", hint: "System pomiaru czasu" },
  { word: "TELEWIZOR", hint: "Urządzenie do oglądania programów" },
  { word: "FOTEL", hint: "Mebel do siedzenia" },
  { word: "PARASOL", hint: "Ochrona przed deszczem" },
  { word: "ZEGAR", hint: "Pokazuje czas" }
];

// Przechowywanie gier
const games = new Map();

class Game {
  constructor(code, hostId, rounds, roundTime, numImpostors, gameMode, customWordData = null, decisionTime = 30) {
    this.code = code;
    this.hostId = hostId;
    this.rounds = parseInt(rounds);
    this.roundTime = parseInt(roundTime);
    this.decisionTime = parseInt(decisionTime) || 30;
    this.numImpostors = parseInt(numImpostors) || 1;
    this.gameMode = gameMode || 'simultaneous';
    this.players = new Map();
    this.currentRound = 0;
    this.isPlaying = false;
    this.isVoting = false;
    this.isDeciding = false;
    this.impostorIds = [];
    this.associations = new Map();
    this.votes = new Map();
    this.voteResults = new Map();
    this.decisions = new Map();
    this.guesses = new Map();
    this.roundStartTime = null;
    this.timer = null;
    this.currentTurnIndex = 0;
    this.turnOrder = [];
    this.turnTimer = null;
    this.votingTimeout = null;
    this.decisionTimeout = null;
    this.chatMessages = [];
    this.customWordData = customWordData;
    
    if (customWordData && customWordData.word && customWordData.hint) {
      this.currentWordPair = customWordData;
      this.word = customWordData.word;
      this.hint = customWordData.hint;
    } else {
      this.currentWordPair = this.getRandomWordPair();
      this.word = this.currentWordPair.word;
      this.hint = this.currentWordPair.hint;
    }
    
    this.wordGuessed = false;
    this.guessFailed = false;
    this.gameEnded = false;
    this.turnTimeLeft = 30;
    this.turnTimerInterval = null;
    this.turnStartTime = null;
    this.turnTimerBroadcastInterval = null;
  }

  getRandomWordPair() {
    const randomIndex = Math.floor(Math.random() * wordPairs.length);
    return wordPairs[randomIndex];
  }

  addPlayer(playerId, name) {
    this.players.set(playerId, {
      id: playerId,
      name: name,
      isImpostor: false,
      isHost: playerId === this.hostId,
      hasSubmitted: false,
      association: '',
      hasDecided: false,
      hasGuessed: false,
      guess: '',
      turnCompleted: false,
      voteSubmitted: false
    });
    
    return this.players.get(playerId);
  }

  removePlayer(playerId) {
    const wasImpostor = this.players.get(playerId)?.isImpostor;
    const wasHost = playerId === this.hostId;
    
    // Usuń gracza z listy
    this.players.delete(playerId);
    
    // Usuń z listy impostorów
    this.impostorIds = this.impostorIds.filter(id => id !== playerId);
    
    // ✅ NAPRAWIONE: Usuń głosy, decyzje i skojarzenia rozłączonego gracza
    this.votes.delete(playerId);
    this.decisions.delete(playerId);
    this.associations.delete(playerId);
    this.guesses.delete(playerId);
    
    // ✅ NAPRAWIONE: Usuń głosy NA rozłączonego gracza
    for (const [voterId, votedId] of this.votes.entries()) {
      if (votedId === playerId) {
        this.votes.delete(voterId);
        const voter = this.players.get(voterId);
        if (voter) {
          voter.voteSubmitted = false;
        }
      }
    }
    
    // ✅ NAPRAWIONE: Sprawdź czy można kontynuować głosowanie/decyzje po rozłączeniu gracza
    let shouldProcessVotes = false;
    let shouldProcessDecision = false;
    let voteResults = null;
    let decisionResult = null;
    
    if (this.isVoting && this.players.size > 0) {
      const allVoted = Array.from(this.players.values())
        .every(p => this.votes.has(p.id));
      if (allVoted) {
        shouldProcessVotes = true;
        voteResults = this.calculateVoteResults();
      }
    }
    
    if (this.isDeciding && this.players.size > 0) {
      const allDecided = Array.from(this.players.values())
        .every(p => p.hasDecided);
      if (allDecided) {
        shouldProcessDecision = true;
        decisionResult = this.calculateDecisionResult();
      }
    }
    
    // ✅ NAPRAWIONE: Sprawdź minimalną liczbę graczy (minimum 3 do gry)
    if (this.isPlaying && this.players.size < 3) {
      this.isPlaying = false;
      this.gameEnded = true;
    }
    
    // Zwróć informacje o stanie
    if (wasHost) {
      return { 
        wasHost: true,
        shouldProcessVotes,
        shouldProcessDecision,
        voteResults,
        decisionResult
      };
    }
    
    return { 
      wasHost: false,
      shouldProcessVotes,
      shouldProcessDecision,
      voteResults,
      decisionResult
    };
  }

  startGame() {
    this.isPlaying = true;
    this.currentRound = 1;
    this.wordGuessed = false;
    this.guessFailed = false;
    this.gameEnded = false;
    this.chatMessages = [];
    
    // Wybierz impostorów - host też może być impostorem!
    this.impostorIds = [];
    const allPlayers = Array.from(this.players.values());
    
    // Zresetuj role wszystkich graczy
    for (const player of allPlayers) {
      player.isImpostor = false;
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
      player.hasGuessed = false;
      player.guess = '';
      player.turnCompleted = false;
      player.voteSubmitted = false;
    }
    
    // Losowo wybierz impostorów spośród WSZYSTKICH graczy (w tym hosta)
    const shuffled = [...allPlayers].sort(() => 0.5 - Math.random());
    const impostorCount = Math.min(this.numImpostors, allPlayers.length);
    
    for (let i = 0; i < impostorCount; i++) {
      const impostorId = shuffled[i].id;
      this.impostorIds.push(impostorId);
      const player = this.players.get(impostorId);
      if (player) {
        player.isImpostor = true;
      }
    }
    
    console.log(`Game ${this.code}: Assigned impostors: ${this.impostorIds.join(', ')}`);
    
    this.associations.clear();
    this.votes.clear();
    this.voteResults.clear();
    this.decisions.clear();
    this.guesses.clear();
    
    // Jeśli nie ma custom słowa, losuj nowe
    if (!this.customWordData) {
      this.currentWordPair = this.getRandomWordPair();
      this.word = this.currentWordPair.word;
      this.hint = this.currentWordPair.hint;
    }
    
    if (this.gameMode === 'sequential') {
      this.prepareTurnOrder();
      // Uruchom timer dla pierwszego gracza
      const firstPlayerId = this.getCurrentTurnPlayerId();
      if (firstPlayerId) {
        this.turnStartTime = Date.now();
        this.turnTimeLeft = 30;
      }
    }
    
    return this.getGameState();
  }

  prepareTurnOrder() {
    const allPlayers = Array.from(this.players.values());
    this.turnOrder = [...allPlayers].sort(() => 0.5 - Math.random()).map(p => p.id);
    this.currentTurnIndex = 0;
  }

  getCurrentTurnPlayerId() {
    if (this.currentTurnIndex < this.turnOrder.length) {
      return this.turnOrder[this.currentTurnIndex];
    }
    return null;
  }

  nextTurn() {
    const currentPlayerId = this.getCurrentTurnPlayerId();
    if (currentPlayerId) {
      const player = this.players.get(currentPlayerId);
      if (player) {
        player.turnCompleted = true;
      }
    }
    
    this.currentTurnIndex++;
    
    // Znajdź następnego gracza, który jeszcze nie wysłał skojarzenia
    while (this.currentTurnIndex < this.turnOrder.length) {
      const nextPlayerId = this.turnOrder[this.currentTurnIndex];
      const nextPlayer = this.players.get(nextPlayerId);
      if (nextPlayer && !nextPlayer.hasSubmitted) {
        return nextPlayerId;
      }
      this.currentTurnIndex++;
    }
    
    // Jeśli wszyscy gracze już wysłali lub nie ma więcej graczy
    return null;
  }

  submitAssociation(playerId, association) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    // Jeśli gracz już wysłał skojarzenie, nie pozwól wysłać ponownie
    if (player.hasSubmitted) return false;
    
    player.association = association;
    player.hasSubmitted = true;
    this.associations.set(playerId, association);
    
    if (this.gameMode === 'sequential') {
      // Sprawdź czy wszyscy gracze wysłali skojarzenia
      const allPlayers = Array.from(this.players.values());
      const allSubmitted = allPlayers.every(p => p.hasSubmitted);
      
      return allSubmitted;
    } else {
      // W trybie simultaneous - WSZYSCY gracze (w tym impostorzy) mogą wysyłać skojarzenia w każdej rundzie
      const allPlayers = Array.from(this.players.values());
      const allSubmitted = allPlayers.every(p => p.hasSubmitted);
      
      return allSubmitted;
    }
  }

  submitGuess(playerId, guess) {
    const player = this.players.get(playerId);
    if (!player || !player.isImpostor) return false;
    
    player.hasGuessed = true;
    player.guess = guess;
    this.guesses.set(playerId, guess);
    
    const guessedCorrectly = guess.trim().toLowerCase() === this.word.toLowerCase();
    
    if (guessedCorrectly) {
      this.wordGuessed = true;
      this.isPlaying = false;
      this.gameEnded = true;
      return {
        correct: true,
        guesserId: playerId,
        guesserName: player.name
      };
    } else {
      this.guessFailed = true;
      this.isPlaying = false;
      this.gameEnded = true;
      return {
        correct: false,
        guesserId: playerId,
        guesserName: player.name
      };
    }
  }

  startDecisionPhase() {
    this.isDeciding = true;
    this.isVoting = false;
    this.decisions.clear();
    
    // Zatrzymaj timer tury jeśli działa
    if (this.turnTimerBroadcastInterval) {
      clearInterval(this.turnTimerBroadcastInterval);
      this.turnTimerBroadcastInterval = null;
    }
    
    for (const player of this.players.values()) {
      player.hasDecided = false;
    }
    
    // Wyczyść poprzedni timeout jeśli istnieje
    if (this.decisionTimeout) {
      clearTimeout(this.decisionTimeout);
    }
    
    // Ustaw timeout dla fazy decyzji
    this.decisionTimeout = setTimeout(() => {
      if (this.isDeciding && this.isPlaying) {
        console.log(`Game ${this.code}: Decision timeout - forcing decision calculation`);
        
        // Automatycznie dodaj decyzje dla graczy którzy nie zdecydowali
        for (const player of this.players.values()) {
          if (!player.hasDecided) {
            // Domyślnie głosuj na kontynuację (false)
            player.hasDecided = true;
            this.decisions.set(player.id, false);
          }
        }
        
        const decisionResult = this.calculateDecisionResult();
        
        // Powiadom wszystkich graczy i przetwórz wynik
        setTimeout(() => {
          if (decisionResult.majorityWantsVote) {
            this.startVoting();
            io.to(this.code).emit('votingStarted', {
              decisionResult,
              gameState: this.getGameState()
            });
          } else {
            this.nextRound(true);
            io.to(this.code).emit('nextRoundStarted', {
              gameState: this.getGameState()
            });
          }
        }, 500);
      }
    }, this.decisionTime * 1000);
    
    return this.getGameState();
  }

  submitDecision(playerId, decision) {
    const player = this.players.get(playerId);
    if (!player || !this.isDeciding) return false;
    
    player.hasDecided = true;
    this.decisions.set(playerId, decision);
    
    const allDecided = Array.from(this.players.values())
      .every(p => p.hasDecided);
    
    if (allDecided) {
      return this.calculateDecisionResult();
    }
    
    return null;
  }

  calculateDecisionResult() {
    let voteCount = 0;
    let continueCount = 0;
    
    for (const decision of this.decisions.values()) {
      if (decision) {
        voteCount++;
      } else {
        continueCount++;
      }
    }
    
    // Jeśli remis - losuj
    let majorityWantsVote = voteCount > continueCount;
    if (voteCount === continueCount) {
      majorityWantsVote = Math.random() < 0.5;
    }
    
    return {
      voteCount,
      continueCount,
      majorityWantsVote
    };
  }

  startVoting() {
    this.isVoting = true;
    this.isDeciding = false;
    this.votes.clear();
    
    // Resetuj stan głosowania dla wszystkich graczy
    for (const player of this.players.values()) {
      player.voteSubmitted = false;
    }
    
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
    }
    
    // Użyj tego samego czasu co dla decyzji
    this.votingTimeout = setTimeout(() => {
      if (this.isVoting && this.isPlaying) {
        console.log(`Game ${this.code}: Voting timeout - forcing vote calculation`);
        
        // Automatycznie dodaj głosy dla graczy którzy nie zagłosowali (losowy głos)
        for (const player of this.players.values()) {
          if (!player.voteSubmitted) {
            // Losuj gracza na którego zagłosować (nie można głosować na siebie)
            const availablePlayers = Array.from(this.players.values())
              .filter(p => p.id !== player.id)
              .map(p => p.id);
            
            if (availablePlayers.length > 0) {
              const randomPlayerId = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
              player.voteSubmitted = true;
              this.votes.set(player.id, randomPlayerId);
              console.log(`Game ${this.code}: Auto-vote for ${player.name} -> ${this.players.get(randomPlayerId)?.name}`);
            }
          }
        }
        
        const voteResults = this.calculateVoteResults();
        // ✅ NAPRAWIONE: Zapisz wynik tylko raz (było wywołane 2 razy)
        const outcome = this.handleVoteResults(voteResults);
        
        // Powiadom wszystkich graczy
        io.to(this.code).emit('voteResults', {
          results: voteResults,
          outcome: outcome,  // ✅ Użyj zapisanego wyniku zamiast wywoływać ponownie
          gameState: this.getGameState()
        });
        
        // ✅ NAPRAWIONE: Obsługa zakończenia gry po timeout
        if (outcome.gameEnded) {
          setTimeout(() => {
            io.to(this.code).emit('gameEnded', {
              reason: 'allImpostorsFound',
              gameState: this.getGameState()
            });
          }, 3000);
        }
      }
    }, this.decisionTime * 1000);
    
    return this.getGameState();
  }

  submitVote(voterId, votedPlayerId) {
    // Sprawdź czy gracz, na którego głosujemy, istnieje
    if (!this.players.has(votedPlayerId)) {
      console.log(`Game ${this.code}: Invalid vote - player ${votedPlayerId} doesn't exist`);
      return null;
    }
    
    const voter = this.players.get(voterId);
    if (!voter) {
      console.log(`Game ${this.code}: Invalid voter - player ${voterId} doesn't exist`);
      return null;
    }
    
    voter.voteSubmitted = true;
    this.votes.set(voterId, votedPlayerId);
    
    const allVoted = Array.from(this.players.values())
      .every(p => this.votes.has(p.id));
    
    if (allVoted) {
      if (this.votingTimeout) {
        clearTimeout(this.votingTimeout);
        this.votingTimeout = null;
      }
      
      return this.calculateVoteResults();
    }
    
    return null;
  }

  calculateVoteResults() {
    const voteCounts = new Map();
    
    // Zlicz głosy, ignorując głosy na nieistniejących graczy
    for (const votedId of this.votes.values()) {
      // Sprawdź czy gracz o takim ID istnieje
      if (this.players.has(votedId)) {
        voteCounts.set(votedId, (voteCounts.get(votedId) || 0) + 1);
      }
    }
    
    let maxVotes = 0;
    let votedOutIds = [];
    
    // Znajdź gracza z największą liczbą głosów
    for (const [playerId, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        votedOutIds = [playerId];
      } else if (count === maxVotes && maxVotes > 0) {
        votedOutIds.push(playerId);
      }
    }
    
    this.voteResults = voteCounts;
    
    // Jeśli remis (więcej niż 1 gracz z max głosami) - losuj
    if (votedOutIds.length > 1 && maxVotes > 0) {
      const randomIndex = Math.floor(Math.random() * votedOutIds.length);
      votedOutIds = [votedOutIds[randomIndex]];
      console.log(`Game ${this.code}: Vote tie - random choice: ${votedOutIds[0]}`);
    }
    
    // Jeśli brak głosów lub remis z 0 głosami
    if (votedOutIds.length !== 1) {
      return {
        votedOutIds: [],
        voteCounts: Array.from(voteCounts.entries()),
        maxVotes,
        isTie: maxVotes > 0
      };
    }
    
    return {
      votedOutIds,
      voteCounts: Array.from(voteCounts.entries()),
      maxVotes,
      isTie: false
    };
  }

  handleVoteResults(voteResults) {
    // Jeśli jest remis lub brak głosów
    if (voteResults.isTie || voteResults.votedOutIds.length !== 1) {
      return {
        type: 'noOneVotedOut',
        impostorsRemaining: this.impostorIds.length,
        isTie: true
      };
    }
    
    const votedOutId = voteResults.votedOutIds[0];
    const wasImpostor = this.impostorIds.includes(votedOutId);
    
    if (wasImpostor) {
      const player = this.players.get(votedOutId);
      if (player) {
        player.isImpostor = false;
      }
      this.impostorIds = this.impostorIds.filter(id => id !== votedOutId);
      
      if (this.impostorIds.length === 0) {
        this.isPlaying = false;
        this.gameEnded = true;
        return {
          type: 'impostorVotedOut',
          votedOutId,
          wasImpostor: true,
          impostorsRemaining: 0,
          gameEnded: true
        };
      }
      
      return {
        type: 'impostorVotedOut',
        votedOutId,
        wasImpostor: true,
        impostorsRemaining: this.impostorIds.length
      };
    } else {
      // Niewinny gracz został wybrany
      return {
        type: 'innocentVotedOut',
        votedOutId,
        wasImpostor: false,
        impostorsRemaining: this.impostorIds.length
      };
    }
  }

  nextRound(keepSameWord = false) {
    // Sprawdź czy to już ostatnia runda - jeśli tak, przejdź do głosowania
    if (this.currentRound >= this.rounds) {
      this.startVoting();
      return this.getGameState();
    }
    
    this.currentRound++;
    this.isVoting = false;
    this.isDeciding = false;
    this.wordGuessed = false;
    this.guessFailed = false;
    this.isPlaying = true;
    
    // Resetujemy stan graczy
    for (const player of this.players.values()) {
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
      player.hasGuessed = false;
      player.guess = '';
      player.turnCompleted = false;
      player.voteSubmitted = false;
    }
    
    this.associations.clear();
    this.votes.clear();
    this.voteResults.clear();
    this.decisions.clear();
    this.guesses.clear();
    
    // Losuj nowe słowo dla każdej nowej rundy (chyba że host chce zachować)
    if (!keepSameWord) {
      this.currentWordPair = this.getRandomWordPair();
      this.word = this.currentWordPair.word;
      this.hint = this.currentWordPair.hint;
    }
    
    // Dla trybu sequential przygotuj nową kolejkę
    if (this.gameMode === 'sequential') {
      this.prepareTurnOrder();
    }
    
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
      this.votingTimeout = null;
    }
    
    if (this.decisionTimeout) {
      clearTimeout(this.decisionTimeout);
      this.decisionTimeout = null;
    }
    
    // Zatrzymaj timer tury jeśli działa
    if (this.turnTimerBroadcastInterval) {
      clearInterval(this.turnTimerBroadcastInterval);
      this.turnTimerBroadcastInterval = null;
    }
    
    return this.getGameState();
  }

  endGame() {
    this.isPlaying = false;
    this.gameEnded = true;
    return this.getGameState();
  }

  addChatMessage(playerId, message, type = 'chat') {
    const player = this.players.get(playerId);
    let playerName = 'SYSTEM';
    
    if (player) {
      playerName = player.name;
    } else if (type === 'system') {
      playerName = 'SYSTEM';
    }
    
    const chatMessage = {
      id: Date.now(),
      playerId: playerId,
      playerName: playerName,
      message: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      round: this.currentRound,
      type: type
    };
    
    this.chatMessages.push(chatMessage);
    
    // Ogranicz historię czatu do ostatnich 50 wiadomości
    if (this.chatMessages.length > 50) {
      this.chatMessages = this.chatMessages.slice(-50);
    }
    
    return chatMessage;
  }

  getGameState(playerId = null) {
    const associationsWithNames = Array.from(this.associations.entries()).map(([id, association]) => {
      const player = this.players.get(id);
      return {
        playerId: id,
        playerName: player ? player.name : 'Nieznany',
        association: association,
        isImpostor: player ? player.isImpostor : false,
        hasSubmitted: player ? player.hasSubmitted : false
      };
    });

    const state = {
      code: this.code,
      word: this.word,
      hint: this.hint,
      rounds: this.rounds,
      roundTime: this.roundTime,
      decisionTime: this.decisionTime,
      numImpostors: this.numImpostors,
      gameMode: this.gameMode,
      currentRound: this.currentRound,
      isPlaying: this.isPlaying,
      isVoting: this.isVoting,
      isDeciding: this.isDeciding,
      wordGuessed: this.wordGuessed,
      guessFailed: this.guessFailed,
      gameEnded: this.gameEnded,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isImpostor: p.isImpostor,
        isHost: p.isHost,
        hasSubmitted: p.hasSubmitted,
        hasDecided: p.hasDecided,
        hasGuessed: p.hasGuessed,
        turnCompleted: p.turnCompleted,
        voteSubmitted: p.voteSubmitted,
        association: this.isVoting || this.isDeciding ? p.association : '',
        guess: p.guess
      })),
      associations: associationsWithNames,
      votes: Array.from(this.votes.entries()),
      voteResults: Array.from(this.voteResults.entries()),
      decisions: Array.from(this.decisions.entries()),
      guesses: Array.from(this.guesses.entries()),
      impostorIds: this.impostorIds,
      currentTurnPlayerId: this.gameMode === 'sequential' ? this.getCurrentTurnPlayerId() : null,
      turnOrder: this.gameMode === 'sequential' ? this.turnOrder : [],
      chatMessages: this.chatMessages
    };
    
    if (playerId) {
      const player = this.players.get(playerId);
      if (player) {
        // impostor widzi podpowiedź, nie hasło
        if (player.isImpostor && this.isPlaying && !this.wordGuessed && !this.guessFailed) {
          state.playerWord = this.hint; // TYLKO podpowiedź dla impostora
          state.isImpostor = true;
          
          state.coImpostors = this.impostorIds
            .filter(id => id !== playerId)
            .map(id => {
              const coImpostor = this.players.get(id);
              return coImpostor ? coImpostor.name : 'Nieznany';
            });
        } else {
          state.playerWord = this.word; // Gracz widzi hasło
          state.isImpostor = false;
        }
        
        state.player = {
          id: player.id,
          name: player.name,
          isImpostor: player.isImpostor,
          isHost: player.isHost
        };
      }
    }
    
    return state;
  }
}

function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log('Nowe połączenie:', socket.id);
  
  socket.on('createGame', (data) => {
    try {
      console.log('Otrzymano createGame:', data);
      const { playerName, rounds, roundTime, numImpostors, gameMode, customWordData, decisionTime } = data;
      
      let code;
      do {
        code = generateGameCode();
      } while (games.has(code));
      
      const game = new Game(code, socket.id, rounds, roundTime, numImpostors, gameMode, customWordData, decisionTime);
      games.set(code, game);
      
      game.addPlayer(socket.id, playerName || 'Host');
      
      socket.join(code);
      socket.gameCode = code;
      
      const gameState = game.getGameState(socket.id);
      console.log('Wysyłanie gameCreated dla:', socket.id, 'Kod:', code);
      
      socket.emit('gameCreated', { 
        code,
        gameState: gameState
      });
      
      console.log(`Gra utworzona: ${code} przez ${socket.id}`);
    } catch (error) {
      console.error('Błąd przy tworzeniu gry:', error);
      socket.emit('error', { message: 'Błąd przy tworzeniu gry: ' + error.message });
    }
  });
  
  socket.on('joinGame', (data) => {
    const { code, playerName } = data;
    
    if (!games.has(code)) {
      socket.emit('error', { message: 'Gra o podanym kodzie nie istnieje' });
      return;
    }
    
    const game = games.get(code);
    
    if (game.isPlaying) {
      socket.emit('error', { message: 'Gra już się rozpoczęła' });
      return;
    }
    
    const player = game.addPlayer(socket.id, playerName);
    
    socket.join(code);
    socket.gameCode = code;
    
    socket.emit('gameJoined', { 
      gameState: game.getGameState(socket.id)
    });
    
    io.to(code).emit('playerJoined', {
      player,
      gameState: game.getGameState()
    });
    
    console.log(`Gracz dołączył: ${playerName} do gry ${code}`);
  });
  
  socket.on('startGame', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (socket.id !== game.hostId) return;
    
    if (game.players.size < 3) {
      socket.emit('error', { message: 'Potrzeba co najmniej 3 graczy aby rozpocząć grę' });
      return;
    }
    
    game.startGame();
    
    // Uruchom timer dla pierwszego gracza w trybie sequential
    if (game.gameMode === 'sequential') {
      const firstPlayerId = game.getCurrentTurnPlayerId();
      if (firstPlayerId) {
        game.turnStartTime = Date.now();
        game.turnTimeLeft = 30;
        
        // Wyślij początkowy czas natychmiast
        io.to(gameCode).emit('turnTimerUpdate', {
          timeLeft: game.turnTimeLeft,
          gameState: game.getGameState()
        });
        
        // Rozpocznij broadcast timera
        game.turnTimerBroadcastInterval = setInterval(() => {
          if (game.isPlaying && !game.wordGuessed && !game.guessFailed && game.gameMode === 'sequential') {
            const currentTurnPlayerId = game.getCurrentTurnPlayerId();
            // ✅ NAPRAWIONE: Sprawdzaj aktualnego gracza, nie tylko pierwszego
            if (currentTurnPlayerId) {
              const elapsed = Math.floor((Date.now() - game.turnStartTime) / 1000);
              game.turnTimeLeft = Math.max(0, 30 - elapsed);
              
              io.to(gameCode).emit('turnTimerUpdate', {
                timeLeft: game.turnTimeLeft,
                gameState: game.getGameState()
              });
              
              // Jeśli czas się skończył, automatycznie przejdź dalej
              if (game.turnTimeLeft <= 0) {
                clearInterval(game.turnTimerBroadcastInterval);
                game.turnTimerBroadcastInterval = null;
                
                const currentPlayer = game.players.get(currentTurnPlayerId);
                if (currentPlayer && !currentPlayer.hasSubmitted) {
                  game.submitAssociation(currentTurnPlayerId, '');
                  io.to(gameCode).emit('associationSubmitted', {
                    playerId: currentTurnPlayerId,
                    association: '',
                    gameState: game.getGameState()
                  });
                  
                  // Przejdź do następnego gracza
                  const nextPlayerId = game.nextTurn();
                  if (nextPlayerId) {
                    game.turnStartTime = Date.now();
                    game.turnTimeLeft = 30;
                    
                    // Wyślij początkowy czas dla nowego gracza
                    io.to(gameCode).emit('turnTimerUpdate', {
                      timeLeft: game.turnTimeLeft,
                      gameState: game.getGameState()
                    });
                    
                    io.to(gameCode).emit('nextTurn', {
                      nextPlayerId: nextPlayerId,
                      gameState: game.getGameState()
                    });
                  } else {
                    setTimeout(() => {
                      game.startDecisionPhase();
                      io.to(gameCode).emit('decisionPhaseStarted', {
                        gameState: game.getGameState()
                      });
                    }, 1500);
                  }
                }
              }
            } else {
              // Brak gracza w kolejce, zatrzymaj timer
              clearInterval(game.turnTimerBroadcastInterval);
              game.turnTimerBroadcastInterval = null;
            }
          } else {
            clearInterval(game.turnTimerBroadcastInterval);
            game.turnTimerBroadcastInterval = null;
          }
        }, 1000);
      }
    }
    
    io.to(gameCode).emit('gameStarted', {
      gameState: game.getGameState()
    });
    
    console.log(`Gra rozpoczęta: ${gameCode}`);
  });
  
  socket.on('submitAssociation', (data) => {
    const { association } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || game.isVoting || game.isDeciding || game.wordGuessed || game.guessFailed) return;
    
    if (game.gameMode === 'sequential') {
      const currentTurnPlayerId = game.getCurrentTurnPlayerId();
      if (currentTurnPlayerId !== socket.id) {
        socket.emit('error', { message: 'Nie twoja kolej!' });
        return;
      }
    }
    
    const allSubmitted = game.submitAssociation(socket.id, association);
    
    // ✅ NAPRAWIONE: Dodaj wiadomość do czatu dla wszystkich trybów
    const player = game.players.get(socket.id);
    if (player) {
      const chatMessage = game.addChatMessage(socket.id, association || '(pominął)', 'association');
      io.to(gameCode).emit('newChatMessage', {
        chatMessage,
        gameState: game.getGameState()
      });
    }
    
    // Wyślij zaktualizowany stan gry do wszystkich
    const gameState = game.getGameState();
    io.to(gameCode).emit('associationSubmitted', {
      playerId: socket.id,
      association: association,
      gameState: gameState
    });
    
    if (game.gameMode === 'sequential') {
      const nextPlayerId = game.nextTurn();
      if (nextPlayerId) {
        // Zatrzymaj poprzedni timer
        if (game.turnTimerBroadcastInterval) {
          clearInterval(game.turnTimerBroadcastInterval);
          game.turnTimerBroadcastInterval = null;
        }
        
        // Uruchom nowy timer dla następnego gracza
        game.turnStartTime = Date.now();
        game.turnTimeLeft = 30;
        
        // Wyślij początkowy czas
        io.to(gameCode).emit('turnTimerUpdate', {
          timeLeft: game.turnTimeLeft,
          gameState: game.getGameState()
        });
        
        // ✅ NAPRAWIONE: Zatrzymaj poprzedni timer przed uruchomieniem nowego
        if (game.turnTimerBroadcastInterval) {
          clearInterval(game.turnTimerBroadcastInterval);
          game.turnTimerBroadcastInterval = null;
        }
        
        // Rozpocznij broadcast timera dla nowego gracza
        game.turnTimerBroadcastInterval = setInterval(() => {
          if (game.isPlaying && !game.wordGuessed && !game.guessFailed && game.gameMode === 'sequential') {
            const currentTurnPlayerId = game.getCurrentTurnPlayerId();
            // ✅ NAPRAWIONE: Sprawdzaj aktualnego gracza
            if (currentTurnPlayerId === nextPlayerId) {
              const elapsed = Math.floor((Date.now() - game.turnStartTime) / 1000);
              game.turnTimeLeft = Math.max(0, 30 - elapsed);
              
              io.to(gameCode).emit('turnTimerUpdate', {
                timeLeft: game.turnTimeLeft,
                gameState: game.getGameState()
              });
              
              // Jeśli czas się skończył, automatycznie przejdź dalej
              if (game.turnTimeLeft <= 0) {
                clearInterval(game.turnTimerBroadcastInterval);
                game.turnTimerBroadcastInterval = null;
                
                const currentPlayer = game.players.get(nextPlayerId);
                if (currentPlayer && !currentPlayer.hasSubmitted) {
                  game.submitAssociation(nextPlayerId, '');
                  io.to(gameCode).emit('associationSubmitted', {
                    playerId: nextPlayerId,
                    association: '',
                    gameState: game.getGameState()
                  });
                  
                  // Przejdź do następnego gracza
                  const nextNextPlayerId = game.nextTurn();
                  if (nextNextPlayerId) {
                    game.turnStartTime = Date.now();
                    game.turnTimeLeft = 30;
                    
                    // Wyślij początkowy czas dla nowego gracza
                    io.to(gameCode).emit('turnTimerUpdate', {
                      timeLeft: game.turnTimeLeft,
                      gameState: game.getGameState()
                    });
                    
                    io.to(gameCode).emit('nextTurn', {
                      nextPlayerId: nextNextPlayerId,
                      gameState: game.getGameState()
                    });
                  } else {
                    setTimeout(() => {
                      game.startDecisionPhase();
                      io.to(gameCode).emit('decisionPhaseStarted', {
                        gameState: game.getGameState()
                      });
                    }, 1500);
                  }
                }
              }
            } else {
              // Gracz się zmienił, zatrzymaj timer
              clearInterval(game.turnTimerBroadcastInterval);
              game.turnTimerBroadcastInterval = null;
            }
          } else {
            clearInterval(game.turnTimerBroadcastInterval);
            game.turnTimerBroadcastInterval = null;
          }
        }, 1000);
        
        io.to(gameCode).emit('nextTurn', {
          nextPlayerId: nextPlayerId,
          gameState: game.getGameState()
        });
      } else {
        // Zatrzymaj timer
        if (game.turnTimerBroadcastInterval) {
          clearInterval(game.turnTimerBroadcastInterval);
          game.turnTimerBroadcastInterval = null;
        }
        
        // Wszyscy gracze zakończyli tury
        setTimeout(() => {
          game.startDecisionPhase();
          io.to(gameCode).emit('decisionPhaseStarted', {
            gameState: game.getGameState()
          });
        }, 1500);
      }
    } else if (allSubmitted) {
      setTimeout(() => {
        game.startDecisionPhase();
        io.to(gameCode).emit('decisionPhaseStarted', {
          gameState: game.getGameState()
        });
      }, 1500);
    }
  });
  
  socket.on('submitGuess', (data) => {
    const { guess } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || game.wordGuessed || game.guessFailed) return;
    
    // Dodaj wiadomość do czatu
    const player = game.players.get(socket.id);
    if (player) {
      const chatMessage = game.addChatMessage(socket.id, `Zgadł: "${guess}"`, 'guess');
      io.to(gameCode).emit('newChatMessage', {
        chatMessage,
        gameState: game.getGameState()
      });
      
      // Powiadom o zgadywaniu
      io.to(gameCode).emit('guessSubmitted', {
        playerId: socket.id,
        guess: guess,
        gameState: game.getGameState()
      });
    }
    
    const result = game.submitGuess(socket.id, guess);
    
    if (result) {
      if (result.correct) {
        io.to(gameCode).emit('wordGuessed', {
          guesserId: result.guesserId,
          guesserName: result.guesserName,
          word: game.word,
          gameState: game.getGameState()
        });
        
        setTimeout(() => {
          io.to(gameCode).emit('gameEnded', {
            reason: 'wordGuessed',
            gameState: game.getGameState()
          });
        }, 3000);
      } else {
        io.to(gameCode).emit('guessFailed', {
          guesserId: result.guesserId,
          guesserName: result.guesserName,
          word: game.word,
          gameState: game.getGameState()
        });
        
        setTimeout(() => {
          io.to(gameCode).emit('gameEnded', {
            reason: 'guessFailed',
            gameState: game.getGameState()
          });
        }, 3000);
      }
    }
  });
  
  socket.on('submitDecision', (data) => {
    const { decision } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || !game.isDeciding || game.wordGuessed || game.guessFailed) return;
    
    const decisionResult = game.submitDecision(socket.id, decision);
    
    io.to(gameCode).emit('decisionSubmitted', {
      playerId: socket.id,
      gameState: game.getGameState()
    });
    
    if (decisionResult) {
      if (game.decisionTimeout) {
        clearTimeout(game.decisionTimeout);
        game.decisionTimeout = null;
      }
      
      setTimeout(() => {
        if (decisionResult.majorityWantsVote) {
          game.startVoting();
          io.to(gameCode).emit('votingStarted', {
            decisionResult,
            gameState: game.getGameState()
          });
        } else {
          game.nextRound(true);
          io.to(gameCode).emit('nextRoundStarted', {
            gameState: game.getGameState()
          });
        }
      }, 1500);
    }
  });
  
  socket.on('submitVote', (data) => {
    const { votedPlayerId } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || !game.isVoting || game.wordGuessed || game.guessFailed) return;
    
    const voteResults = game.submitVote(socket.id, votedPlayerId);
    
    io.to(gameCode).emit('voteSubmitted', {
      voterId: socket.id,
      gameState: game.getGameState()
    });
    
    if (voteResults) {
      setTimeout(() => {
        const voteOutcome = game.handleVoteResults(voteResults);
        
        // Wyślij wyniki głosowania do wszystkich graczy
        io.to(gameCode).emit('voteResults', {
          results: voteResults,
          outcome: voteOutcome,
          gameState: game.getGameState()
        });
        
        // Jeśli gra się zakończyła po głosowaniu
        if (voteOutcome.gameEnded) {
          setTimeout(() => {
            io.to(gameCode).emit('gameEnded', {
              reason: 'allImpostorsFound',
              gameState: game.getGameState()
            });
          }, 3000);
        }
      }, 1500);
    }
  });
  
  socket.on('nextRound', (data = {}) => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (socket.id !== game.hostId) return;
    
    const { keepSameWord = false } = data;
    
    // Sprawdź czy gra się już zakończyła
    if (game.gameEnded) {
      return;
    }
    
    // Jeśli to ostatnia runda, przejdź do głosowania
    if (game.currentRound >= game.rounds) {
      game.startVoting();
      io.to(gameCode).emit('votingStarted', {
        gameState: game.getGameState()
      });
      return;
    }
    
    // Jeśli nie ma już impostorów
    if (game.impostorIds.length === 0) {
      io.to(gameCode).emit('gameEnded', {
        reason: 'allImpostorsFound',
        gameState: game.getGameState()
      });
      return;
    }
    
    game.nextRound(keepSameWord);
    
    const gameState = game.getGameState();
    
    // ✅ NAPRAWIONE: Uruchom timer dla pierwszego gracza w trybie sequential po nowej rundzie
    if (game.gameMode === 'sequential' && game.isPlaying) {
      const firstPlayerId = game.getCurrentTurnPlayerId();
      if (firstPlayerId) {
        // ✅ NAPRAWIONE: Zresetuj timer przed uruchomieniem nowego
        if (game.turnTimerBroadcastInterval) {
          clearInterval(game.turnTimerBroadcastInterval);
          game.turnTimerBroadcastInterval = null;
        }
        
        game.turnStartTime = Date.now();
        game.turnTimeLeft = 30;
        
        // Wyślij początkowy czas natychmiast
        io.to(gameCode).emit('turnTimerUpdate', {
          timeLeft: game.turnTimeLeft,
          gameState: gameState
        });
        
        // Rozpocznij broadcast timera
        game.turnTimerBroadcastInterval = setInterval(() => {
          if (game.isPlaying && !game.wordGuessed && !game.guessFailed && game.gameMode === 'sequential') {
            const currentTurnPlayerId = game.getCurrentTurnPlayerId();
            // ✅ NAPRAWIONE: Sprawdzaj aktualnego gracza, nie tylko pierwszego
            if (currentTurnPlayerId) {
              const elapsed = Math.floor((Date.now() - game.turnStartTime) / 1000);
              game.turnTimeLeft = Math.max(0, 30 - elapsed);
              
              io.to(gameCode).emit('turnTimerUpdate', {
                timeLeft: game.turnTimeLeft,
                gameState: game.getGameState()
              });
              
              // Jeśli czas się skończył, automatycznie przejdź dalej
              if (game.turnTimeLeft <= 0) {
                clearInterval(game.turnTimerBroadcastInterval);
                game.turnTimerBroadcastInterval = null;
                
                const currentPlayer = game.players.get(currentTurnPlayerId);
                if (currentPlayer && !currentPlayer.hasSubmitted) {
                  game.submitAssociation(currentTurnPlayerId, '');
                  io.to(gameCode).emit('associationSubmitted', {
                    playerId: currentTurnPlayerId,
                    association: '',
                    gameState: game.getGameState()
                  });
                  
                  // Przejdź do następnego gracza
                  const nextPlayerId = game.nextTurn();
                  if (nextPlayerId) {
                    game.turnStartTime = Date.now();
                    game.turnTimeLeft = 30;
                    
                    // Wyślij początkowy czas dla nowego gracza
                    io.to(gameCode).emit('turnTimerUpdate', {
                      timeLeft: game.turnTimeLeft,
                      gameState: game.getGameState()
                    });
                    
                    io.to(gameCode).emit('nextTurn', {
                      nextPlayerId: nextPlayerId,
                      gameState: game.getGameState()
                    });
                  } else {
                    setTimeout(() => {
                      game.startDecisionPhase();
                      io.to(gameCode).emit('decisionPhaseStarted', {
                        gameState: game.getGameState()
                      });
                    }, 1500);
                  }
                }
              }
            } else {
              // Brak gracza w kolejce, zatrzymaj timer
              clearInterval(game.turnTimerBroadcastInterval);
              game.turnTimerBroadcastInterval = null;
            }
          } else {
            clearInterval(game.turnTimerBroadcastInterval);
            game.turnTimerBroadcastInterval = null;
          }
        }, 1000);
      }
    }
    
    io.to(gameCode).emit('nextRoundStarted', {
      gameState: gameState
    });
  });
  
  socket.on('endGame', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (socket.id !== game.hostId) return;
    
    game.endGame();
    
    io.to(gameCode).emit('gameEnded', {
      reason: 'manual',
      gameState: game.getGameState()
    });
  });
  
  socket.on('restartGame', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) {
      socket.emit('error', { message: 'Gra nie istnieje' });
      return;
    }
    
    const game = games.get(gameCode);
    
    // ✅ NAPRAWIONE: Sprawdź czy gracz jest hostem
    if (socket.id !== game.hostId) {
      socket.emit('error', { message: 'Tylko host może zrestartować grę' });
      return;
    }
    
    // Sprawdź czy host nadal istnieje w grze
    if (!game.players.has(game.hostId)) {
      socket.emit('error', { message: 'Host opuścił grę' });
      return;
    }
    
    // Zatrzymaj wszystkie timery
    if (game.turnTimerBroadcastInterval) {
      clearInterval(game.turnTimerBroadcastInterval);
      game.turnTimerBroadcastInterval = null;
    }
    if (game.votingTimeout) {
      clearTimeout(game.votingTimeout);
      game.votingTimeout = null;
    }
    if (game.decisionTimeout) {
      clearTimeout(game.decisionTimeout);
      game.decisionTimeout = null;
    }
    
    // Resetuj stan gry
    game.isPlaying = false;
    game.isVoting = false;
    game.isDeciding = false;
    game.gameEnded = false;
    game.wordGuessed = false;
    game.guessFailed = false;
    game.currentRound = 0;
    
    // ✅ NAPRAWIONE: Losuj nowych impostorów przy restarcie
    game.impostorIds = [];
    const allPlayers = Array.from(game.players.values());
    
    // Zresetuj role wszystkich graczy
    for (const player of allPlayers) {
      player.isImpostor = false;
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
      player.hasGuessed = false;
      player.guess = '';
      player.turnCompleted = false;
      player.voteSubmitted = false;
    }
    
    // Losowo wybierz nowych impostorów spośród WSZYSTKICH graczy (w tym hosta)
    const shuffled = [...allPlayers].sort(() => 0.5 - Math.random());
    const impostorCount = Math.min(game.numImpostors, allPlayers.length);
    
    for (let i = 0; i < impostorCount; i++) {
      const impostorId = shuffled[i].id;
      game.impostorIds.push(impostorId);
      const player = game.players.get(impostorId);
      if (player) {
        player.isImpostor = true;
      }
    }
    
    console.log(`Game ${gameCode}: Restart - New impostors assigned: ${game.impostorIds.join(', ')}`);
    
    // Wyczyść wszystkie dane rundy
    game.associations.clear();
    game.votes.clear();
    game.voteResults.clear();
    game.decisions.clear();
    game.guesses.clear();
    game.chatMessages = [];
    
    // ✅ NAPRAWIONE: Wyczyść customWordData i zawsze losuj nowe słowo przy restarcie
    game.customWordData = null;
    game.currentWordPair = game.getRandomWordPair();
    game.word = game.currentWordPair.word;
    game.hint = game.currentWordPair.hint;
    
    // Wyślij event do wszystkich graczy, żeby wrócili do lobby
    io.to(gameCode).emit('gameRestarted', {
      gameState: game.getGameState()
    });
    
    console.log(`Gra zrestartowana: ${gameCode}`);
  });
  
  socket.on('sendChatMessage', (data) => {
    const { message } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying) return;
    
    const chatMessage = game.addChatMessage(socket.id, message, 'chat');
    
    if (chatMessage) {
      io.to(gameCode).emit('newChatMessage', {
        chatMessage,
        gameState: game.getGameState()
      });
    }
  });
  
  socket.on('disconnect', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) {
      console.log('Rozłączono:', socket.id);
      return;
    }
    
    const game = games.get(gameCode);
    
    // ✅ NAPRAWIONE: Poprawiona obsługa rozłączenia gracza
    const removeResult = game.removePlayer(socket.id);
    
    if (removeResult.wasHost) {
      io.to(gameCode).emit('hostDisconnected');
      games.delete(gameCode);
      console.log(`Gra zakończona: ${gameCode} (host wyszedł)`);
    } else if (game.players.size === 0) {
      games.delete(gameCode);
      console.log(`Gra usunięta: ${gameCode} (brak graczy)`);
    } else {
      // ✅ NAPRAWIONE: Automatyczne przetwarzanie głosowania/decyzji jeśli warunki są spełnione
      if (removeResult.shouldProcessVotes && removeResult.voteResults) {
        setTimeout(() => {
          const voteOutcome = game.handleVoteResults(removeResult.voteResults);
          
          io.to(gameCode).emit('voteResults', {
            results: removeResult.voteResults,
            outcome: voteOutcome,
            gameState: game.getGameState()
          });
          
          if (voteOutcome.gameEnded) {
            setTimeout(() => {
              io.to(gameCode).emit('gameEnded', {
                reason: 'allImpostorsFound',
                gameState: game.getGameState()
              });
            }, 3000);
          }
        }, 500);
      } else if (removeResult.shouldProcessDecision && removeResult.decisionResult) {
        setTimeout(() => {
          if (removeResult.decisionResult.majorityWantsVote) {
            game.startVoting();
            io.to(gameCode).emit('votingStarted', {
              decisionResult: removeResult.decisionResult,
              gameState: game.getGameState()
            });
          } else {
            game.nextRound(true);
            io.to(gameCode).emit('nextRoundStarted', {
              gameState: game.getGameState()
            });
          }
        }, 500);
      } else {
        // Sprawdź czy gra się zakończyła z powodu zbyt małej liczby graczy
        if (game.gameEnded && game.players.size < 3) {
          io.to(gameCode).emit('gameEnded', {
            reason: 'notEnoughPlayers',
            gameState: game.getGameState()
          });
        } else {
          // Zwykłe powiadomienie o opuszczeniu gracza
          io.to(gameCode).emit('playerLeft', {
            playerId: socket.id,
            gameState: game.getGameState()
          });
        }
      }
      
      console.log(`Gracz wyszedł: ${socket.id} z gry ${gameCode}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});

