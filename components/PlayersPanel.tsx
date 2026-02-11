import React, { useState, useEffect, useRef } from 'react';
import { Player, GamePhase } from '../types';
import { Button } from './Button';
import { Users, UserPlus, Play, Eye, AlertCircle, X, Bot } from 'lucide-react';

interface PlayersPanelProps {
  players: Player[];
  myId: string | null;
  phase: GamePhase;
  amIJoined: boolean;
  newPlayerName: string;
  setNewPlayerName: (name: string) => void;
  isSpectator: boolean;
  setIsSpectator: (val: boolean) => void;
  error: string;
  onErrorClose: () => void;
  isConnected: boolean;
  handleAddPlayer: (e?: React.FormEvent) => void;
  handleAddBot: () => void;
  handleStartGame: () => void;
}

export const PlayersPanel: React.FC<PlayersPanelProps> = ({
  players,
  myId,
  phase,
  amIJoined,
  newPlayerName,
  setNewPlayerName,
  isSpectator,
  setIsSpectator,
  error,
  onErrorClose,
  isConnected,
  handleAddPlayer,
  handleAddBot,
  handleStartGame
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Detect mobile and handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768); // md breakpoint
      // Auto-minimize on very small screens
      if (width < 640) {
        setIsMinimized(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Minimized view - just show player count and toggle button
  if (isMinimized) {
    return (
      <aside className="bg-slate-900/80 border border-purple-500/30 rounded-xl p-2 md:p-4 backdrop-blur-md shadow-[0_0_20px_rgba(157,0,255,0.2)] flex flex-row md:flex-col items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Users className="text-cyan-400 w-4 h-4 md:w-5 md:h-5" />
          <span className="text-xs md:text-sm font-display text-cyan-400 uppercase">
            {players.length} {players.length === 1 ? 'Player' : 'Players'}
          </span>
        </div>
        <button
          onClick={() => setIsMinimized(false)}
          className="text-cyan-400 hover:text-cyan-300 transition-colors p-1"
          title="Expand players list"
        >
          <Users className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </aside>
    );
  }

  // Full view
  return (
    <aside 
      ref={panelRef}
      className="w-full md:w-1/3 bg-slate-900/80 border border-purple-500/30 rounded-xl p-3 md:p-6 backdrop-blur-md shadow-[0_0_20px_rgba(157,0,255,0.2)] flex flex-col h-full max-h-full overflow-hidden transition-all"
    >
      <div className="flex items-center justify-between gap-2 mb-2 md:mb-4 border-b border-purple-500/30 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Users className="text-cyan-400 w-4 h-4 md:w-5 md:h-5" />
          <h2 className="text-sm md:text-xl font-display text-cyan-400 uppercase tracking-widest">
            Players ({players.length})
          </h2>
        </div>
        {isMobile && (
          <button
            onClick={() => setIsMinimized(true)}
            className="text-cyan-400 hover:text-cyan-300 transition-colors p-1"
            title="Minimize players list"
          >
            <Users className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2 md:space-y-3 overflow-y-auto pr-1 md:pr-2 flex-1 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-transparent">
        {players.length === 0 && (
          <div className="text-slate-500 italic text-center py-2 md:py-4 text-xs md:text-sm">
            Waiting for players...
          </div>
        )}
        {players.map(player => (
          <div 
            key={player.id} 
            className={`flex items-center justify-between bg-slate-800/50 p-2 md:p-3 rounded-lg border transition-colors text-xs md:text-sm ${player.id === myId ? 'border-cyan-400 bg-slate-800' : 'border-slate-700'} ${player.isSpectator ? 'opacity-70 border-dashed' : ''}`}
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              <div 
                className="w-3 h-3 md:w-4 md:h-4 rounded-full shadow-[0_0_8px_currentColor] shrink-0" 
                style={{ backgroundColor: player.color, color: player.color }} 
              />
              <div className="flex flex-col min-w-0">
                <span className="font-bold tracking-wide leading-none flex items-center gap-1 md:gap-2 truncate">
                  {player.name}
                  {player.id === myId && (
                    <span className="text-[8px] md:text-[10px] text-cyan-400 bg-cyan-950 px-1 rounded shrink-0">
                      (YOU)
                    </span>
                  )}
                  {player.isSpectator && <Eye className="w-2 h-2 md:w-3 md:h-3 text-slate-400 shrink-0" />}
                </span>
                <span className="text-[8px] md:text-[10px] text-slate-400 uppercase">
                  {player.isBot ? 'Bot' : player.isSpectator ? 'Spectator' : 'Player'}
                </span>
              </div>
            </div>
            {!player.isSpectator && (
              <div className="font-display text-base md:text-xl text-fuchsia-400 shrink-0 ml-2">
                {player.score !== null ? player.score : '-'}
              </div>
            )}
          </div>
        ))}
      </div>

      {phase === GamePhase.LOBBY && !amIJoined && (
        <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-purple-500/30 space-y-2 md:space-y-4 shrink-0">
          <form onSubmit={handleAddPlayer} className="flex flex-col gap-2 md:gap-3">
            <div className="relative">
              <input
                type="text"
                maxLength={15}
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Enter Name"
                className="w-full bg-slate-950 border-2 border-slate-700 rounded-lg p-2 md:p-3 text-white text-sm md:text-base focus:border-cyan-400 focus:outline-none focus:shadow-[0_0_10px_rgba(0,255,255,0.4)] transition-all font-mono placeholder:text-slate-600"
              />
              <UserPlus className="absolute right-2 md:right-3 top-2 md:top-3.5 text-slate-500 w-4 h-4 md:w-5 md:h-5" />
            </div>
            
            <div className="flex items-center gap-2 px-1">
              <input 
                type="checkbox" 
                id="spectator-check"
                checked={isSpectator}
                onChange={(e) => setIsSpectator(e.target.checked)}
                className="w-3 h-3 md:w-4 md:h-4 accent-fuchsia-500 bg-slate-900 border-slate-600 rounded cursor-pointer"
              />
              <label htmlFor="spectator-check" className="text-xs md:text-sm text-slate-300 cursor-pointer select-none">
                Join as Spectator
              </label>
            </div>
            
            {error && (
              <div className="bg-slate-900 border-2 border-red-500 p-3 rounded-xl shadow-[0_0_20px_rgba(255,0,0,0.5)] flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-red-400 font-bold text-xs flex-1">{error}</p>
                <button
                  onClick={onErrorClose}
                  className="text-slate-400 hover:text-white transition-colors shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <Button 
              type="submit" 
              variant="secondary" 
              className="w-full py-1.5 md:py-2 text-xs md:text-sm"
              disabled={!newPlayerName.trim() || !isConnected}
            >
              Join Lobby
            </Button>
          </form>
        </div>
      )}

      {phase === GamePhase.LOBBY && amIJoined && (
        <div className="mt-2 md:mt-4 shrink-0 space-y-2">
          <Button 
            onClick={handleAddBot} 
            disabled={players.length >= 50}
            variant="secondary"
            className="w-full flex items-center justify-center gap-2 py-1.5 md:py-2 text-xs md:text-sm"
          >
            <Bot className="w-4 h-4 md:w-5 md:h-5" />
            Add Bot
          </Button>
          <Button 
            onClick={handleStartGame} 
            disabled={players.filter(p => !p.isSpectator).length === 0} 
            className="w-full flex items-center justify-center gap-2 py-1.5 md:py-2 text-xs md:text-sm"
          >
            <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
            Start Game
          </Button>
        </div>
      )}
    </aside>
  );
};
