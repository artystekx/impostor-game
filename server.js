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
  constructor(code, hostId, rounds, roundTime, numImpostors, gameMode) {
    this.code = code;
    this.hostId = hostId;
    this.rounds = parseInt(rounds);
    this.roundTime = parseInt(roundTime);
    this.numImpostors = parseInt(numImpostors) || 1;
    this.gameMode = gameMode || 'simultaneous'; // 'simultaneous' lub 'sequential'
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
    this.guesses = new Map(); // Nowe: zgadywanie hasła przez impostorów
    this.roundStartTime = null;
    this.timer = null;
    this.currentTurnIndex = 0; // Dla trybu sequential
    this.turnOrder = []; // Dla trybu sequential
    this.turnTimer = null;
    
    // Losuj pierwsze hasło
    this.currentWordPair = this.getRandomWordPair();
    this.word = this.currentWordPair.word;
    this.hint = this.currentWordPair.hint;
    this.wordGuessed = false; // Czy impostor odgadł hasło
  }

  getRandomWordPair() {
    const randomIndex = Math.floor(Math.random() * wordPairs.length);
    return wordPairs[randomIndex];
  }

  addPlayer(playerId, name) {
    this.players.set(playerId, {
      id: playerId,
      name: name,
      score: 0,
      isImpostor: false,
      isHost: playerId === this.hostId,
      hasSubmitted: false,
      association: '',
      hasDecided: false,
      hasGuessed: false,
      guess: '',
      turnCompleted: false // Dla trybu sequential
    });
    
    // Tymczasowo ustaw impostora (będzie zmienione przy starcie gry)
    if (this.players.size === 2 && !this.isPlaying && this.numImpostors > 0) {
      const nonHostPlayers = Array.from(this.players.values()).filter(p => !p.isHost);
      if (nonHostPlayers.length > 0) {
        this.impostorIds = [nonHostPlayers[0].id];
        this.players.get(nonHostPlayers[0].id).isImpostor = true;
      }
    }
    
    return this.players.get(playerId);
  }

  removePlayer(playerId) {
    const wasImpostor = this.players.get(playerId)?.isImpostor;
    this.players.delete(playerId);
    
    // Usuń z listy impostorów jeśli był impostorem
    this.impostorIds = this.impostorIds.filter(id => id !== playerId);
    
    // Jeśli impostor wyszedł i mamy za mało impostorów, dodaj nowego
    if (wasImpostor && this.players.size > this.numImpostors && this.isPlaying) {
      const nonHostPlayers = Array.from(this.players.values())
        .filter(p => !p.isHost && !this.impostorIds.includes(p.id));
      if (nonHostPlayers.length > 0) {
        const newImpostor = nonHostPlayers[0];
        this.impostorIds.push(newImpostor.id);
        this.players.get(newImpostor.id).isImpostor = true;
      }
    }
    
    if (playerId === this.hostId) {
      return true;
    }
    
    return false;
  }

  startGame() {
    this.isPlaying = true;
    this.currentRound = 1;
    this.wordGuessed = false;
    
    // Wybierz impostorów
    this.impostorIds = [];
    const nonHostPlayers = Array.from(this.players.values()).filter(p => !p.isHost);
    
    if (nonHostPlayers.length >= this.numImpostors) {
      // Losowo wybierz impostorów
      const shuffled = [...nonHostPlayers].sort(() => 0.5 - Math.random());
      for (let i = 0; i < this.numImpostors && i < shuffled.length; i++) {
        this.impostorIds.push(shuffled[i].id);
        this.players.get(shuffled[i].id).isImpostor = true;
      }
    }
    
    // Reset stanu graczy
    for (const player of this.players.values()) {
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
      player.hasGuessed = false;
      player.guess = '';
      player.turnCompleted = false;
    }
    
    this.associations.clear();
    this.votes.clear();
    this.voteResults.clear();
    this.decisions.clear();
    this.guesses.clear();
    
    // Losuj nowe hasło na start gry
    this.currentWordPair = this.getRandomWordPair();
    this.word = this.currentWordPair.word;
    this.hint = this.currentWordPair.hint;
    
    // Przygotuj kolejkę dla trybu sequential
    if (this.gameMode === 'sequential') {
      this.prepareTurnOrder();
    }
    
    return this.getGameState();
  }

  prepareTurnOrder() {
    const nonHostPlayers = Array.from(this.players.values()).filter(p => !p.isHost);
    this.turnOrder = [...nonHostPlayers].sort(() => 0.5 - Math.random()).map(p => p.id);
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
    
    // Sprawdź czy wszyscy skończyli
    if (this.currentTurnIndex >= this.turnOrder.length) {
      return false; // Koniec tury
    }
    
    return this.getCurrentTurnPlayerId();
  }

  submitAssociation(playerId, association) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    player.association = association;
    player.hasSubmitted = true;
    this.associations.set(playerId, association);
    
    if (this.gameMode === 'sequential') {
      // W trybie sequential sprawdzamy czy wszyscy skończyli
      const allCompleted = Array.from(this.players.values())
        .filter(p => !p.isHost)
        .every(p => p.turnCompleted);
      
      return allCompleted;
    } else {
      // W trybie simultaneous sprawdzamy czy wszyscy wysłali
      const allSubmitted = Array.from(this.players.values())
        .filter(p => !p.isHost)
        .every(p => p.hasSubmitted);
      
      return allSubmitted;
    }
  }

  submitGuess(playerId, guess) {
    const player = this.players.get(playerId);
    if (!player || !player.isImpostor) return false;
    
    player.hasGuessed = true;
    player.guess = guess;
    this.guesses.set(playerId, guess);
    
    // Sprawdź czy impostor odgadł hasło
    const guessedCorrectly = guess.trim().toLowerCase() === this.word.toLowerCase();
    
    if (guessedCorrectly) {
      this.wordGuessed = true;
      return {
        correct: true,
        guesserId: playerId,
        guesserName: player.name
      };
    }
    
    return {
      correct: false,
      guesserId: playerId,
      guesserName: player.name
    };
  }

  startDecisionPhase() {
    this.isDeciding = true;
    this.isVoting = false;
    this.decisions.clear();
    
    for (const player of this.players.values()) {
      player.hasDecided = false;
    }
    
    return this.getGameState();
  }

  submitDecision(playerId, decision) {
    const player = this.players.get(playerId);
    if (!player || !this.isDeciding) return false;
    
    player.hasDecided = true;
    this.decisions.set(playerId, decision);
    
    const allDecided = Array.from(this.players.values())
      .filter(p => !p.isHost)
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
    
    const majorityWantsVote = voteCount > continueCount;
    
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
    
    return this.getGameState();
  }

  submitVote(voterId, votedPlayerId) {
    this.votes.set(voterId, votedPlayerId);
    
    const allVoted = Array.from(this.players.values())
      .filter(p => !p.isHost)
      .every(p => this.votes.has(p.id));
    
    if (allVoted) {
      return this.calculateVoteResults();
    }
    
    return null;
  }

  calculateVoteResults() {
    const voteCounts = new Map();
    for (const votedId of this.votes.values()) {
      voteCounts.set(votedId, (voteCounts.get(votedId) || 0) + 1);
    }
    
    let maxVotes = 0;
    let votedOutIds = [];
    
    for (const [playerId, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        votedOutIds = [playerId];
      } else if (count === maxVotes && maxVotes > 0) {
        votedOutIds.push(playerId);
      }
    }
    
    this.voteResults = voteCounts;
    
    // Sprawdź ilu impostorów zostało wykrytych
    let impostorsDetected = 0;
    for (const votedOutId of votedOutIds) {
      if (this.impostorIds.includes(votedOutId)) {
        impostorsDetected++;
      }
    }
    
    // Aktualizuj wyniki
    if (impostorsDetected > 0) {
      // Gracze wygrywają - dostają punkty za każdego wykrytego impostora
      for (const player of this.players.values()) {
        if (!player.isImpostor && !player.isHost) {
          player.score += 10 * impostorsDetected;
        }
      }
    } else if (votedOutIds.length > 0) {
      // Impostorzy wygrywają - dostają punkty za każdego niewykrytego impostora
      for (const impostorId of this.impostorIds) {
        if (this.players.has(impostorId)) {
          this.players.get(impostorId).score += 20;
        }
      }
    }
    
    return {
      votedOutIds,
      impostorsDetected,
      voteCounts: Array.from(voteCounts.entries())
    };
  }

  nextRound(keepSameWord = false) {
    this.currentRound++;
    this.isVoting = false;
    this.isDeciding = false;
    this.wordGuessed = false;
    
    for (const player of this.players.values()) {
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
      player.hasGuessed = false;
      player.guess = '';
      player.turnCompleted = false;
    }
    
    this.associations.clear();
    this.votes.clear();
    this.voteResults.clear();
    this.decisions.clear();
    this.guesses.clear();
    
    // Przygotuj kolejkę dla trybu sequential
    if (this.gameMode === 'sequential') {
      this.prepareTurnOrder();
    }
    
    // Losuj nowe hasło tylko jeśli nie wybrano zachowania tego samego
    if (!keepSameWord) {
      this.currentWordPair = this.getRandomWordPair();
      this.word = this.currentWordPair.word;
      this.hint = this.currentWordPair.hint;
    }
    
    return this.getGameState();
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
      numImpostors: this.numImpostors,
      gameMode: this.gameMode,
      currentRound: this.currentRound,
      isPlaying: this.isPlaying,
      isVoting: this.isVoting,
      isDeciding: this.isDeciding,
      wordGuessed: this.wordGuessed,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isImpostor: p.isImpostor && this.isPlaying,
        isHost: p.isHost,
        hasSubmitted: p.hasSubmitted,
        hasDecided: p.hasDecided,
        hasGuessed: p.hasGuessed,
        turnCompleted: p.turnCompleted,
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
      turnOrder: this.gameMode === 'sequential' ? this.turnOrder : []
    };
    
    if (playerId) {
      const player = this.players.get(playerId);
      if (player) {
        if (player.isImpostor && this.isPlaying) {
          state.playerWord = this.hint;
          state.isImpostor = true;
        } else {
          state.playerWord = this.word;
          state.isImpostor = false;
        }
        
        state.player = {
          id: player.id,
          name: player.name,
          score: player.score,
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
    const { playerName, rounds, roundTime, numImpostors, gameMode } = data;
    
    let code;
    do {
      code = generateGameCode();
    } while (games.has(code));
    
    const game = new Game(code, socket.id, rounds, roundTime, numImpostors, gameMode);
    games.set(code, game);
    
    game.addPlayer(socket.id, playerName || 'Host');
    
    socket.join(code);
    socket.gameCode = code;
    
    socket.emit('gameCreated', { 
      code,
      gameState: game.getGameState(socket.id)
    });
    
    console.log(`Gra utworzona: ${code} przez ${socket.id}`);
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
    
    if (!game.isPlaying || game.isVoting || game.isDeciding) return;
    
    // Sprawdź czy w trybie sequential to jest kolej gracza
    if (game.gameMode === 'sequential') {
      const currentTurnPlayerId = game.getCurrentTurnPlayerId();
      if (currentTurnPlayerId !== socket.id) {
        socket.emit('error', { message: 'Nie twoja kolej!' });
        return;
      }
    }
    
    const allSubmitted = game.submitAssociation(socket.id, association);
    
    io.to(gameCode).emit('associationSubmitted', {
      playerId: socket.id,
      gameState: game.getGameState()
    });
    
    // W trybie sequential przejdź do następnego gracza
    if (game.gameMode === 'sequential') {
      const nextPlayerId = game.nextTurn();
      if (nextPlayerId) {
        // Jest następny gracz
        io.to(gameCode).emit('nextTurn', {
          nextPlayerId: nextPlayerId,
          gameState: game.getGameState()
        });
      } else {
        // Wszyscy skończyli - przejdź do fazy decyzji
        setTimeout(() => {
          game.startDecisionPhase();
          io.to(gameCode).emit('decisionPhaseStarted', {
            gameState: game.getGameState()
          });
        }, 1000);
      }
    } else if (allSubmitted) {
      // W trybie simultaneous wszyscy wysłali - przejdź do fazy decyzji
      setTimeout(() => {
        game.startDecisionPhase();
        io.to(gameCode).emit('decisionPhaseStarted', {
          gameState: game.getGameState()
        });
      }, 1000);
    }
  });
  
  socket.on('submitGuess', (data) => {
    const { guess } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying) return;
    
    const result = game.submitGuess(socket.id, guess);
    
    if (result.correct) {
      // Impostor odgadł hasło - kończy grę
      game.wordGuessed = true;
      
      // Przyznaj punkty impostorom
      for (const impostorId of game.impostorIds) {
        if (game.players.has(impostorId)) {
          game.players.get(impostorId).score += 30;
        }
      }
      
      io.to(gameCode).emit('wordGuessed', {
        guesserId: result.guesserId,
        guesserName: result.guesserName,
        word: game.word,
        gameState: game.getGameState()
      });
      
      // Jeśli to tryb sequential, gra kończy się natychmiast
      if (game.gameMode === 'sequential') {
        setTimeout(() => {
          io.to(gameCode).emit('gameEnded', {
            reason: 'wordGuessed',
            gameState: game.getGameState()
          });
        }, 3000);
      }
    } else {
      // Nieprawidłowe zgadywanie
      socket.emit('guessResult', { correct: false });
    }
  });
  
  socket.on('submitDecision', (data) => {
    const { decision, keepSameWord } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || !game.isDeciding) return;
    
    const decisionResult = game.submitDecision(socket.id, decision);
    
    io.to(gameCode).emit('decisionSubmitted', {
      playerId: socket.id,
      gameState: game.getGameState()
    });
    
    if (decisionResult) {
      setTimeout(() => {
        if (decisionResult.majorityWantsVote) {
          // Większość chce głosować - przejdź do głosowania
          game.startVoting();
          io.to(gameCode).emit('votingStarted', {
            decisionResult,
            gameState: game.getGameState()
          });
        } else {
          // Większość chce grać dalej - następna runda
          game.nextRound(keepSameWord);
          io.to(gameCode).emit('nextRoundStarted', {
            decisionResult,
            keepSameWord,
            gameState: game.getGameState()
          });
        }
      }, 1000);
    }
  });
  
  socket.on('submitVote', (data) => {
    const { votedPlayerId } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || !game.isVoting) return;
    
    const voteResults = game.submitVote(socket.id, votedPlayerId);
    
    io.to(gameCode).emit('voteSubmitted', {
      voterId: socket.id,
      gameState: game.getGameState()
    });
    
    if (voteResults) {
      setTimeout(() => {
        io.to(gameCode).emit('voteResults', {
          results: voteResults,
          gameState: game.getGameState()
        });
      }, 1000);
    }
  });
  
  socket.on('nextRound', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (socket.id !== game.hostId) return;
    
    if (!game.isPlaying || game.currentRound >= game.rounds) {
      io.to(gameCode).emit('gameEnded', {
        gameState: game.getGameState()
      });
      
      setTimeout(() => {
        games.delete(gameCode);
      }, 60000);
      
      return;
    }
    
    game.nextRound();
    
    io.to(gameCode).emit('nextRoundStarted', {
      gameState: game.getGameState()
    });
  });
  
  socket.on('restartGame', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (socket.id !== game.hostId) return;
    
    game.currentRound = 0;
    game.isPlaying = false;
    game.isVoting = false;
    game.isDeciding = false;
    game.wordGuessed = false;
    
    for (const player of game.players.values()) {
      player.score = 0;
      player.isImpostor = false;
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
      player.hasGuessed = false;
      player.guess = '';
      player.turnCompleted = false;
    }
    
    game.impostorIds = [];
    game.currentWordPair = game.getRandomWordPair();
    game.word = game.currentWordPair.word;
    game.hint = game.currentWordPair.hint;
    
    io.to(gameCode).emit('gameRestarted', {
      gameState: game.getGameState()
    });
  });
  
  socket.on('disconnect', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) {
      console.log('Rozłączono:', socket.id);
      return;
    }
    
    const game = games.get(gameCode);
    
    const gameEnded = game.removePlayer(socket.id);
    
    if (gameEnded) {
      io.to(gameCode).emit('hostDisconnected');
      games.delete(gameCode);
      console.log(`Gra zakończona: ${gameCode} (host wyszedł)`);
    } else if (game.players.size === 0) {
      games.delete(gameCode);
      console.log(`Gra usunięta: ${gameCode} (brak graczy)`);
    } else {
      io.to(gameCode).emit('playerLeft', {
        playerId: socket.id,
        gameState: game.getGameState()
      });
      console.log(`Gracz wyszedł: ${socket.id} z gry ${gameCode}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
