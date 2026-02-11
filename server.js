const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { createServer: createViteServer } = require('vite');

// Detect deployed/qa mode: Cloud Run sets NODE_ENV=qa in Dockerfile
// This ensures deployed mode only in Cloud Run (bstw-qa-warehouse), not on local machines
const distPath = path.resolve(__dirname, 'dist');
const isDeployed = process.env.NODE_ENV === 'qa';

async function startServer() {
    console.log('[Server] Starting initialization...');
    console.log(`[Server] Mode: ${isDeployed ? 'QA/DEPLOYED' : 'DEVELOPMENT'}`);

    const app = express();
    app.enable('trust proxy');

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

    let vite;
    if (!isDeployed) {
        // 1. Initialize Vite Middleware for development
        console.log('[Server] Initializing Vite middleware...');
        vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
            root: __dirname,
        });
    } else {
        // In deployed/qa mode, serve static files from dist
        console.log('[Server] QA/Deployed mode: serving static files from dist');
        if (!fs.existsSync(distPath)) {
            console.error('[Server] ERROR: dist directory not found. Run "npm run build" first.');
            process.exit(1);
        }
    }

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
            // Check if max player limit has been reached
            if (players.length >= 50) {
                socket.emit('error_message', 'Max player limit has been reached');
                return;
            }
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

    // 4. Express Middleware - Handle routes
    // Socket.IO routes are automatically handled by the io instance above
    app.use((req, res, next) => {
        // Skip middleware for Socket.IO requests
        if (req.url && req.url.startsWith('/socket.io/')) {
            return next();
        }
        
        if (isDeployed) {
            // In deployed/qa mode, serve static files
            next();
        } else {
            // In development, use Vite middleware
            vite.middlewares(req, res, next);
        }
    });

    if (isDeployed) {
        // Serve static files from dist
        app.use(express.static(distPath, {
            maxAge: '1y',
            etag: false
        }));
        
        // SPA fallback: serve index.html for all non-API routes
        app.get('*', (req, res) => {
            // Skip Socket.IO and other API routes
            if (req.url.startsWith('/socket.io/')) {
                return res.status(404).send('Not found');
            }
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    const PORT = process.env.PORT || (isDeployed ? 8080 : 3001);
    server.listen(PORT, () => {
        console.log(`[Server] ✅ Server running on port ${PORT}`);
    });
}

startServer().catch(err => {
    console.error('[Server] Failed to start:', err);
});