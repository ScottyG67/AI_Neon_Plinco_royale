import { describe, it, expect, beforeEach } from 'vitest';
import {
  serializeGameState,
  serializeBallSpawn,
  serializeLaserData,
  serializeBallRemoved,
  deserializeGameState,
  deserializeBallSpawn,
  deserializeLaserData,
  deserializeBallRemoved
} from '../serializers';
import { GamePhase } from '../../types';

describe('server serializers', () => {
  const createPlayer = (id: string, score: number = 0) => ({
    id,
    name: `Player ${id}`,
    color: '#ff0000',
    score,
    finished: false,
    isSpectator: false,
    isCheater: false
  });

  describe('serializeGameState / deserializeGameState', () => {
    it('should serialize and deserialize game state', async () => {
      const players = [
        createPlayer('1', 100),
        createPlayer('2', 50)
      ];
      const phase = GamePhase.PLAYING;

      const buffer = await serializeGameState(players, phase);
      expect(buffer).toBeInstanceOf(Buffer);

      const deserialized = await deserializeGameState(buffer);
      expect(deserialized.players.length).toBe(2);
      expect(deserialized.phase).toBe(phase);
    });

    it('should preserve player data', async () => {
      const players = [
        createPlayer('1', 100),
        createPlayer('2', 50)
      ];

      const buffer = await serializeGameState(players, GamePhase.PLAYING);
      const deserialized = await deserializeGameState(buffer);

      expect(deserialized.players[0].id).toBe('1');
      expect(deserialized.players[0].score).toBe(100);
      expect(deserialized.players[1].id).toBe('2');
      expect(deserialized.players[1].score).toBe(50);
    });

    it('should handle different phases', async () => {
      const phases = [GamePhase.LOBBY, GamePhase.PLAYING, GamePhase.GAME_OVER];

      for (const phase of phases) {
        const buffer = await serializeGameState([], phase);
        const deserialized = await deserializeGameState(buffer);
        expect(deserialized.phase).toBe(phase);
      }
    });
  });

  describe('serializeBallSpawn / deserializeBallSpawn', () => {
    it('should serialize and deserialize ball spawn data', async () => {
      const data = {
        playerId: 'player-1',
        x: 300
      };

      const buffer = await serializeBallSpawn(data.playerId, data.x);
      expect(buffer).toBeInstanceOf(Buffer);

      const deserialized = await deserializeBallSpawn(buffer);
      expect(deserialized.playerId).toBe(data.playerId);
      expect(deserialized.x).toBe(data.x);
    });

    it('should handle different X positions', async () => {
      const positions = [0, 100, 300, 600];

      for (const x of positions) {
        const buffer = await serializeBallSpawn('player-1', x);
        const deserialized = await deserializeBallSpawn(buffer);
        expect(deserialized.x).toBe(x);
      }
    });
  });

  describe('serializeLaserData / deserializeLaserData', () => {
    it('should serialize and deserialize laser data', async () => {
      const data = {
        x1: 0,
        y1: 0,
        x2: 300,
        y2: 400,
        color: '#ff0000'
      };

      const buffer = await serializeLaserData(data);
      expect(buffer).toBeInstanceOf(Buffer);

      const deserialized = await deserializeLaserData(buffer);
      expect(deserialized.x1).toBe(data.x1);
      expect(deserialized.y1).toBe(data.y1);
      expect(deserialized.x2).toBe(data.x2);
      expect(deserialized.y2).toBe(data.y2);
      expect(deserialized.color).toBe(data.color);
    });
  });

  describe('serializeBallRemoved / deserializeBallRemoved', () => {
    it('should serialize and deserialize ball removed data', async () => {
      const ballId = 'ball-123';

      const buffer = await serializeBallRemoved(ballId);
      expect(buffer).toBeInstanceOf(Buffer);

      const deserialized = await deserializeBallRemoved(buffer);
      expect(deserialized.ballId).toBe(ballId);
    });
  });
});
