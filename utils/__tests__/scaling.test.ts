import { describe, it, expect } from 'vitest';
import { calculateScale, createScaleState } from '../scaling';

describe('scaling', () => {
  const LOGICAL_WIDTH = 600;
  const LOGICAL_HEIGHT = 800;

  describe('calculateScale', () => {
    it('should calculate scale to fit width', () => {
      const availableWidth = 1200;
      const availableHeight = 2000;
      const scale = calculateScale(availableWidth, availableHeight, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      // Should be limited by width: 1200 / 600 = 2, with 0.95 padding = 1.9
      expect(scale).toBeCloseTo(1.9, 2);
    });

    it('should calculate scale to fit height', () => {
      const availableWidth = 2000;
      const availableHeight = 1200;
      const scale = calculateScale(availableWidth, availableHeight, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      // Should be limited by height: 1200 / 800 = 1.5, with 0.95 padding = 1.425
      expect(scale).toBeCloseTo(1.425, 2);
    });

    it('should apply padding', () => {
      const availableWidth = 600;
      const availableHeight = 800;
      const scale = calculateScale(availableWidth, availableHeight, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      // Should be 1 * 0.95 = 0.95
      expect(scale).toBeCloseTo(0.95, 2);
    });

    it('should apply custom padding', () => {
      const availableWidth = 600;
      const availableHeight = 800;
      const scale = calculateScale(availableWidth, availableHeight, LOGICAL_WIDTH, LOGICAL_HEIGHT, {
        padding: 0.8
      });
      
      // Should be 1 * 0.8 = 0.8
      expect(scale).toBeCloseTo(0.8, 2);
    });

    it('should apply minimum threshold', () => {
      const availableWidth = 100;
      const availableHeight = 100;
      const scale = calculateScale(availableWidth, availableHeight, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      // Should be clamped to 0.3 (minScaleThreshold)
      expect(scale).toBe(0.3);
    });

    it('should apply custom minimum threshold', () => {
      const availableWidth = 100;
      const availableHeight = 100;
      const scale = calculateScale(availableWidth, availableHeight, LOGICAL_WIDTH, LOGICAL_HEIGHT, {
        minScaleThreshold: 0.5
      });
      
      // Should be clamped to 0.5
      expect(scale).toBe(0.5);
    });

    it('should apply minScale constraint', () => {
      const availableWidth = 600;
      const availableHeight = 800;
      const scale = calculateScale(availableWidth, availableHeight, LOGICAL_WIDTH, LOGICAL_HEIGHT, {
        minScale: 1.0
      });
      
      // Should be clamped to 1.0 minimum
      expect(scale).toBe(1.0);
    });

    it('should apply maxScale constraint', () => {
      const availableWidth = 6000;
      const availableHeight = 8000;
      const scale = calculateScale(availableWidth, availableHeight, LOGICAL_WIDTH, LOGICAL_HEIGHT, {
        maxScale: 2.0
      });
      
      // Should be clamped to 2.0 maximum
      expect(scale).toBe(2.0);
    });

    it('should handle zero dimensions', () => {
      const scale = calculateScale(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      expect(scale).toBe(0.3); // minScaleThreshold
    });

    it('should handle very small containers', () => {
      const scale = calculateScale(10, 10, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      expect(scale).toBe(0.3); // minScaleThreshold
    });

    it('should handle zero logical dimensions', () => {
      const scale = calculateScale(600, 800, 0, 0);
      expect(scale).toBe(1); // default fallback
    });

    it('should handle negative dimensions', () => {
      const scale = calculateScale(-100, -100, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      expect(scale).toBe(0.3); // minScaleThreshold
    });

    it('should prioritize minScaleThreshold over minScale', () => {
      const availableWidth = 100;
      const availableHeight = 100;
      const scale = calculateScale(availableWidth, availableHeight, LOGICAL_WIDTH, LOGICAL_HEIGHT, {
        minScale: 0.1,
        minScaleThreshold: 0.5
      });
      
      // minScaleThreshold should win
      expect(scale).toBe(0.5);
    });

    it('should handle exact fit', () => {
      const availableWidth = 600;
      const availableHeight = 800;
      const scale = calculateScale(availableWidth, availableHeight, LOGICAL_WIDTH, LOGICAL_HEIGHT, {
        padding: 1.0
      });
      
      expect(scale).toBe(1.0);
    });
  });

  describe('createScaleState', () => {
    it('should create initial scale state', () => {
      const state = createScaleState();
      
      expect(state.scale).toBe(1);
      expect(state.lastCalculated).toBeGreaterThan(0);
      expect(typeof state.lastCalculated).toBe('number');
    });
  });
});
