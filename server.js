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
  { word: "KRZESŁO", hint: "Do siedzenia" }
];

// Przechowywanie gier
const games = new Map();

class Game {
  constructor(code, hostId, rounds, roundTime) {
    this.code = code;
    this.hostId = hostId;
    this.rounds = parseInt(rounds);
    this.roundTime = parseInt(roundTime);
    this.players = new Map();
    this.currentRound = 0;
    this.isPlaying = false;
    this.isVoting = false;
    this.isDeciding = false;
    this.impostorId = null;
    this.associations = new Map();
    this.votes = new Map();
    this.voteResults = new Map();
    this.decisions = new Map();
    this.roundStartTime = null;
    this.timer = null;
    
    // Losuj pierwsze hasło
    this.currentWordPair = this.getRandomWordPair();
    this.word = this.currentWordPair.word;
    this.hint = this.currentWordPair.hint;
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
      hasDecided: false
    });
    
    if (this.players.size === 2 && !this.isPlaying) {
      const nonHostPlayers = Array.from(this.players.values())
        .filter(p => !p.isHost);
      if (nonHostPlayers.length > 0) {
        this.impostorId = nonHostPlayers[0].id;
        this.players.get(this.impostorId).isImpostor = true;
      }
    }
    
    return this.players.get(playerId);
  }

  removePlayer(playerId) {
    const wasImpostor = this.players.get(playerId)?.isImpostor;
    this.players.delete(playerId);
    
    if (wasImpostor && this.players.size > 1 && this.isPlaying) {
      const nonHostPlayers = Array.from(this.players.values())
        .filter(p => !p.isHost && p.id !== this.hostId);
      if (nonHostPlayers.length > 0) {
        this.impostorId = nonHostPlayers[0].id;
        this.players.get(this.impostorId).isImpostor = true;
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
    
    const nonHostPlayers = Array.from(this.players.values())
      .filter(p => !p.isHost);
    
    if (nonHostPlayers.length > 0) {
      const randomIndex = Math.floor(Math.random() * nonHostPlayers.length);
      this.impostorId = nonHostPlayers[randomIndex].id;
      this.players.get(this.impostorId).isImpostor = true;
    }
    
    for (const player of this.players.values()) {
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
    }
    
    this.associations.clear();
    this.votes.clear();
    this.voteResults.clear();
    this.decisions.clear();
    
    this.currentWordPair = this.getRandomWordPair();
    this.word = this.currentWordPair.word;
    this.hint = this.currentWordPair.hint;
    
    return this.getGameState();
  }

  submitAssociation(playerId, association) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    player.association = association;
    player.hasSubmitted = true;
    this.associations.set(playerId, association);
    
    const allSubmitted = Array.from(this.players.values())
      .filter(p => !p.isHost)
      .every(p => p.hasSubmitted);
    
    return allSubmitted;
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
    let votedOutId = null;
    
    for (const [playerId, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        votedOutId = playerId;
      }
    }
    
    this.voteResults = voteCounts;
    
    const impostorDetected = votedOutId === this.impostorId;
    
    if (impostorDetected) {
      for (const player of this.players.values()) {
        if (!player.isImpostor && !player.isHost) {
          player.score += 10;
        }
      }
    } else {
      if (this.players.has(this.impostorId)) {
        this.players.get(this.impostorId).score += 20;
      }
    }
    
    return {
      votedOutId,
      impostorDetected,
      voteCounts: Array.from(voteCounts.entries())
    };
  }

  nextRound() {
    this.currentRound++;
    this.isVoting = false;
    this.isDeciding = false;
    
    for (const player of this.players.values()) {
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
    }
    
    this.associations.clear();
    this.votes.clear();
    this.voteResults.clear();
    this.decisions.clear();
    
    this.currentWordPair = this.getRandomWordPair();
    this.word = this.currentWordPair.word;
    this.hint = this.currentWordPair.hint;
    
    return this.getGameState();
  }

  getGameState(playerId = null) {
    const associationsWithNames = Array.from(this.associations.entries()).map(([id, association]) => {
      const player = this.players.get(id);
      return {
        playerId: id,
        playerName: player ? player.name : 'Nieznany',
        association: association,
        isImpostor: player ? player.isImpostor : false
      };
    });

    const state = {
      code: this.code,
      word: this.word,
      hint: this.hint,
      rounds: this.rounds,
      roundTime: this.roundTime,
      currentRound: this.currentRound,
      isPlaying: this.isPlaying,
      isVoting: this.isVoting,
      isDeciding: this.isDeciding,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isImpostor: p.isImpostor && this.isPlaying,
        isHost: p.isHost,
        hasSubmitted: p.hasSubmitted,
        hasDecided: p.hasDecided,
        association: this.isVoting || this.isDeciding ? p.association : ''
      })),
      associations: associationsWithNames,
      votes: Array.from(this.votes.entries()),
      voteResults: Array.from(this.voteResults.entries()),
      decisions: Array.from(this.decisions.entries()),
      impostorId: this.impostorId
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
    const { playerName, rounds, roundTime } = data;
    
    let code;
    do {
      code = generateGameCode();
    } while (games.has(code));
    
    const game = new Game(code, socket.id, rounds, roundTime);
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
    
    const allSubmitted = game.submitAssociation(socket.id, association);
    
    io.to(gameCode).emit('associationSubmitted', {
      playerId: socket.id,
      gameState: game.getGameState()
    });
    
    if (allSubmitted) {
      setTimeout(() => {
        game.startDecisionPhase();
        io.to(gameCode).emit('decisionPhaseStarted', {
          gameState: game.getGameState()
        });
      }, 1000);
    }
  });
  
  socket.on('submitDecision', (data) => {
    const { decision } = data;
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
          game.startVoting();
          io.to(gameCode).emit('votingStarted', {
            decisionResult,
            gameState: game.getGameState()
          });
        } else {
          game.nextRound();
          io.to(gameCode).emit('nextRoundStarted', {
            decisionResult,
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
    
    for (const player of game.players.values()) {
      player.score = 0;
      player.isImpostor = false;
      player.hasSubmitted = false;
      player.association = '';
      player.hasDecided = false;
    }
    
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
