import { describe, it, expect, beforeEach } from 'vitest';
import {
  createLaser,
  filterExpiredLasers,
  calculateLaserOpacity,
  calculateLaserLineWidth,
  LASER_LIFETIME_MS
} from '../laserHandling';
import { Laser } from '../../types/game';

describe('laserHandling', () => {
  let baseTime: number;

  beforeEach(() => {
    baseTime = Date.now();
  });

  describe('createLaser', () => {
    it('should create a laser with correct properties', () => {
      const laser = createLaser(0, 0, 100, 100, '#ff0000');

      expect(laser.x1).toBe(0);
      expect(laser.y1).toBe(0);
      expect(laser.x2).toBe(100);
      expect(laser.y2).toBe(100);
      expect(laser.color).toBe('#ff0000');
      expect(laser.id).toBeDefined();
      expect(typeof laser.id).toBe('string');
      expect(laser.createdAt).toBeGreaterThan(0);
    });

    it('should generate unique IDs for each laser', () => {
      const laser1 = createLaser(0, 0, 100, 100, '#ff0000');
      const laser2 = createLaser(0, 0, 100, 100, '#ff0000');

      expect(laser1.id).not.toBe(laser2.id);
    });

    it('should set createdAt timestamp', () => {
      const before = Date.now();
      const laser = createLaser(0, 0, 100, 100, '#ff0000');
      const after = Date.now();

      expect(laser.createdAt).toBeGreaterThanOrEqual(before);
      expect(laser.createdAt).toBeLessThanOrEqual(after);
    });
  });

  describe('filterExpiredLasers', () => {
    it('should keep active lasers', () => {
      const lasers: Laser[] = [
        {
          id: '1',
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 100,
          color: '#ff0000',
          createdAt: baseTime - 50 // 50ms ago
        },
        {
          id: '2',
          x1: 0,
          y1: 0,
          x2: 200,
          y2: 200,
          color: '#00ff00',
          createdAt: baseTime - 100 // 100ms ago
        }
      ];

      const filtered = filterExpiredLasers(lasers, baseTime);

      expect(filtered.length).toBe(2);
      expect(filtered).toEqual(lasers);
    });

    it('should remove expired lasers', () => {
      const lasers: Laser[] = [
        {
          id: '1',
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 100,
          color: '#ff0000',
          createdAt: baseTime - 50 // 50ms ago - active
        },
        {
          id: '2',
          x1: 0,
          y1: 0,
          x2: 200,
          y2: 200,
          color: '#00ff00',
          createdAt: baseTime - 250 // 250ms ago - expired
        }
      ];

      const filtered = filterExpiredLasers(lasers, baseTime);

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should remove lasers at exactly lifetime threshold', () => {
      const lasers: Laser[] = [
        {
          id: '1',
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 100,
          color: '#ff0000',
          createdAt: baseTime - LASER_LIFETIME_MS // Exactly at threshold
        }
      ];

      const filtered = filterExpiredLasers(lasers, baseTime);

      expect(filtered.length).toBe(0);
    });

    it('should use custom lifetime when provided', () => {
      const customLifetime = 500;
      const lasers: Laser[] = [
        {
          id: '1',
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 100,
          color: '#ff0000',
          createdAt: baseTime - 300 // 300ms ago
        }
      ];

      // With default lifetime (200ms), this would be expired
      const filteredDefault = filterExpiredLasers(lasers, baseTime, LASER_LIFETIME_MS);
      expect(filteredDefault.length).toBe(0);

      // With custom lifetime (500ms), this should be active
      const filteredCustom = filterExpiredLasers(lasers, baseTime, customLifetime);
      expect(filteredCustom.length).toBe(1);
    });

    it('should handle empty array', () => {
      const filtered = filterExpiredLasers([], baseTime);
      expect(filtered.length).toBe(0);
    });
  });

  describe('calculateLaserOpacity', () => {
    it('should return 1.0 for newly created laser', () => {
      const laser: Laser = {
        id: '1',
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
        color: '#ff0000',
        createdAt: baseTime
      };

      const opacity = calculateLaserOpacity(laser, baseTime);
      expect(opacity).toBe(1.0);
    });

    it('should return 0.5 for laser at half lifetime', () => {
      const laser: Laser = {
        id: '1',
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
        color: '#ff0000',
        createdAt: baseTime - LASER_LIFETIME_MS / 2
      };

      const opacity = calculateLaserOpacity(laser, baseTime);
      expect(opacity).toBeCloseTo(0.5, 2);
    });

    it('should return 0.0 for expired laser', () => {
      const laser: Laser = {
        id: '1',
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
        color: '#ff0000',
        createdAt: baseTime - LASER_LIFETIME_MS
      };

      const opacity = calculateLaserOpacity(laser, baseTime);
      expect(opacity).toBe(0.0);
    });

    it('should return 0.0 for laser beyond lifetime', () => {
      const laser: Laser = {
        id: '1',
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
        color: '#ff0000',
        createdAt: baseTime - LASER_LIFETIME_MS * 2
      };

      const opacity = calculateLaserOpacity(laser, baseTime);
      expect(opacity).toBe(0.0);
    });

    it('should use custom lifetime when provided', () => {
      const customLifetime = 1000;
      const laser: Laser = {
        id: '1',
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
        color: '#ff0000',
        createdAt: baseTime - 500 // 500ms ago
      };

      const opacity = calculateLaserOpacity(laser, baseTime, customLifetime);
      expect(opacity).toBeCloseTo(0.5, 2);
    });
  });

  describe('calculateLaserLineWidth', () => {
    it('should return base width for full opacity', () => {
      const width = calculateLaserLineWidth(4, 1.0);
      expect(width).toBe(4);
    });

    it('should return half width for half opacity', () => {
      const width = calculateLaserLineWidth(4, 0.5);
      expect(width).toBe(2);
    });

    it('should return zero for zero opacity', () => {
      const width = calculateLaserLineWidth(4, 0.0);
      expect(width).toBe(0);
    });

    it('should handle different base widths', () => {
      expect(calculateLaserLineWidth(10, 0.5)).toBe(5);
      expect(calculateLaserLineWidth(8, 0.25)).toBe(2);
    });
  });
});
