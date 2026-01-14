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
  constructor(code, hostId, rounds, roundTime, numImpostors, gameMode, customWordData = null) {
    this.code = code;
    this.hostId = hostId;
    this.rounds = parseInt(rounds);
    this.roundTime = parseInt(roundTime);
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
      turnCompleted: false
    });
    
    return this.players.get(playerId);
  }

  removePlayer(playerId) {
    const wasImpostor = this.players.get(playerId)?.isImpostor;
    this.players.delete(playerId);
    
    this.impostorIds = this.impostorIds.filter(id => id !== playerId);
    
    if (playerId === this.hostId) {
      return true;
    }
    
    return false;
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
    
    // Jeśli nie ma custom słowa, losuj nowe
    if (!this.customWordData) {
      this.currentWordPair = this.getRandomWordPair();
      this.word = this.currentWordPair.word;
      this.hint = this.currentWordPair.hint;
    }
    
    if (this.gameMode === 'sequential') {
      this.prepareTurnOrder();
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
    
    if (this.currentTurnIndex >= this.turnOrder.length) {
      return false;
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
      const allCompleted = Array.from(this.players.values())
        .every(p => p.turnCompleted);
      
      return allCompleted;
    } else {
      const allSubmitted = Array.from(this.players.values())
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
    
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
    }
    
    this.votingTimeout = setTimeout(() => {
      if (this.isVoting && this.isPlaying) {
        console.log(`Game ${this.code}: Voting timeout - forcing vote calculation`);
        const voteResults = this.calculateVoteResults();
        this.handleVoteResults(voteResults);
      }
    }, 30000);
    
    return this.getGameState();
  }

  submitVote(voterId, votedPlayerId) {
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
    
    return {
      votedOutIds,
      voteCounts: Array.from(voteCounts.entries()),
      maxVotes
    };
  }

  handleVoteResults(voteResults) {
    const someoneVotedOut = voteResults.votedOutIds.length > 0 && voteResults.maxVotes > 0;
    
    if (someoneVotedOut) {
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
        return {
          type: 'innocentVotedOut',
          votedOutId,
          wasImpostor: false,
          impostorsRemaining: this.impostorIds.length
        };
      }
    } else {
      return {
        type: 'noOneVotedOut',
        impostorsRemaining: this.impostorIds.length
      };
    }
  }

  nextRound(keepSameWord = true) {
    this.currentRound++;
    this.isVoting = false;
    this.isDeciding = false;
    this.wordGuessed = false;
    this.guessFailed = false;
    
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
    
    if (this.gameMode === 'sequential') {
      this.prepareTurnOrder();
    }
    
    if (this.votingTimeout) {
      clearTimeout(this.votingTimeout);
      this.votingTimeout = null;
    }
    
    return this.getGameState();
  }

  addChatMessage(playerId, message) {
    const player = this.players.get(playerId);
    if (!player) return null;
    
    const chatMessage = {
      id: Date.now(),
      playerId: playerId,
      playerName: player.name,
      message: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      round: this.currentRound
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
        // KLUCZOWA POPRAWKA: impostor widzi podpowiedź, nie hasło
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
    const { playerName, rounds, roundTime, numImpostors, gameMode, customWordData } = data;
    
    let code;
    do {
      code = generateGameCode();
    } while (games.has(code));
    
    const game = new Game(code, socket.id, rounds, roundTime, numImpostors, gameMode, customWordData);
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
    
    if (!game.isPlaying || game.isVoting || game.isDeciding || game.wordGuessed || game.guessFailed) return;
    
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
    
    if (game.gameMode === 'sequential') {
      const nextPlayerId = game.nextTurn();
      if (nextPlayerId) {
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
        }, 1000);
      }
    } else if (allSubmitted) {
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
    
    if (!game.isPlaying || game.wordGuessed || game.guessFailed) return;
    
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
      }, 1000);
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
        
        io.to(gameCode).emit('voteResults', {
          results: voteResults,
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
      }, 1000);
    }
  });
  
  socket.on('nextRound', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (socket.id !== game.hostId) return;
    
    if (game.gameEnded || game.currentRound >= game.rounds) {
      io.to(gameCode).emit('gameEnded', {
        gameState: game.getGameState()
      });
      
      setTimeout(() => {
        games.delete(gameCode);
      }, 60000);
      
      return;
    }
    
    if (game.impostorIds.length === 0) {
      io.to(gameCode).emit('gameEnded', {
        reason: 'allImpostorsFound',
        gameState: game.getGameState()
      });
      return;
    }
    
    game.nextRound(true);
    
    io.to(gameCode).emit('nextRoundStarted', {
      gameState: game.getGameState()
    });
  });
  
  socket.on('restartGame', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (socket.id !== game.hostId) return;
    
    // Usuń starą grę
    games.delete(gameCode);
    
    // Przeładuj stronę dla wszystkich graczy
    io.to(gameCode).emit('forceReload');
    
    console.log(`Gra zrestartowana: ${gameCode}`);
  });
  
  socket.on('sendChatMessage', (data) => {
    const { message } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying) return;
    
    const chatMessage = game.addChatMessage(socket.id, message);
    
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
