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
    // Bot counter for unique bot names
    let botCounter = 1;
    
    // Synthwave-themed bot name components
    const synthwavePrefixes = [
        'Neon', 'Cyber', 'Synth', 'Pulse', 'Arc', 'Flux', 'Matrix', 'Grid',
        'Vector', 'Byte', 'Pixel', 'Wave', 'Laser', 'Glitch', 'Vapor', 'Retro',
        'Digital', 'Electric', 'Photon', 'Quantum', 'Nexus', 'Vortex', 'Prism',
        'Crystal', 'Shadow', 'Echo', 'Rift', 'Zero', 'Alpha', 'Omega', 'Nova'
    ];
    
    const synthwaveSuffixes = [
        'Runner', 'Drift', 'Core', 'Drive', 'Zone', 'Edge', 'Blade', 'Strike',
        'Pulse', 'Wave', 'Beam', 'Ray', 'Flash', 'Spark', 'Bolt', 'Surge',
        'Rider', 'Hunter', 'Seeker', 'Ghost', 'Phantom', 'Void', 'Void',
        'Storm', 'Fire', 'Ice', 'Tech', 'Link', 'Node', 'Grid', 'System'
    ];
    
    function generateSynthwaveBotName() {
        // Randomly choose between different name formats
        const format = Math.random();
        
        if (format < 0.4) {
            // Format: "Neon-Runner" or "Cyber-Drift"
            const prefix = synthwavePrefixes[Math.floor(Math.random() * synthwavePrefixes.length)];
            const suffix = synthwaveSuffixes[Math.floor(Math.random() * synthwaveSuffixes.length)];
            return `${prefix}-${suffix}`;
        } else if (format < 0.7) {
            // Format: "Neon-42" or "Cyber-1984"
            const prefix = synthwavePrefixes[Math.floor(Math.random() * synthwavePrefixes.length)];
            const number = Math.floor(Math.random() * 9999) + 1;
            return `${prefix}-${number}`;
        } else {
            // Format: "SYNTH-01" or "NEXUS-99"
            const prefix = synthwavePrefixes[Math.floor(Math.random() * synthwavePrefixes.length)].toUpperCase();
            const number = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
            return `${prefix}-${number}`;
        }
    }
    // Track bot drop timers to clear them if needed
    const botDropTimers = new Map();
    // Track timeout timers for players who haven't scored (15 second limit)
    const scoreTimeoutTimers = new Map();
    // Game constants
    const LOGICAL_WIDTH = 600;
    const PLAY_BOUNDS_PADDING = 20; // Padding from edges
    const SCORE_TIMEOUT_MS = 15000; // 15 seconds

    // --- BOT LOGIC ---
    function scheduleBotDrops() {
        // Get all bots that are not spectators and haven't finished
        const bots = players.filter(p => p.isBot && !p.isSpectator && !p.finished);
        
        bots.forEach(bot => {
            // Skip if bot already has a drop timer scheduled
            if (botDropTimers.has(bot.id)) {
                console.log(`[Bot] Skipping ${bot.name} - drop timer already scheduled`);
                return;
            }
            
            // Skip if bot has already dropped
            if (droppedBalls.has(bot.id)) {
                console.log(`[Bot] Skipping ${bot.name} - already dropped`);
                return;
            }
            
            // Random drop time between 1-5 seconds (in milliseconds)
            const dropDelay = 1000 + Math.random() * 4000; // 1000ms to 5000ms
            
            // Random x position within play bounds
            const minX = PLAY_BOUNDS_PADDING;
            const maxX = LOGICAL_WIDTH - PLAY_BOUNDS_PADDING;
            const randomX = minX + Math.random() * (maxX - minX);
            
            console.log(`[Bot] Scheduling drop for ${bot.name} in ${dropDelay.toFixed(0)}ms at x=${randomX.toFixed(2)}`);
            
            const timer = setTimeout(() => {
                // Check if bot still exists and game is still playing
                const botIndex = players.findIndex(p => p.id === bot.id);
                if (botIndex === -1) {
                    console.log(`[Bot] ${bot.name} was removed before drop`);
                    botDropTimers.delete(bot.id);
                    return; // Bot was removed
                }
                
                const currentBot = players[botIndex];
                
                // Double-check if bot has already dropped or finished (race condition protection)
                if (droppedBalls.has(bot.id)) {
                    console.log(`[Bot] ${bot.name} already dropped (race condition)`);
                    botDropTimers.delete(bot.id);
                    return;
                }
                
                if (currentBot.finished) {
                    console.log(`[Bot] ${bot.name} already finished`);
                    botDropTimers.delete(bot.id);
                    return;
                }
                
                // Check if game is still in PLAYING phase
                if (gamePhase !== 'PLAYING') {
                    console.log(`[Bot] Game phase changed to ${gamePhase}, cancelling drop for ${bot.name}`);
                    botDropTimers.delete(bot.id);
                    return;
                }
                
                // Mark that this bot has dropped their ball (do this first to prevent race conditions)
                droppedBalls.add(bot.id);
                
                // Set 15-second timeout timer for bot - if bot doesn't score, give them 0 points
                const botTimeoutTimer = setTimeout(() => {
                    // Check if bot still exists and hasn't scored
                    const currentBotIndex = players.findIndex(p => p.id === bot.id);
                    if (currentBotIndex !== -1 && !players[currentBotIndex].finished) {
                        players[currentBotIndex].score = 0;
                        players[currentBotIndex].finished = true;
                        console.log(`[Timeout] Bot ${players[currentBotIndex].name} timed out - 0 points`);
                        io.emit('state_update', { players, phase: gamePhase });
                        checkGameOver();
                    }
                    // Remove timer from map
                    scoreTimeoutTimers.delete(bot.id);
                }, SCORE_TIMEOUT_MS);
                
                scoreTimeoutTimers.set(bot.id, botTimeoutTimer);
                
                // Broadcast the ball spawn
                io.emit('spawn_ball', { x: randomX, playerId: bot.id });
                
                console.log(`[Bot] ${bot.name} dropped ball at x=${randomX.toFixed(2)}`);
                
                // Remove timer from map
                botDropTimers.delete(bot.id);
            }, dropDelay);
            
            // Store timer so we can clear it if needed
            botDropTimers.set(bot.id, timer);
        });
    }

    // --- SOCKET LOGIC ---
    io.on('connection', (socket) => {
        console.log('[Socket] User connected:', socket.id);
        socket.emit('state_update', { players, phase: gamePhase });

        socket.on('join_game', (newPlayer) => {
            // If at limit, remove a bot to make room for real player
            if (players.length >= 50) {
                const botIndex = players.findIndex(p => p.isBot);
                if (botIndex !== -1) {
                    // Remove a bot to make room
                    const removedBot = players[botIndex];
                    players.splice(botIndex, 1);
                    
                    // Clear bot's drop timer if it exists
                    const botTimer = botDropTimers.get(removedBot.id);
                    if (botTimer) {
                        clearTimeout(botTimer);
                        botDropTimers.delete(removedBot.id);
                    }
                    
                    // Clear bot's score timeout timer if it exists
                    const botScoreTimer = scoreTimeoutTimers.get(removedBot.id);
                    if (botScoreTimer) {
                        clearTimeout(botScoreTimer);
                        scoreTimeoutTimers.delete(removedBot.id);
                    }
                    
                    console.log('[Socket] Removed bot to make room for player');
                } else {
                    // No bots to remove, reject the join
                    socket.emit('error_message', 'Max player limit has been reached');
                    return;
                }
            }
            if (players.some(p => p.name.toLowerCase() === newPlayer.name.toLowerCase())) {
                socket.emit('error_message', 'Name already taken');
                return;
            }
            const player = { ...newPlayer, id: socket.id };
            players.push(player);
            io.emit('state_update', { players, phase: gamePhase });
        });

        socket.on('add_bot', () => {
            // Check if max player limit has been reached
            if (players.length >= 50) {
                socket.emit('error_message', 'Max player limit has been reached');
                return;
            }
            
            // Generate unique synthwave-themed bot name
            let botName;
            let attempts = 0;
            do {
                botName = generateSynthwaveBotName();
                attempts++;
                // Fallback to numbered name if we can't find a unique synthwave name after many attempts
                if (attempts > 50) {
                    botName = `Neon-${botCounter}`;
                    botCounter++;
                }
            } while (players.some(p => p.name.toLowerCase() === botName.toLowerCase()));
            
            // Generate random color for bot
            const botColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
            
            // Create bot player (no socket ID needed, use bot- prefix)
            const botId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const bot = {
                id: botId,
                name: botName,
                score: null,
                color: botColor,
                isCheater: false,
                isBot: true,
                isSpectator: false,
                finished: false
            };
            
            players.push(bot);
            console.log(`[Socket] Bot added: ${botName} (${botId})`);
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
                // Clear any existing bot timers
                botDropTimers.forEach(timer => clearTimeout(timer));
                botDropTimers.clear();
                
                // Schedule bot ball drops
                scheduleBotDrops();
                
                io.emit('state_update', { players, phase: gamePhase });
            }
        });

        socket.on('reset_lobby', () => {
            console.log('[Socket] Lobby reset requested');
            // Clear any existing bot timers
            botDropTimers.forEach(timer => clearTimeout(timer));
            botDropTimers.clear();
            // Clear score timeout timers
            scoreTimeoutTimers.forEach(timer => clearTimeout(timer));
            scoreTimeoutTimers.clear();
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
            // Clear any existing bot timers
            botDropTimers.forEach(timer => clearTimeout(timer));
            botDropTimers.clear();
            // Clear score timeout timers
            scoreTimeoutTimers.forEach(timer => clearTimeout(timer));
            scoreTimeoutTimers.clear();
            
            gamePhase = 'PLAYING';
            
            // Schedule bot ball drops for new round
            scheduleBotDrops();
            
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
            
            // Set 15-second timeout timer - if player doesn't score, give them 0 points
            const timeoutTimer = setTimeout(() => {
                // Check if player still exists and hasn't scored
                const currentPlayerIndex = players.findIndex(p => p.id === socket.id);
                if (currentPlayerIndex !== -1 && !players[currentPlayerIndex].finished) {
                    players[currentPlayerIndex].score = 0;
                    players[currentPlayerIndex].finished = true;
                    console.log(`[Timeout] Player ${players[currentPlayerIndex].name} timed out - 0 points`);
                    io.emit('state_update', { players, phase: gamePhase });
                    checkGameOver();
                }
                // Remove timer from map
                scoreTimeoutTimers.delete(socket.id);
            }, SCORE_TIMEOUT_MS);
            
            scoreTimeoutTimers.set(socket.id, timeoutTimer);
            
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
                
                // Clear timeout timer since player is finished
                const timeoutTimer = scoreTimeoutTimers.get(data.ballOwnerId);
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    scoreTimeoutTimers.delete(data.ballOwnerId);
                }
                
                io.emit('ball_removed', { ballId: data.ballId });
                io.emit('state_update', { players, phase: gamePhase });
                checkGameOver();
            }
        });

        socket.on('score_update', (data) => {
            // Handle bot scores (playerId provided) or regular player scores (use socket.id)
            const targetPlayerId = data.playerId || socket.id;
            const playerIndex = players.findIndex(p => p.id === targetPlayerId);
            
            if (playerIndex !== -1) {
                // For bots, any client can report the score
                // For regular players, only the player themselves can report (enforced by socket.id check)
                if (targetPlayerId === socket.id || players[playerIndex].isBot) {
                    players[playerIndex].score = data.points;
                    players[playerIndex].finished = true;
                    
                    // Clear timeout timer since player scored
                    const timeoutTimer = scoreTimeoutTimers.get(targetPlayerId);
                    if (timeoutTimer) {
                        clearTimeout(timeoutTimer);
                        scoreTimeoutTimers.delete(targetPlayerId);
                    }
                    
                    io.emit('state_update', { players, phase: gamePhase });
                    checkGameOver();
                }
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