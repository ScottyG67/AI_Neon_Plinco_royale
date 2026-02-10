import { Player, GamePhase } from '../types';

interface GameState {
  players: Player[];
  phase: GamePhase;
}

interface PlayerDelta {
  id: string;
  name?: string;
  color?: string;
  score?: number | null;
  isCheater?: boolean;
  isBot?: boolean;
  isSpectator?: boolean;
  finished?: boolean;
}

interface GameStateDelta {
  players?: PlayerDelta[];
  phase?: GamePhase;
  fullState?: boolean;
}

// Apply delta to previous state to get current state (client-side)
export function applyStateDelta(
  previousState: GameState,
  delta: GameStateDelta
): GameState {
  if (delta.fullState && delta.players) {
    // Full state update
    return {
      players: delta.players.map(p => ({
        id: p.id!,
        name: p.name!,
        color: p.color!,
        score: p.score === undefined ? null : p.score,
        isCheater: p.isCheater ?? false,
        isBot: p.isBot ?? false,
        isSpectator: p.isSpectator ?? false,
        finished: p.finished ?? false
      })),
      phase: delta.phase || previousState.phase
    };
  }

  // Delta update - merge with previous state
  const playersMap = new Map<string, Player>();
  
  // Start with previous players
  previousState.players.forEach(p => playersMap.set(p.id, { ...p }));

  // Apply delta updates
  if (delta.players) {
    delta.players.forEach(deltaPlayer => {
    const existingPlayer = playersMap.get(deltaPlayer.id);
    
    if (existingPlayer) {
      // Update existing player with delta fields
      if (deltaPlayer.name !== undefined) existingPlayer.name = deltaPlayer.name;
      if (deltaPlayer.color !== undefined) existingPlayer.color = deltaPlayer.color;
      if (deltaPlayer.score !== undefined) existingPlayer.score = deltaPlayer.score;
      if (deltaPlayer.isCheater !== undefined) existingPlayer.isCheater = deltaPlayer.isCheater;
      if (deltaPlayer.isBot !== undefined) existingPlayer.isBot = deltaPlayer.isBot;
      if (deltaPlayer.isSpectator !== undefined) existingPlayer.isSpectator = deltaPlayer.isSpectator;
      if (deltaPlayer.finished !== undefined) existingPlayer.finished = deltaPlayer.finished;
    } else {
      // New player
      playersMap.set(deltaPlayer.id, {
        id: deltaPlayer.id,
        name: deltaPlayer.name || '',
        color: deltaPlayer.color || '#ffffff',
        score: deltaPlayer.score === undefined ? null : deltaPlayer.score,
        isCheater: deltaPlayer.isCheater ?? false,
        isBot: deltaPlayer.isBot ?? false,
        isSpectator: deltaPlayer.isSpectator ?? false,
        finished: deltaPlayer.finished ?? false
      });
    }
    });
  }

  return {
    players: Array.from(playersMap.values()),
    phase: delta.phase || previousState.phase
  };
}
