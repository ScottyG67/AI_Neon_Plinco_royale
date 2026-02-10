import { describe, it, expect } from 'vitest';
import {
  screenToLogical,
  logicalToScreen,
  clampToPlayArea,
  type ContainerRect
} from '../coordinateConversion';

describe('coordinateConversion', () => {
  const LOGICAL_WIDTH = 600;
  const LOGICAL_HEIGHT = 800;

  describe('screenToLogical', () => {
    const containerRect: ContainerRect = {
      left: 100,
      top: 50,
      width: 600,
      height: 800
    };
    const scale = 1.0;

    it('should convert center screen coordinates to center logical coordinates', () => {
      const centerX = containerRect.left + containerRect.width / 2; // 400
      const centerY = containerRect.top + containerRect.height / 2; // 450
      
      const result = screenToLogical(centerX, centerY, containerRect, scale, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      expect(result.x).toBeCloseTo(LOGICAL_WIDTH / 2, 2); // 300
      expect(result.y).toBeCloseTo(LOGICAL_HEIGHT / 2, 2); // 400
    });

    it('should convert top-left screen coordinates to top-left logical coordinates', () => {
      const screenX = containerRect.left; // 100
      const screenY = containerRect.top; // 50
      
      const result = screenToLogical(screenX, screenY, containerRect, scale, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      // Should be at logical (0, LOGICAL_HEIGHT)
      expect(result.x).toBeCloseTo(0, 2);
      expect(result.y).toBeCloseTo(LOGICAL_HEIGHT, 2);
    });

    it('should convert bottom-right screen coordinates to bottom-right logical coordinates', () => {
      const screenX = containerRect.left + containerRect.width; // 700
      const screenY = containerRect.top + containerRect.height; // 850
      
      const result = screenToLogical(screenX, screenY, containerRect, scale, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      // Should be at logical (LOGICAL_WIDTH, 0)
      expect(result.x).toBeCloseTo(LOGICAL_WIDTH, 2);
      expect(result.y).toBeCloseTo(0, 2);
    });

    it('should account for scale factor', () => {
      const centerX = containerRect.left + containerRect.width / 2;
      const centerY = containerRect.top + containerRect.height / 2;
      const scaled = 2.0;
      
      // Move 100 pixels right on screen
      const screenX = centerX + 100;
      const screenY = centerY;
      
      const result = screenToLogical(screenX, screenY, containerRect, scaled, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      // With scale 2, 100 screen pixels = 50 logical pixels
      expect(result.x).toBeCloseTo(LOGICAL_WIDTH / 2 + 50, 2);
    });

    it('should handle negative screen coordinates', () => {
      const result = screenToLogical(-100, -100, containerRect, scale, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      // Should result in negative logical coordinates
      expect(result.x).toBeLessThan(0);
      expect(result.y).toBeGreaterThan(LOGICAL_HEIGHT);
    });
  });

  describe('logicalToScreen', () => {
    const containerRect: ContainerRect = {
      left: 100,
      top: 50,
      width: 600,
      height: 800
    };
    const scale = 1.0;

    it('should convert center logical coordinates to center screen coordinates', () => {
      const logicalX = LOGICAL_WIDTH / 2;
      const logicalY = LOGICAL_HEIGHT / 2;
      
      const result = logicalToScreen(logicalX, logicalY, containerRect, scale, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      const centerX = containerRect.left + containerRect.width / 2;
      const centerY = containerRect.top + containerRect.height / 2;
      
      expect(result.x).toBeCloseTo(centerX, 2);
      expect(result.y).toBeCloseTo(centerY, 2);
    });

    it('should convert top-left logical coordinates to top-left screen coordinates', () => {
      const logicalX = 0;
      const logicalY = LOGICAL_HEIGHT;
      
      const result = logicalToScreen(logicalX, logicalY, containerRect, scale, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      expect(result.x).toBeCloseTo(containerRect.left, 2);
      expect(result.y).toBeCloseTo(containerRect.top, 2);
    });

    it('should convert bottom-right logical coordinates to bottom-right screen coordinates', () => {
      const logicalX = LOGICAL_WIDTH;
      const logicalY = 0;
      
      const result = logicalToScreen(logicalX, logicalY, containerRect, scale, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      expect(result.x).toBeCloseTo(containerRect.left + containerRect.width, 2);
      expect(result.y).toBeCloseTo(containerRect.top + containerRect.height, 2);
    });

    it('should account for scale factor', () => {
      const logicalX = LOGICAL_WIDTH / 2 + 50;
      const logicalY = LOGICAL_HEIGHT / 2;
      const scaled = 2.0;
      
      const result = logicalToScreen(logicalX, logicalY, containerRect, scaled, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      const centerX = containerRect.left + containerRect.width / 2;
      // With scale 2, 50 logical pixels = 100 screen pixels
      expect(result.x).toBeCloseTo(centerX + 100, 2);
    });

    it('should be inverse of screenToLogical', () => {
      const screenX = 350;
      const screenY = 500;
      
      const logical = screenToLogical(screenX, screenY, containerRect, scale, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      const backToScreen = logicalToScreen(logical.x, logical.y, containerRect, scale, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      expect(backToScreen.x).toBeCloseTo(screenX, 1);
      expect(backToScreen.y).toBeCloseTo(screenY, 1);
    });
  });

  describe('clampToPlayArea', () => {
    it('should not clamp coordinates within bounds', () => {
      const x = 300;
      const y = 400;
      const result = clampToPlayArea(x, y, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      
      expect(result.x).toBe(300);
      expect(result.y).toBe(400);
    });

    it('should clamp X coordinate that is too small', () => {
      const x = 10;
      const y = 400;
      const result = clampToPlayArea(x, y, LOGICAL_WIDTH, LOGICAL_HEIGHT, 20);
      
      expect(result.x).toBe(20);
      expect(result.y).toBe(400);
    });

    it('should clamp X coordinate that is too large', () => {
      const x = 590;
      const y = 400;
      const result = clampToPlayArea(x, y, LOGICAL_WIDTH, LOGICAL_HEIGHT, 20);
      
      expect(result.x).toBe(580);
      expect(result.y).toBe(400);
    });

    it('should clamp Y coordinate that is too small', () => {
      const x = 300;
      const y = 10;
      const result = clampToPlayArea(x, y, LOGICAL_WIDTH, LOGICAL_HEIGHT, 20);
      
      expect(result.x).toBe(300);
      expect(result.y).toBe(20);
    });

    it('should clamp Y coordinate that is too large', () => {
      const x = 300;
      const y = 790;
      const result = clampToPlayArea(x, y, LOGICAL_WIDTH, LOGICAL_HEIGHT, 20);
      
      expect(result.x).toBe(300);
      expect(result.y).toBe(780);
    });

    it('should clamp both coordinates', () => {
      const x = 5;
      const y = 5;
      const result = clampToPlayArea(x, y, LOGICAL_WIDTH, LOGICAL_HEIGHT, 20);
      
      expect(result.x).toBe(20);
      expect(result.y).toBe(20);
    });

    it('should use custom padding', () => {
      const x = 10;
      const y = 10;
      const result = clampToPlayArea(x, y, LOGICAL_WIDTH, LOGICAL_HEIGHT, 50);
      
      expect(result.x).toBe(50);
      expect(result.y).toBe(50);
    });

    it('should handle negative coordinates', () => {
      const x = -100;
      const y = -100;
      const result = clampToPlayArea(x, y, LOGICAL_WIDTH, LOGICAL_HEIGHT, 20);
      
      expect(result.x).toBe(20);
      expect(result.y).toBe(20);
    });

    it('should handle coordinates way outside bounds', () => {
      const x = 10000;
      const y = 10000;
      const result = clampToPlayArea(x, y, LOGICAL_WIDTH, LOGICAL_HEIGHT, 20);
      
      expect(result.x).toBe(580);
      expect(result.y).toBe(780);
    });
  });
});
