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
  fullState?: boolean; // If true, this is a full state, not a delta
}

// Compute delta between two game states
export function computeStateDelta(
  previousState: GameState,
  currentState: GameState
): GameStateDelta {
  // If phase changed, send full state
  if (previousState.phase !== currentState.phase) {
    return {
      players: currentState.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        score: p.score,
        isCheater: p.isCheater,
        isBot: p.isBot,
        isSpectator: p.isSpectator,
        finished: p.finished
      })),
      phase: currentState.phase,
      fullState: true
    };
  }

  // Create a map of previous players for quick lookup
  const previousPlayersMap = new Map<string, Player>();
  previousState.players.forEach(p => previousPlayersMap.set(p.id, p));

  // Find changed players
  const playerDeltas: PlayerDelta[] = [];
  const currentPlayersMap = new Map<string, Player>();
  currentState.players.forEach(p => currentPlayersMap.set(p.id, p));

  // Check for new or changed players
  currentState.players.forEach(currentPlayer => {
    const previousPlayer = previousPlayersMap.get(currentPlayer.id);
    
    if (!previousPlayer) {
      // New player - include all fields
      playerDeltas.push({
        id: currentPlayer.id,
        name: currentPlayer.name,
        color: currentPlayer.color,
        score: currentPlayer.score,
        isCheater: currentPlayer.isCheater,
        isBot: currentPlayer.isBot,
        isSpectator: currentPlayer.isSpectator,
        finished: currentPlayer.finished
      });
    } else {
      // Existing player - only include changed fields
      const delta: PlayerDelta = { id: currentPlayer.id };
      let hasChanges = false;

      if (previousPlayer.name !== currentPlayer.name) {
        delta.name = currentPlayer.name;
        hasChanges = true;
      }
      if (previousPlayer.color !== currentPlayer.color) {
        delta.color = currentPlayer.color;
        hasChanges = true;
      }
      if (previousPlayer.score !== currentPlayer.score) {
        delta.score = currentPlayer.score;
        hasChanges = true;
      }
      if (previousPlayer.isCheater !== currentPlayer.isCheater) {
        delta.isCheater = currentPlayer.isCheater;
        hasChanges = true;
      }
      if (previousPlayer.isBot !== currentPlayer.isBot) {
        delta.isBot = currentPlayer.isBot;
        hasChanges = true;
      }
      if (previousPlayer.isSpectator !== currentPlayer.isSpectator) {
        delta.isSpectator = currentPlayer.isSpectator;
        hasChanges = true;
      }
      if (previousPlayer.finished !== currentPlayer.finished) {
        delta.finished = currentPlayer.finished;
        hasChanges = true;
      }

      if (hasChanges) {
        playerDeltas.push(delta);
      }
    }
  });

  // Check for removed players (players in previous but not in current)
  previousState.players.forEach(previousPlayer => {
    if (!currentPlayersMap.has(previousPlayer.id)) {
      // Player was removed - we handle this by not including them in the delta
      // The client will remove players not in the delta if fullState is false
    }
  });

  // Return undefined for players and phase if nothing changed
  if (playerDeltas.length === 0 && previousState.phase === currentState.phase) {
    return {
      players: undefined,
      phase: undefined
    };
  }

  // Only include phase if it changed
  const result: GameStateDelta = {
    players: playerDeltas.length > 0 ? playerDeltas : undefined
  };
  
  if (previousState.phase !== currentState.phase) {
    result.phase = currentState.phase;
  }

  return result;
}

// Apply delta to previous state to get current state
export function applyStateDelta(
  previousState: GameState,
  delta: GameStateDelta
): GameState {
  if (delta.fullState) {
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
      // New player - need all fields (shouldn't happen in delta, but handle it)
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

  // Remove players that are in previous but not in current (if delta indicates removal)
  // For simplicity, we keep all players unless explicitly removed
  // In a more sophisticated system, we'd track removals separately

  return {
    players: Array.from(playersMap.values()),
    phase: delta.phase || previousState.phase
  };
}
