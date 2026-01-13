const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serwowanie plików statycznych z folderu public
app.use(express.static(path.join(__dirname, 'public')));

// Przykładowe hasła i podpowiedzi
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
  { word: "ZAMEK", hint: "Budowla" }
];

// Przechowywanie gier
const games = new Map();

class Game {
  constructor(code, hostId, word, hint, rounds, roundTime) {
    this.code = code;
    this.hostId = hostId;
    this.word = word;
    this.hint = hint;
    this.rounds = parseInt(rounds);
    this.roundTime = parseInt(roundTime);
    this.players = new Map();
    this.currentRound = 0;
    this.isPlaying = false;
    this.isVoting = false;
    this.impostorId = null;
    this.associations = new Map();
    this.votes = new Map();
    this.voteResults = new Map();
    this.roundStartTime = null;
    this.timer = null;
  }

  addPlayer(playerId, name) {
    this.players.set(playerId, {
      id: playerId,
      name: name,
      score: 0,
      isImpostor: false,
      isHost: playerId === this.hostId,
      hasSubmitted: false,
      association: ''
    });
    
    // Jeśli to pierwszy gracz (nie host), ustaw jako impostora na razie
    // Później zostanie wylosowany nowy impostor przy starcie gry
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
    
    // Jeśli impostor wyszedł, wybierz nowego
    if (wasImpostor && this.players.size > 1 && this.isPlaying) {
      const nonHostPlayers = Array.from(this.players.values())
        .filter(p => !p.isHost && p.id !== this.hostId);
      if (nonHostPlayers.length > 0) {
        this.impostorId = nonHostPlayers[0].id;
        this.players.get(this.impostorId).isImpostor = true;
      }
    }
    
    // Jeśli host wyszedł, zakończ grę
    if (playerId === this.hostId) {
      return true; // Koniec gry
    }
    
    return false;
  }

  startGame() {
    this.isPlaying = true;
    this.currentRound = 1;
    
    // Losowanie impostora (ktoś inny niż host)
    const nonHostPlayers = Array.from(this.players.values())
      .filter(p => !p.isHost);
    
    if (nonHostPlayers.length > 0) {
      const randomIndex = Math.floor(Math.random() * nonHostPlayers.length);
      this.impostorId = nonHostPlayers[randomIndex].id;
      this.players.get(this.impostorId).isImpostor = true;
    }
    
    // Reset stanu graczy
    for (const player of this.players.values()) {
      player.hasSubmitted = false;
      player.association = '';
    }
    
    this.associations.clear();
    this.votes.clear();
    this.voteResults.clear();
    
    return this.getGameState();
  }

  submitAssociation(playerId, association) {
    const player = this.players.get(playerId);
    if (!player) return false;
    
    player.association = association;
    player.hasSubmitted = true;
    this.associations.set(playerId, association);
    
    // Sprawdź czy wszyscy już wysłali
    const allSubmitted = Array.from(this.players.values())
      .filter(p => !p.isHost)
      .every(p => p.hasSubmitted);
    
    return allSubmitted;
  }

  startVoting() {
    this.isVoting = true;
    this.votes.clear();
    
    return this.getGameState();
  }

  submitVote(voterId, votedPlayerId) {
    this.votes.set(voterId, votedPlayerId);
    
    // Sprawdź czy wszyscy już zagłosowali
    const allVoted = Array.from(this.players.values())
      .filter(p => !p.isHost)
      .every(p => this.votes.has(p.id));
    
    if (allVoted) {
      return this.calculateVoteResults();
    }
    
    return null;
  }

  calculateVoteResults() {
    // Zlicz głosy
    const voteCounts = new Map();
    for (const votedId of this.votes.values()) {
      voteCounts.set(votedId, (voteCounts.get(votedId) || 0) + 1);
    }
    
    // Znajdź najwięcej głosów
    let maxVotes = 0;
    let votedOutId = null;
    
    for (const [playerId, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        votedOutId = playerId;
      }
    }
    
    this.voteResults = voteCounts;
    
    // Sprawdź czy impostor został wykryty
    const impostorDetected = votedOutId === this.impostorId;
    
    // Aktualizuj wyniki
    if (impostorDetected) {
      // Gracze wygrywają (oprócz impostora)
      for (const player of this.players.values()) {
        if (!player.isImpostor && !player.isHost) {
          player.score += 10;
        }
      }
    } else {
      // Impostor wygrywa
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
    
    // Reset stanu dla nowej rundy
    for (const player of this.players.values()) {
      player.hasSubmitted = false;
      player.association = '';
    }
    
    this.associations.clear();
    this.votes.clear();
    this.voteResults.clear();
    
    // Losuj nowe hasło i podpowiedź
    const randomIndex = Math.floor(Math.random() * wordPairs.length);
    this.word = wordPairs[randomIndex].word;
    this.hint = wordPairs[randomIndex].hint;
    
    return this.getGameState();
  }

  getGameState(playerId = null) {
    const state = {
      code: this.code,
      word: this.word,
      hint: this.hint,
      rounds: this.rounds,
      roundTime: this.roundTime,
      currentRound: this.currentRound,
      isPlaying: this.isPlaying,
      isVoting: this.isVoting,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isImpostor: p.isImpostor && this.isPlaying, // Pokazuj tylko podczas gry
        isHost: p.isHost,
        hasSubmitted: p.hasSubmitted,
        association: this.isVoting ? p.association : '' // Pokazuj tylko podczas głosowania
      })),
      associations: this.isVoting ? Array.from(this.associations.entries()) : [],
      votes: Array.from(this.votes.entries()),
      voteResults: Array.from(this.voteResults.entries()),
      impostorId: this.impostorId
    };
    
    // Jeśli podano playerId, dostosuj widok dla tego gracza
    if (playerId) {
      const player = this.players.get(playerId);
      if (player) {
        // Jeśli gracz jest impostorem, pokaż mu podpowiedź zamiast hasła
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

// Generowanie kodu gry
function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Socket.io połączenia
io.on('connection', (socket) => {
  console.log('Nowe połączenie:', socket.id);
  
  socket.on('createGame', (data) => {
    const { playerName, word, hint, rounds, roundTime } = data;
    
    // Generuj unikalny kod gry
    let code;
    do {
      code = generateGameCode();
    } while (games.has(code));
    
    // Utwórz nową grę
    const game = new Game(code, socket.id, word, hint, rounds, roundTime);
    games.set(code, game);
    
    // Dodaj hosta jako gracza
    game.addPlayer(socket.id, playerName || 'Host');
    
    // Dołącz socket do pokoju
    socket.join(code);
    socket.gameCode = code;
    
    // Wyślij kod gry do hosta
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
    
    // Dodaj gracza do gry
    const player = game.addPlayer(socket.id, playerName);
    
    // Dołącz socket do pokoju
    socket.join(code);
    socket.gameCode = code;
    
    // Wyślij potwierdzenie dołączania
    socket.emit('gameJoined', { 
      gameState: game.getGameState(socket.id)
    });
    
    // Powiadom wszystkich w pokoju o nowym graczu
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
    
    // Sprawdź czy to host
    if (socket.id !== game.hostId) return;
    
    // Sprawdź czy jest wystarczająco graczy (min. 3 włącznie z hostem)
    if (game.players.size < 3) {
      socket.emit('error', { message: 'Potrzeba co najmniej 3 graczy aby rozpocząć grę' });
      return;
    }
    
    // Rozpocznij grę
    game.startGame();
    
    // Powiadom wszystkich w pokoju
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
    
    if (!game.isPlaying || game.isVoting) return;
    
    // Zapisz skojarzenie
    const allSubmitted = game.submitAssociation(socket.id, association);
    
    // Powiadom wszystkich o zaktualizowanym stanie
    io.to(gameCode).emit('associationSubmitted', {
      playerId: socket.id,
      gameState: game.getGameState()
    });
    
    // Jeśli wszyscy już wysłali, rozpocznij głosowanie
    if (allSubmitted) {
      setTimeout(() => {
        game.startVoting();
        io.to(gameCode).emit('votingStarted', {
          gameState: game.getGameState()
        });
      }, 1000);
    }
  });
  
  socket.on('submitVote', (data) => {
    const { votedPlayerId } = data;
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    if (!game.isPlaying || !game.isVoting) return;
    
    // Zapisz głos
    const voteResults = game.submitVote(socket.id, votedPlayerId);
    
    // Powiadom wszystkich o zaktualizowanym stanie
    io.to(gameCode).emit('voteSubmitted', {
      voterId: socket.id,
      gameState: game.getGameState()
    });
    
    // Jeśli wszyscy już zagłosowali, pokaż wyniki
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
    
    // Sprawdź czy to host
    if (socket.id !== game.hostId) return;
    
    // Sprawdź czy można przejść do następnej rundy
    if (!game.isPlaying || game.currentRound >= game.rounds) {
      // Koniec gry
      io.to(gameCode).emit('gameEnded', {
        gameState: game.getGameState()
      });
      
      // Usuń grę po chwili
      setTimeout(() => {
        games.delete(gameCode);
      }, 60000); // 1 minuta
      
      return;
    }
    
    // Przejdź do następnej rundy
    game.nextRound();
    
    // Powiadom wszystkich w pokoju
    io.to(gameCode).emit('nextRoundStarted', {
      gameState: game.getGameState()
    });
  });
  
  socket.on('restartGame', () => {
    const gameCode = socket.gameCode;
    if (!gameCode || !games.has(gameCode)) return;
    
    const game = games.get(gameCode);
    
    // Sprawdź czy to host
    if (socket.id !== game.hostId) return;
    
    // Restart gry
    game.currentRound = 0;
    game.isPlaying = false;
    game.isVoting = false;
    
    // Zresetuj wyniki graczy
    for (const player of game.players.values()) {
      player.score = 0;
      player.isImpostor = false;
      player.hasSubmitted = false;
      player.association = '';
    }
    
    // Losuj nowe hasło
    const randomIndex = Math.floor(Math.random() * wordPairs.length);
    game.word = wordPairs[randomIndex].word;
    game.hint = wordPairs[randomIndex].hint;
    
    // Powiadom wszystkich
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
    
    // Usuń gracza z gry
    const gameEnded = game.removePlayer(socket.id);
    
    if (gameEnded) {
      // Host wyszedł - zakończ grę
      io.to(gameCode).emit('hostDisconnected');
      games.delete(gameCode);
      console.log(`Gra zakończona: ${gameCode} (host wyszedł)`);
    } else if (game.players.size === 0) {
      // Wszyscy wyszli - usuń grę
      games.delete(gameCode);
      console.log(`Gra usunięta: ${gameCode} (brak graczy)`);
    } else {
      // Powiadom pozostałych graczy
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