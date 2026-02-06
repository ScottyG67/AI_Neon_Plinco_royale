const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createServer: createViteServer } = require('vite');

async function startServer() {
    console.log('[Server] Starting initialization...');

    const app = express();
    app.enable('trust proxy');

    // 1. Create HTTP Server (Raw, without app yet)
    // We do this to ensure we can attach Socket.IO *before* Express
    console.log('[Server] Creating HTTP server...');
    const server = http.createServer();

    // 2. Initialize Socket.IO
    // Attach it to the raw server so it gets first crack at requests
    console.log('[Server] Initializing Socket.IO...');
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        transports: ['polling', 'websocket']
    });

    // 3. Initialize Vite Middleware
    console.log('[Server] Initializing Vite middleware...');
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: __dirname,
    });

    // 4. Express Middleware
    app.use(vite.middlewares);

    // --- GAME STATE ---
    let players = [];
    let gamePhase = 'LOBBY';

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
                io.emit('state_update', { players, phase: gamePhase });
            }
        });

        socket.on('reset_lobby', () => {
            console.log('[Socket] Lobby reset requested');
            players = [];
            gamePhase = 'LOBBY';
            io.emit('state_update', { players, phase: gamePhase });
        });

        socket.on('play_again', () => {
            players = players.map(p => ({
                ...p,
                score: p.isSpectator ? 0 : null,
                finished: !!p.isSpectator
            }));
            gamePhase = 'PLAYING';
            io.emit('state_update', { players, phase: gamePhase });
        });

        socket.on('drop_ball', (data) => {
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

    // 5. Catch-all for SPA (Explicitly ignore /socket.io requests)
    app.get('*', (req, res, next) => {
        if (req.url.startsWith('/socket.io/')) {
            return next();
        }
        if (req.accepts('html')) {
            res.sendFile(path.join(__dirname, 'index.html'));
        } else {
            next();
        }
    });

    // 6. Attach Express to the server
    // By doing this LAST, we ensure Socket.IO (attached earlier) handles its requests first.
    server.on('request', app);

    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
        console.log(`[Server] ✅ Server running on port ${PORT}`);
    });
}

startServer().catch(err => {
    console.error('[Server] Failed to start:', err);
});