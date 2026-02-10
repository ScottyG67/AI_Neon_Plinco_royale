import { describe, it, expect } from 'vitest';
import { applyStateDelta, type GameState, type GameStateDelta } from '../stateSync';
import { GamePhase } from '../../types';

describe('stateSync', () => {
  const createPlayer = (id: string, score: number = 0, finished: boolean = false) => ({
    id,
    name: `Player ${id}`,
    color: '#ff0000',
    score,
    finished,
    isSpectator: false,
    isCheater: false
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
  });
});
