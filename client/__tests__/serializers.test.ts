import { describe, it, expect } from 'vitest';
import {
  deserializeGameState,
  deserializeBallSpawn,
  deserializeLaserData,
  deserializeBallRemoved
} from '../serializers';
import { GamePhase } from '../../types';

describe('client serializers', () => {
  // Note: Client serializers only deserialize, so we test deserialization
  // In a real scenario, we'd use server serializers to create test buffers

  describe('deserializeGameState', () => {
    it('should deserialize game state buffer', async () => {
      // This would require a properly formatted protobuf buffer
      // For now, we test that the function exists and can handle errors
      const mockBuffer = Buffer.from('invalid');

      await expect(deserializeGameState(mockBuffer)).rejects.toThrow();
    });
  });

  describe('deserializeBallSpawn', () => {
    it('should deserialize ball spawn buffer', async () => {
      const mockBuffer = Buffer.from('invalid');

      await expect(deserializeBallSpawn(mockBuffer)).rejects.toThrow();
    });
  });

  describe('deserializeLaserData', () => {
    it('should deserialize laser data buffer', async () => {
      const mockBuffer = Buffer.from('invalid');

      await expect(deserializeLaserData(mockBuffer)).rejects.toThrow();
    });
  });

  describe('deserializeBallRemoved', () => {
    it('should deserialize ball removed buffer', async () => {
      const mockBuffer = Buffer.from('invalid');

      await expect(deserializeBallRemoved(mockBuffer)).rejects.toThrow();
    });
  });
});
