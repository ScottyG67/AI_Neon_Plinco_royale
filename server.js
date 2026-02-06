const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createServer: createViteServer } = require('vite');

async function startServer() {
    console.log('[Server] Starting initialization...');

    const app = express();
    app.enable('trust proxy');

    // 1. Initialize Vite Middleware first
    console.log('[Server] Initializing Vite middleware...');
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: __dirname,
    });

    // 2. Create HTTP Server with Express app
    console.log('[Server] Creating HTTP server...');
    const server = http.createServer(app);

    // 3. Initialize Socket.IO
    // Attach it to the server - Socket.IO will handle /socket.io/* routes automatically
    console.log('[Server] Initializing Socket.IO...');
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        transports: ['polling', 'websocket']
        // path defaults to '/socket.io' which matches the client
    });

    // --- GAME STATE ---
    let players = [];
    let gamePhase = 'LOBBY';
    // Track which players have dropped their ball this round
    const droppedBalls = new Set();

    // --- SOCKET LOGIC ---
    io.on('connection', (socket) => {
        console.log('[Socket] User connected:', socket.id);
        socket.emit('state_update', { players, phase: gamePhase });

        socket.on('join_game', (newPlayer) => {
            if (players.some(p => p.name.toLowerCase() === newPlayer.name.toLowerCase())) {
                socket.emit('error_message', 'Name already taken');
                return;
            }
            const player = { ...newPlayer, id: socket.id };
            players.push(player);
            io.emit('state_update', { players, phase: gamePhase });
        });

        socket.on('start_game', () => {
            if (gamePhase === 'LOBBY') {
                gamePhase = 'PLAYING';
                // Reset finished state for all non-spectator players when starting
                players = players.map(p => ({
                    ...p,
                    finished: !!p.isSpectator // Only spectators start as finished
                }));
                // Clear dropped balls tracking for new game
                droppedBalls.clear();
                io.emit('state_update', { players, phase: gamePhase });
            }
        });

        socket.on('reset_lobby', () => {
            console.log('[Socket] Lobby reset requested');
            players = [];
            gamePhase = 'LOBBY';
            // Clear dropped balls tracking
            droppedBalls.clear();
            io.emit('state_update', { players, phase: gamePhase });
        });

        socket.on('play_again', () => {
            players = players.map(p => ({
                ...p,
                score: p.isSpectator ? 0 : null,
                finished: !!p.isSpectator // Reset finished state (spectators stay finished)
            }));
            // Clear dropped balls tracking for new round
            droppedBalls.clear();
            gamePhase = 'PLAYING';
            io.emit('state_update', { players, phase: gamePhase });
        });

        socket.on('drop_ball', (data) => {
            // Prevent multiple ball drops per player per game
            const playerIndex = players.findIndex(p => p.id === socket.id);
            if (playerIndex === -1) return; // Player not found
            
            const player = players[playerIndex];
            
            // Check if player is a spectator (can't drop balls)
            if (player.isSpectator) return;
            
            // Check if player has already dropped a ball this round
            if (droppedBalls.has(socket.id)) return;
            
            // Check if player has already finished (scored or ball destroyed)
            if (player.finished) return;
            
            // Check if game is in PLAYING phase
            if (gamePhase !== 'PLAYING') return;
            
            // Mark that this player has dropped their ball
            droppedBalls.add(socket.id);
            
            // Broadcast the ball spawn
            io.emit('spawn_ball', { ...data, playerId: socket.id });
        });

        socket.on('fire_laser', (data) => {
            io.emit('laser_fired', data);
        });

        socket.on('destroy_ball', (data) => {
            const playerIndex = players.findIndex(p => p.id === data.ballOwnerId);
            if (playerIndex !== -1) {
                players[playerIndex].score = 0;
                players[playerIndex].finished = true;
                io.emit('ball_removed', { ballId: data.ballId });
                io.emit('state_update', { players, phase: gamePhase });
                checkGameOver();
            }
        });

        socket.on('score_update', (data) => {
            const playerIndex = players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                players[playerIndex].score = data.points;
                players[playerIndex].finished = true;
                io.emit('state_update', { players, phase: gamePhase });
                checkGameOver();
            }
        });

        socket.on('disconnect', () => {
            console.log('[Socket] User disconnected:', socket.id);
            players = players.filter(p => p.id !== socket.id);
            if (players.length === 0) gamePhase = 'LOBBY';
            else checkGameOver();
            io.emit('state_update', { players, phase: gamePhase });
        });
    });

    function checkGameOver() {
        if (gamePhase !== 'PLAYING') return;
        const activePlayers = players.filter(p => !p.isSpectator);
        if (activePlayers.length > 0 && activePlayers.every(p => p.finished)) {
            gamePhase = 'GAME_OVER';
            io.emit('state_update', { players, phase: gamePhase });
        }
    }

    // 4. Express Middleware - Vite handles all routes except Socket.IO
    // Socket.IO routes are automatically handled by the io instance above
    // We need to skip Vite middleware for Socket.IO to let Socket.IO handle those requests
    app.use((req, res, next) => {
        // Skip Vite middleware for Socket.IO requests
        if (req.url && req.url.startsWith('/socket.io/')) {
            return next();
        }
        // Let Vite handle everything else (including SPA routing)
        vite.middlewares(req, res, next);
    });

    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
        console.log(`[Server] ✅ Server running on port ${PORT}`);
    });
}

startServer().catch(err => {
    console.error('[Server] Failed to start:', err);
});