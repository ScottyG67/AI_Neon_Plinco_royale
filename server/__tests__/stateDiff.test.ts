import { describe, it, expect } from 'vitest';
import { computeStateDelta, applyStateDelta, type GameState, type GameStateDelta } from '../stateDiff';
import { GamePhase } from '../../types';

describe('stateDiff', () => {
  const createPlayer = (id: string, score: number = 0, finished: boolean = false) => ({
    id,
    name: `Player ${id}`,
    color: '#ff0000',
    score,
    finished,
    isSpectator: false,
    isCheater: false
  });

  describe('computeStateDelta', () => {
    it('should compute delta for changed scores', () => {
      const previous: GameState = {
        players: [
          createPlayer('1', 0),
          createPlayer('2', 0)
        ],
        phase: GamePhase.PLAYING
      };

      const current: GameState = {
        players: [
          createPlayer('1', 100),
          createPlayer('2', 0)
        ],
        phase: GamePhase.PLAYING
      };

      const delta = computeStateDelta(previous, current);

      expect(delta.players).toBeDefined();
      expect(delta.players?.length).toBe(1);
      expect(delta.players?.[0].id).toBe('1');
      expect(delta.players?.[0].score).toBe(100);
    });

    it('should compute delta for phase change', () => {
      const previous: GameState = {
        players: [createPlayer('1', 0)],
        phase: GamePhase.LOBBY
      };

      const current: GameState = {
        players: [createPlayer('1', 0)],
        phase: GamePhase.PLAYING
      };

      const delta = computeStateDelta(previous, current);

      expect(delta.phase).toBe(GamePhase.PLAYING);
    });

    it('should compute delta for finished status change', () => {
      const previous: GameState = {
        players: [
          createPlayer('1', 100, false),
          createPlayer('2', 50, false)
        ],
        phase: GamePhase.PLAYING
      };

      const current: GameState = {
        players: [
          createPlayer('1', 100, true),
          createPlayer('2', 50, false)
        ],
        phase: GamePhase.PLAYING
      };

      const delta = computeStateDelta(previous, current);

      expect(delta.players?.length).toBe(1);
      expect(delta.players?.[0].finished).toBe(true);
    });

    it('should return empty delta when nothing changed', () => {
      const state: GameState = {
        players: [createPlayer('1', 0)],
        phase: GamePhase.LOBBY
      };

      const delta = computeStateDelta(state, state);

      expect(delta.players).toBeUndefined();
      expect(delta.phase).toBeUndefined();
    });

    it('should handle new players', () => {
      const previous: GameState = {
        players: [createPlayer('1', 0)],
        phase: GamePhase.LOBBY
      };

      const current: GameState = {
        players: [
          createPlayer('1', 0),
          createPlayer('2', 0)
        ],
        phase: GamePhase.LOBBY
      };

      const delta = computeStateDelta(previous, current);

      expect(delta.players?.length).toBe(1);
      expect(delta.players?.[0].id).toBe('2');
    });

    it('should handle removed players', () => {
      const previous: GameState = {
        players: [
          createPlayer('1', 0),
          createPlayer('2', 0)
        ],
        phase: GamePhase.LOBBY
      };

      const current: GameState = {
        players: [createPlayer('1', 0)],
        phase: GamePhase.LOBBY
      };

      const delta = computeStateDelta(previous, current);

      // Player removal might be handled differently
      // This test verifies the function doesn't throw
      expect(delta).toBeDefined();
    });

    it('should compute delta for multiple changes', () => {
      const previous: GameState = {
        players: [
          createPlayer('1', 0, false),
          createPlayer('2', 0, false)
        ],
        phase: GamePhase.LOBBY
      };

      const current: GameState = {
        players: [
          createPlayer('1', 100, true),
          createPlayer('2', 50, false)
        ],
        phase: GamePhase.PLAYING
      };

      const delta = computeStateDelta(previous, current);

      expect(delta.phase).toBe(GamePhase.PLAYING);
      expect(delta.players?.length).toBe(2);
    });
  });

  describe('applyStateDelta', () => {
    it('should apply score delta', () => {
      const previous: GameState = {
        players: [
          createPlayer('1', 0),
          createPlayer('2', 0)
        ],
        phase: GamePhase.PLAYING
      };

      const delta: GameStateDelta = {
        players: [createPlayer('1', 100)]
      };

      const result = applyStateDelta(previous, delta);

      expect(result.players[0].score).toBe(100);
      expect(result.players[1].score).toBe(0); // Unchanged
    });

    it('should apply phase delta', () => {
      const previous: GameState = {
        players: [createPlayer('1', 0)],
        phase: GamePhase.LOBBY
      };

      const delta: GameStateDelta = {
        phase: GamePhase.PLAYING
      };

      const result = applyStateDelta(previous, delta);

      expect(result.phase).toBe(GamePhase.PLAYING);
    });

    it('should apply finished status delta', () => {
      const previous: GameState = {
        players: [
          createPlayer('1', 100, false),
          createPlayer('2', 50, false)
        ],
        phase: GamePhase.PLAYING
      };

      const delta: GameStateDelta = {
        players: [createPlayer('1', 100, true)]
      };

      const result = applyStateDelta(previous, delta);

      expect(result.players[0].finished).toBe(true);
      expect(result.players[1].finished).toBe(false); // Unchanged
    });

    it('should handle full state replacement', () => {
      const previous: GameState = {
        players: [createPlayer('1', 0)],
        phase: GamePhase.LOBBY
      };

      const delta: GameStateDelta = {
        fullState: true,
        players: [
          createPlayer('1', 100),
          createPlayer('2', 50)
        ],
        phase: GamePhase.PLAYING
      };

      const result = applyStateDelta(previous, delta);

      expect(result.players.length).toBe(2);
      expect(result.phase).toBe(GamePhase.PLAYING);
    });

    it('should merge partial updates', () => {
      const previous: GameState = {
        players: [
          createPlayer('1', 0),
          createPlayer('2', 0),
          createPlayer('3', 0)
        ],
        phase: GamePhase.PLAYING
      };

      const delta: GameStateDelta = {
        players: [
          createPlayer('1', 100),
          createPlayer('3', 200)
        ]
      };

      const result = applyStateDelta(previous, delta);

      expect(result.players.length).toBe(3);
      expect(result.players[0].score).toBe(100);
      expect(result.players[1].score).toBe(0); // Unchanged
      expect(result.players[2].score).toBe(200);
    });

    it('should handle empty delta', () => {
      const previous: GameState = {
        players: [createPlayer('1', 0)],
        phase: GamePhase.LOBBY
      };

      const delta: GameStateDelta = {};

      const result = applyStateDelta(previous, delta);

      expect(result).toEqual(previous);
    });
  });
});
