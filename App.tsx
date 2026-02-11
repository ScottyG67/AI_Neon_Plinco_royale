import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Player, GamePhase } from './types';
import { Button } from './components/Button';
import { GameCanvas } from './components/GameCanvas';
import { WinnerToast } from './components/WinnerToast';
import { PlayersPanel } from './components/PlayersPanel';
import { COLORS, CHEAT_NAME } from './constants';
import { Users, UserPlus, Play, RotateCcw, Bot, Eye, Music, Music2, Wifi, WifiOff, Settings, X, Info, Github, Zap } from 'lucide-react';
import { VolumeSlider } from './components/VolumeSlider';
import { VolumeLauncer } from './components/VolumeLauncer';
import { resumeAudio, toggleMusic, getMusicState, setMusicVolume, setSfxVolume } from './audio';
import { io, Socket } from 'socket.io-client';

// Create socket singleton outside component to prevent re-creation in StrictMode
// Store in window to survive hot module reloads
declare global {
    interface Window {
        __plinkoSocket?: Socket;
        __plinkoListenersAttached?: boolean;
    }
}

const getSocket = (): Socket => {
    // Check window first (survives HMR)
    if (window.__plinkoSocket && window.__plinkoSocket.connected) {
        console.log(`[App] Reusing window socket. ID: ${window.__plinkoSocket.id}`);
        return window.__plinkoSocket;
    }
    
    // Check module-level (for first load)
    if (!window.__plinkoSocket) {
        console.log('[App] Creating new socket connection...');
        window.__plinkoSocket = io({
            reconnectionAttempts: 20,
            reconnectionDelay: 2000,
            timeout: 20000,
            transports: ['polling', 'websocket'],
            autoConnect: true,
            // Prevent automatic reconnection on manual disconnect
            reconnection: true
        });
        window.__plinkoListenersAttached = false;
        
        // Log socket lifecycle for debugging
        window.__plinkoSocket.on('connect', () => {
            console.log(`[App] ✅ Socket connected with ID: ${window.__plinkoSocket?.id}`);
        });
        
        window.__plinkoSocket.on('disconnect', (reason) => {
            console.log(`[App] ❌ Socket disconnected. Reason: ${reason}`);
        });
        
        window.__plinkoSocket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`[App] 🔄 Reconnection attempt #${attemptNumber}`);
        });
        
        window.__plinkoSocket.on('reconnect', (attemptNumber) => {
            console.log(`[App] ✅ Reconnected after ${attemptNumber} attempts`);
        });
    } else {
        console.log(`[App] Socket exists but not connected. ID: ${window.__plinkoSocket.id}, State: ${window.__plinkoSocket.connected ? 'connected' : 'disconnected'}`);
        // If socket exists but is disconnected, try to reconnect
        if (!window.__plinkoSocket.connected) {
            console.log('[App] Attempting to reconnect existing socket...');
            window.__plinkoSocket.connect();
        }
    }
    
    return window.__plinkoSocket;
};

const App = () => {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOBBY);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [error, setError] = useState('');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [musicVol, setMusicVolState] = useState(0.4);
  const [sfxVol, setSfxVolState] = useState(0.6);
  
  // Socket Ref
  const socketRef = useRef<Socket | null>(null);
  // Track if we're mounted to handle StrictMode properly
  const isMountedRef = useRef(true);
  // Store event handlers in refs so we can properly remove them
  const handlersRef = useRef<{
    connect?: () => void;
    connectError?: (err: Error) => void;
    disconnect?: (reason: string) => void;
    stateUpdate?: (data: { players: Player[], phase: GamePhase }) => void;
    errorMessage?: (msg: string) => void;
  }>({});
  // Current Player ID (My ID)
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
      isMountedRef.current = true;
      
      // Get singleton socket
      const socket = getSocket();
      socketRef.current = socket;
      
      console.log('[App] Setting up socket listeners. Connected:', socket.connected);
      
      // Ensure socket is connected
      console.log(`[App] Socket state - Connected: ${socket.connected}, ID: ${socket.id}`);
      if (!socket.connected) {
          console.log('[App] Socket not connected, attempting to connect...');
          socket.connect();
      } else {
          console.log(`[App] Socket already connected with ID: ${socket.id}`);
          // Update state if already connected
          setIsConnected(true);
          setMyId(socket.id || null);
      }

      // Only attach listeners once to the global socket
      if (!window.__plinkoListenersAttached) {
          console.log('[App] Attaching socket event listeners...');
          
          // Create handlers and store in ref
          handlersRef.current.connect = () => {
              if (!isMountedRef.current) return;
              console.log('[App] Connected to server with ID:', socket.id);
              setIsConnected(true);
              setMyId(socket.id || null);
              setError('');
          };

          handlersRef.current.connectError = (err: Error) => {
              if (!isMountedRef.current) return;
              console.error('[App] Socket connection error:', err);
              setIsConnected(false);
          };

          handlersRef.current.disconnect = (reason: string) => {
              if (!isMountedRef.current) return;
              console.log('[App] Disconnected from server. Reason:', reason);
              setIsConnected(false);
              
              // Only log if it's not a normal client disconnect
              if (reason !== 'io client disconnect') {
                  console.log('[App] Unexpected disconnect, will attempt to reconnect');
              }
          };

          handlersRef.current.stateUpdate = (data: { players: Player[], phase: GamePhase }) => {
              if (!isMountedRef.current) return;
              setPlayers(data.players);
              setPhase(data.phase);
          };

          handlersRef.current.errorMessage = (msg: string) => {
              if (!isMountedRef.current) return;
              setError(msg);
          };
          
          // Add listeners once
          socket.on('connect', handlersRef.current.connect!);
          socket.on('connect_error', handlersRef.current.connectError!);
          socket.on('disconnect', handlersRef.current.disconnect!);
          socket.on('state_update', handlersRef.current.stateUpdate!);
          socket.on('error_message', handlersRef.current.errorMessage!);
          
          window.__plinkoListenersAttached = true;
      } else {
          console.log('[App] Socket listeners already attached, skipping...');
      }

      // Cleanup on page unload
      const handleBeforeUnload = () => {
          console.log('[App] Page unloading, cleaning up socket...');
          if (window.__plinkoSocket) {
              window.__plinkoSocket.removeAllListeners();
              window.__plinkoSocket.disconnect();
              window.__plinkoSocket = undefined;
              window.__plinkoListenersAttached = false;
          }
          socketRef.current = null;
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
          isMountedRef.current = false;
          window.removeEventListener('beforeunload', handleBeforeUnload);
          
          // Don't remove listeners or disconnect here - React StrictMode will remount immediately
          // The socket and listeners will be reused on remount
          // Cleanup only happens on actual page unload
      };
  }, []);

  // Update myId if it changes late
  useEffect(() => {
      if (socketRef.current && socketRef.current.id) {
          setMyId(socketRef.current.id);
      }
  }, [players]);

  // Add Player Handler
  const handleAddPlayer = (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = newPlayerName.trim();
    
    if (!name || !socketRef.current) return;
    
    const isCheater = name === CHEAT_NAME;
    const color = isCheater 
        ? COLORS.ballCheater 
        : `hsl(${Math.random() * 360}, 100%, 50%)`;

    const newPlayer: Player = {
      id: 'pending',
      name,
      score: isSpectator ? 0 : null,
      color,
      isCheater, // This flag drives the physics override in GameCanvas
      isBot: false,
      isSpectator,
      finished: isSpectator
    };

    socketRef.current.emit('join_game', newPlayer);
    setNewPlayerName('');
    setIsSpectator(false);
    setError('');
    resumeAudio();
  };

  const handleStartGame = () => {
    if (socketRef.current) {
        socketRef.current.emit('start_game');
    }
    resumeAudio();
  };

  const handleGameFinish = () => {
    // Handled by server state
  };

  const handleScoreUpdate = (playerId: string, points: number) => {
    if (socketRef.current && playerId === socketRef.current.id) {
        socketRef.current.emit('score_update', { points });
    }
  };

  const handleBallDestroyed = (ballId: string, ballOwnerId: string) => {
      if (socketRef.current) {
          socketRef.current.emit('destroy_ball', { ballId, ballOwnerId });
      }
  };

  const handlePlayAgain = () => {
     if (socketRef.current) {
         socketRef.current.emit('play_again');
     }
     resumeAudio();
  };

  const handleResetLobby = () => {
      if (socketRef.current) {
          socketRef.current.emit('reset_lobby');
      }
  };

  const handleToggleMusic = () => {
      const playing = toggleMusic();
      setMusicPlaying(playing);
  };

  const handleMusicVolChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      const target = e.target as HTMLInputElement;
      const val = parseFloat(target.value);
      setMusicVolState(val);
      setMusicVolume(val);
  };

  const handleSfxVolChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      const target = e.target as HTMLInputElement;
      const val = parseFloat(target.value);
      setSfxVolState(val);
      setSfxVolume(val);
  };

  const winner = useMemo(() => {
    if (phase !== GamePhase.GAME_OVER) return null;
    const activePlayers = players.filter(p => !p.isSpectator);
    if (activePlayers.length === 0) return null;
    
    const sorted = [...activePlayers].sort((a, b) => (b.score || 0) - (a.score || 0));
    return sorted[0];
  }, [players, phase]);

  const amIJoined = useMemo(() => {
      return myId && players.some(p => p.id === myId);
  }, [myId, players]);

  return (
    <div className="h-screen w-screen bg-slate-950 text-white flex flex-col items-center p-2 md:p-4 scanlines relative selection:bg-fuchsia-500 selection:text-white overflow-hidden">
      
      {/* Header */}
      <header className="w-full max-w-6xl flex justify-between items-center mb-4 shrink-0 relative" style={{ zIndex: 9998, position: 'relative' }}>
        <h1 className="text-xl sm:text-2xl md:text-4xl font-display font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 drop-shadow-[0_0_10px_rgba(255,0,255,0.5)]">
          NEON PLINKO
        </h1>
        <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 text-xs uppercase font-bold px-2 py-1 rounded border ${isConnected ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? 'Online' : 'Offline'}
            </div>
            
            <button 
                onClick={handleToggleMusic}
                className={`p-2 rounded-full border transition-all ${musicPlaying ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-400 shadow-[0_0_10px_rgba(255,0,255,0.5)]' : 'bg-transparent border-slate-600 text-slate-500 hover:text-white hover:border-white'}`}
                title={musicPlaying ? "Mute Music" : "Play Music"}
            >
                {musicPlaying ? <Music2 className="w-5 h-5 animate-pulse" /> : <Music className="w-5 h-5" />}
            </button>

            <button 
                onClick={() => setShowAbout(!showAbout)}
                className={`p-2 rounded-full border transition-all ${showAbout ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400' : 'bg-transparent border-slate-600 text-slate-500 hover:text-white hover:border-white'}`}
                title="About"
            >
                <Info className="w-5 h-5" />
            </button>

            <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full border transition-all ${showSettings ? 'bg-slate-700 border-white text-white' : 'bg-transparent border-slate-600 text-slate-500 hover:text-white hover:border-white'}`}
                title="Sound Settings"
            >
                <Settings className="w-5 h-5" />
            </button>

            {phase !== GamePhase.LOBBY && (
                <Button variant="secondary" onClick={handleResetLobby} className="text-xs py-2 px-3">
                    <RotateCcw className="w-4 h-4 mr-2 inline" /> Reset
                </Button>
            )}
        </div>

        {/* About Popover */}
        {showAbout && (
            <div className="absolute top-14 right-0 bg-slate-900 border-2 border-cyan-500/50 rounded-xl p-6 w-80 shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-fade-in" style={{ pointerEvents: 'auto', position: 'absolute', zIndex: 9999 }}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-display text-lg text-cyan-400 uppercase tracking-widest">About</h3>
                    <button onClick={() => setShowAbout(false)} className="text-slate-400 hover:text-white" style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="space-y-4 text-sm text-slate-300" style={{ pointerEvents: 'auto' }}>
                    <p className="leading-relaxed">
                        A simple multiplayer Plinko game coded using <a href="https://cursor.sh" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); window.open('https://cursor.sh', '_blank', 'noopener,noreferrer'); }} className="text-cyan-400 font-semibold hover:text-cyan-300 underline transition-colors" style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 101 }}>Cursor</a> and <a href="https://ai.google.dev/studio" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); window.open('https://ai.google.dev/studio', '_blank', 'noopener,noreferrer'); }} className="text-cyan-400 font-semibold hover:text-cyan-300 underline transition-colors" style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 101 }}>Google AI Studio</a>.
                    </p>
                    
                    <div className="pt-2 border-t border-slate-700">
                        <a 
                            href="https://github.com/ScottyG67/AI_Neon_Plinco_royale" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open('https://github.com/ScottyG67/AI_Neon_Plinco_royale', '_blank', 'noopener,noreferrer');
                            }}
                            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                            style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 101 }}
                        >
                            <Github className="w-4 h-4" />
                            <span>View on GitHub</span>
                        </a>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-700">
                        <p className="text-xs text-slate-400">
                            Created by <span className="text-cyan-400 font-semibold">Scott Gloyna</span>
                        </p>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-700">
                        <p className="text-xs text-slate-400 mb-2">Credits:</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            Advanced volume controls inspired by{' '}
                            <a 
                                href="https://github.com/ZeyuKeithFu/WorstVolumeControl" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open('https://github.com/ZeyuKeithFu/WorstVolumeControl', '_blank', 'noopener,noreferrer');
                                }}
                                className="text-cyan-400 hover:text-cyan-300 underline"
                                style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 101 }}
                            >
                                WorstVolumeControl
                            </a>
                            {' '}by ZeyuKeithFu
                        </p>
                    </div>
                </div>
            </div>
        )}

        {/* Settings Popover */}
        {showSettings && (
            <div className="absolute top-14 right-0 bg-slate-900 border-2 border-slate-700 rounded-xl p-4 w-64 shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-fade-in" style={{ pointerEvents: 'auto', position: 'absolute', zIndex: 9999 }}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-display text-sm text-cyan-400 uppercase tracking-widest">Audio Settings</h3>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white" style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="space-y-4" style={{ pointerEvents: 'auto' }}>
                    {/* Advanced Mode Toggle */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-700" style={{ pointerEvents: 'auto' }}>
                        <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 text-yellow-400" />
                            <span className="text-xs text-slate-300">Advanced Mode</span>
                        </div>
                        <button
                            onClick={() => setAdvancedMode(!advancedMode)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${advancedMode ? 'bg-yellow-500' : 'bg-slate-600'}`}
                            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        >
                            <div 
                                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${advancedMode ? 'translate-x-5' : ''}`}
                            />
                        </button>
                    </div>

                    {advancedMode ? (
                        <>
                            {/* Advanced Volume Sliders */}
                            <VolumeSlider
                                value={musicVol}
                                onChange={(val) => {
                                    setMusicVolState(val);
                                    setMusicVolume(val);
                                }}
                                label="Music"
                                color="#ec4899"
                            />
                            <VolumeLauncer
                                value={sfxVol}
                                onChange={(val) => {
                                    setSfxVolState(val);
                                    setSfxVolume(val);
                                }}
                                label="SFX"
                                color="#06b6d4"
                            />
                            
                            {/* Credits for advanced volume controls */}
                            <div className="pt-2 border-t border-slate-700">
                                <p className="text-[8px] text-slate-500 italic text-center">
                                    Advanced volume controls inspired by{' '}
                                    <a 
                                        href="https://github.com/ZeyuKeithFu/WorstVolumeControl" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open('https://github.com/ZeyuKeithFu/WorstVolumeControl', '_blank', 'noopener,noreferrer');
                                        }}
                                        className="text-cyan-400 hover:text-cyan-300 underline"
                                        style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 101 }}
                                    >
                                        WorstVolumeControl
                                    </a>
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Standard Volume Sliders */}
                            <div className="space-y-1" style={{ pointerEvents: 'auto' }}>
                                <div className="flex justify-between text-xs text-slate-300">
                                    <span>Music</span>
                                    <span>{Math.round(musicVol * 100)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.01" 
                                    value={musicVol}
                                    onChange={handleMusicVolChange}
                                    onInput={handleMusicVolChange}
                                    className="w-full accent-fuchsia-500"
                                    style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10000, cursor: 'pointer' }}
                                />
                            </div>
                            
                            <div className="space-y-1" style={{ pointerEvents: 'auto' }}>
                                <div className="flex justify-between text-xs text-slate-300">
                                    <span>SFX</span>
                                    <span>{Math.round(sfxVol * 100)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.01" 
                                    value={sfxVol}
                                    onChange={handleSfxVolChange}
                                    onInput={handleSfxVolChange}
                                    className="w-full accent-cyan-500"
                                    style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10000, cursor: 'pointer' }}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl flex flex-col md:flex-row gap-2 md:gap-6 z-10 min-h-0">
        
        {/* Left Panel: Scoreboard / Lobby List - Responsive with minimize */}
        <PlayersPanel 
          players={players}
          myId={myId}
          phase={phase}
          amIJoined={amIJoined}
          newPlayerName={newPlayerName}
          setNewPlayerName={setNewPlayerName}
          isSpectator={isSpectator}
          setIsSpectator={setIsSpectator}
          error={error}
          onErrorClose={() => setError('')}
          isConnected={isConnected}
          handleAddPlayer={handleAddPlayer}
          handleStartGame={handleStartGame}
        />

        {/* Right Panel: The Game */}
        <section className="flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-xl bg-slate-900/20 border border-purple-500/10">
          {phase === GamePhase.LOBBY ? (
            <div className="text-center opacity-50 flex flex-col items-center">
                <div className="w-48 h-48 md:w-64 md:h-64 border-4 border-dashed border-slate-700 rounded-full flex items-center justify-center mb-4 animate-spin-slow" style={{animationDuration: '20s'}}>
                    <div className="w-32 h-32 md:w-48 md:h-48 border-4 border-dashed border-slate-800 rounded-full" />
                </div>
                <p className="text-cyan-700 font-display text-xl uppercase tracking-widest">Awaiting Initialization...</p>
                {amIJoined && <p className="mt-4 text-white text-sm animate-pulse">Waiting for host to start...</p>}
            </div>
          ) : (
            <GameCanvas 
              players={players} 
              phase={phase}
              onScoreUpdate={handleScoreUpdate}
              onBallDestroyed={handleBallDestroyed}
              onGameFinish={handleGameFinish} 
              socket={socketRef.current}
              myId={myId}
            />
          )}
        </section>
      </main>

      {/* Winner Overlay */}
      <WinnerToast winner={winner} onPlayAgain={handlePlayAgain} />

    </div>
  );
};

export default App;