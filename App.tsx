import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Player, GamePhase } from './types';
import { Button } from './components/Button';
import { GameCanvas } from './components/GameCanvas';
import { WinnerToast } from './components/WinnerToast';
import { COLORS, CHEAT_NAME } from './constants';
import { Users, UserPlus, Play, RotateCcw, Bot, Eye, Music, Music2, Wifi, WifiOff, Settings, X } from 'lucide-react';
import { resumeAudio, toggleMusic, getMusicState, setMusicVolume, setSfxVolume } from './audio';
import { io, Socket } from 'socket.io-client';

const App = () => {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOBBY);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [error, setError] = useState('');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [musicVol, setMusicVolState] = useState(0.4);
  const [sfxVol, setSfxVolState] = useState(0.6);
  
  // Socket Ref
  const socketRef = useRef<Socket | null>(null);
  // Current Player ID (My ID)
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
      // Connect to the server
      const socket = io({
          reconnectionAttempts: 20,
          reconnectionDelay: 2000,
          timeout: 20000,
          transports: ['polling', 'websocket'], // Attempt polling first, then upgrade
          path: '/socket.io' // Explicit default
      });
      socketRef.current = socket;

      socket.on('connect', () => {
          console.log('Connected to server with ID:', socket.id);
          setIsConnected(true);
          setMyId(socket.id || null);
          setError('');
      });

      socket.on('connect_error', (err) => {
          console.error('Socket connection error:', err);
          setIsConnected(false);
      });

      socket.on('disconnect', () => {
          console.log('Disconnected from server');
          setIsConnected(false);
      });

      socket.on('state_update', (data: { players: Player[], phase: GamePhase }) => {
          setPlayers(data.players);
          setPhase(data.phase);
      });

      socket.on('error_message', (msg: string) => {
          setError(msg);
      });

      return () => {
          socket.disconnect();
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

  const handleMusicVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setMusicVolState(val);
      setMusicVolume(val);
  };

  const handleSfxVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
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
    <div className="h-screen bg-slate-950 text-white flex flex-col items-center p-4 scanlines relative selection:bg-fuchsia-500 selection:text-white overflow-hidden">
      
      {/* Header */}
      <header className="w-full max-w-6xl flex justify-between items-center mb-4 z-10 shrink-0 relative">
        <h1 className="text-2xl md:text-4xl font-display font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 drop-shadow-[0_0_10px_rgba(255,0,255,0.5)]">
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

        {/* Settings Popover */}
        {showSettings && (
            <div className="absolute top-14 right-0 z-50 bg-slate-900 border-2 border-slate-700 rounded-xl p-4 w-64 shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-display text-sm text-cyan-400 uppercase tracking-widest">Audio Settings</h3>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div className="space-y-1">
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
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                        />
                    </div>
                    
                    <div className="space-y-1">
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
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                </div>
            </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl flex flex-col md:flex-row gap-6 z-10 min-h-0">
        
        {/* Left Panel: Scoreboard / Lobby List */}
        <aside className="w-full md:w-1/3 bg-slate-900/80 border border-purple-500/30 rounded-xl p-6 backdrop-blur-md shadow-[0_0_20px_rgba(157,0,255,0.2)] flex flex-col h-full max-h-full overflow-hidden">
          <div className="flex items-center gap-2 mb-4 border-b border-purple-500/30 pb-2 shrink-0">
            <Users className="text-cyan-400" />
            <h2 className="text-xl font-display text-cyan-400 uppercase tracking-widest">Players ({players.length})</h2>
          </div>

          <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-transparent">
            {players.length === 0 && (
                <div className="text-slate-500 italic text-center py-4">Waiting for players...</div>
            )}
            {players.map(player => (
              <div 
                key={player.id} 
                className={`flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border transition-colors ${player.id === myId ? 'border-cyan-400 bg-slate-800' : 'border-slate-700'} ${player.isSpectator ? 'opacity-70 border-dashed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full shadow-[0_0_8px_currentColor]" 
                    style={{ backgroundColor: player.color, color: player.color }} 
                  />
                  <div className="flex flex-col">
                    <span className="font-bold tracking-wide leading-none flex items-center gap-2">
                        {player.name}
                        {player.id === myId && <span className="text-[10px] text-cyan-400 bg-cyan-950 px-1 rounded">(YOU)</span>}
                        {player.isSpectator && <Eye className="w-3 h-3 text-slate-400" />}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase">
                        {player.isBot ? 'Bot' : player.isSpectator ? 'Spectator' : 'Player'}
                    </span>
                  </div>
                </div>
                {!player.isSpectator && (
                    <div className="font-display text-xl text-fuchsia-400">
                    {player.score !== null ? player.score : '-'}
                    </div>
                )}
              </div>
            ))}
          </div>

          {phase === GamePhase.LOBBY && !amIJoined && (
            <div className="mt-4 pt-4 border-t border-purple-500/30 space-y-4 shrink-0">
              <form onSubmit={handleAddPlayer} className="flex flex-col gap-3">
                <div className="relative">
                  <input
                    type="text"
                    maxLength={15}
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Enter Name"
                    className="w-full bg-slate-950 border-2 border-slate-700 rounded-lg p-3 text-white focus:border-cyan-400 focus:outline-none focus:shadow-[0_0_10px_rgba(0,255,255,0.4)] transition-all font-mono placeholder:text-slate-600"
                  />
                  <UserPlus className="absolute right-3 top-3.5 text-slate-500 w-5 h-5" />
                </div>
                
                <div className="flex items-center gap-2 px-1">
                    <input 
                        type="checkbox" 
                        id="spectator-check"
                        checked={isSpectator}
                        onChange={(e) => setIsSpectator(e.target.checked)}
                        className="w-4 h-4 accent-fuchsia-500 bg-slate-900 border-slate-600 rounded cursor-pointer"
                    />
                    <label htmlFor="spectator-check" className="text-sm text-slate-300 cursor-pointer select-none">
                        Join as Spectator
                    </label>
                </div>

                {error && <p className="text-red-500 text-xs font-bold animate-pulse">{error}</p>}
                
                <Button 
                    type="submit" 
                    variant="secondary" 
                    className="w-full py-2 text-sm"
                    disabled={!newPlayerName.trim() || !isConnected}
                >
                    Join Lobby
                </Button>
              </form>
            </div>
          )}

           {phase === GamePhase.LOBBY && amIJoined && (
              <div className="mt-4 shrink-0">
                <Button 
                  onClick={handleStartGame} 
                  disabled={players.filter(p => !p.isSpectator).length === 0} 
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start Game
                </Button>
              </div>
           )}
        </aside>

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