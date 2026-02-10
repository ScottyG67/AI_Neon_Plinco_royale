import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectBounce,
  detectSensorCollision,
  createBounceDetectionState,
  createSensorDetectionState,
  resetSensorDetectionState,
  detectBoundaryEscape,
  createBoundaryBounds,
  createBoundaryBoundsMatter,
  type Vector3,
  type Sensor
} from '../collisionDetection';

describe('collisionDetection', () => {
  describe('detectBounce', () => {
    let state: ReturnType<typeof createBounceDetectionState>;

    beforeEach(() => {
      state = createBounceDetectionState();
    });

    it('should not detect bounce before ball starts falling', () => {
      const velocity: Vector3 = { x: 0, y: 0, z: 0 };
      const result = detectBounce(velocity, state, 1000);
      expect(result).toBe(false);
      expect(state.hasStartedFalling).toBe(false);
    });

    it('should detect bounce when Y velocity reverses downward to upward', () => {
      // Ball starts falling
      detectBounce({ x: 0, y: -5, z: 0 }, state, 1000);
      expect(state.hasStartedFalling).toBe(true);

      // Ball bounces up (Y velocity reverses)
      const result = detectBounce({ x: 0, y: 3, z: 0 }, state, 1150);
      expect(result).toBe(true);
    });

    it('should detect bounce when Y velocity reverses upward to downward', () => {
      // Ball starts falling
      detectBounce({ x: 0, y: -5, z: 0 }, state, 1000);
      
      // Ball bounces up
      detectBounce({ x: 0, y: 3, z: 0 }, state, 1150);
      
      // Ball falls again (Y velocity reverses from positive to negative)
      // Need sufficient time interval (150ms) and speed
      const result = detectBounce({ x: 0, y: -3, z: 0 }, state, 1350);
      expect(result).toBe(true);
    });

    it('should detect bounce when X velocity reverses (side collision)', () => {
      // Ball starts falling
      detectBounce({ x: 0, y: -5, z: 0 }, state, 1000);
      
      // Ball moving right
      detectBounce({ x: 3, y: -4, z: 0 }, state, 1100);
      
      // Ball hits side (X velocity reverses from positive to negative)
      const result = detectBounce({ x: -3, y: -4, z: 0 }, state, 1150);
      expect(result).toBe(true);
    });

    it('should not detect bounce if speed is too low', () => {
      detectBounce({ x: 0, y: -5, z: 0 }, state, 1000);
      
      const result = detectBounce({ x: 0, y: 0.5, z: 0 }, state, 1150);
      expect(result).toBe(false);
    });

    it('should throttle bounce detection based on interval', () => {
      detectBounce({ x: 0, y: -5, z: 0 }, state, 1000);
      
      // First bounce
      const result1 = detectBounce({ x: 0, y: 3, z: 0 }, state, 1150);
      expect(result1).toBe(true);
      
      // Second bounce too soon (should be throttled)
      const result2 = detectBounce({ x: 0, y: -3, z: 0 }, state, 1200);
      expect(result2).toBe(false);
      
      // Third bounce after interval (should work)
      const result3 = detectBounce({ x: 0, y: 3, z: 0 }, state, 1350);
      expect(result3).toBe(true);
    });

    it('should handle multiple bounces correctly', () => {
      detectBounce({ x: 0, y: -5, z: 0 }, state, 1000);
      
      // Bounce 1 (down to up)
      expect(detectBounce({ x: 0, y: 3, z: 0 }, state, 1150)).toBe(true);
      
      // Bounce 2 (up to down, after interval)
      expect(detectBounce({ x: 0, y: -3, z: 0 }, state, 1350)).toBe(true);
      
      // Bounce 3 (down to up, after interval)
      expect(detectBounce({ x: 0, y: 3, z: 0 }, state, 1550)).toBe(true);
    });
  });

  describe('detectSensorCollision', () => {
    let state: ReturnType<typeof createSensorDetectionState>;
    const ballRadius = 12.5;

    beforeEach(() => {
      state = createSensorDetectionState();
    });

    it('should detect collision when ball is inside sensor bounds', () => {
      const sensors: Sensor[] = [
        {
          position: [0, 0, 0],
          size: [100, 40, 10],
          points: 100,
          index: 0
        }
      ];

      const ballPosition: Vector3 = { x: 0, y: 0, z: 0 };
      const result = detectSensorCollision(ballPosition, ballRadius, sensors, state);

      expect(result).not.toBeNull();
      expect(result?.points).toBe(100);
      expect(state.contactedSensors.has(0)).toBe(true);
    });

    it('should not detect collision when ball is outside sensor bounds', () => {
      const sensors: Sensor[] = [
        {
          position: [0, 0, 0],
          size: [100, 40, 10],
          points: 100,
          index: 0
        }
      ];

      const ballPosition: Vector3 = { x: 200, y: 0, z: 0 };
      const result = detectSensorCollision(ballPosition, ballRadius, sensors, state);

      expect(result).toBeNull();
      expect(state.contactedSensors.has(0)).toBe(false);
    });

    it('should detect collision at sensor edge (with ball radius tolerance)', () => {
      const sensors: Sensor[] = [
        {
          position: [0, 0, 0],
          size: [100, 40, 10],
          points: 100,
          index: 0
        }
      ];

      // Ball at edge of sensor (50 + 12.5 = 62.5 from center)
      const ballPosition: Vector3 = { x: 62.5, y: 0, z: 0 };
      const result = detectSensorCollision(ballPosition, ballRadius, sensors, state);

      expect(result).not.toBeNull();
      expect(result?.points).toBe(100);
    });

    it('should not detect same sensor twice', () => {
      const sensors: Sensor[] = [
        {
          position: [0, 0, 0],
          size: [100, 40, 10],
          points: 100,
          index: 0
        }
      ];

      const ballPosition: Vector3 = { x: 0, y: 0, z: 0 };
      
      // First detection
      const result1 = detectSensorCollision(ballPosition, ballRadius, sensors, state);
      expect(result1).not.toBeNull();
      
      // Second detection (should return null)
      const result2 = detectSensorCollision(ballPosition, ballRadius, sensors, state);
      expect(result2).toBeNull();
    });

    it('should detect collision with correct sensor when multiple sensors exist', () => {
      const sensors: Sensor[] = [
        {
          position: [-100, 0, 0],
          size: [100, 40, 10],
          points: 10,
          index: 0
        },
        {
          position: [0, 0, 0],
          size: [100, 40, 10],
          points: 100,
          index: 1
        },
        {
          position: [100, 0, 0],
          size: [100, 40, 10],
          points: 10,
          index: 2
        }
      ];

      // Ball in middle sensor
      const ballPosition: Vector3 = { x: 0, y: 0, z: 0 };
      const result = detectSensorCollision(ballPosition, ballRadius, sensors, state);

      expect(result).not.toBeNull();
      expect(result?.points).toBe(100);
      expect(result?.index).toBe(1);
      expect(state.contactedSensors.has(1)).toBe(true);
      expect(state.contactedSensors.has(0)).toBe(false);
      expect(state.contactedSensors.has(2)).toBe(false);
    });

    it('should handle sensors at different Y positions', () => {
      const sensors: Sensor[] = [
        {
          position: [0, -50, 0],
          size: [100, 40, 10],
          points: 50,
          index: 0
        },
        {
          position: [0, 50, 0],
          size: [100, 40, 10],
          points: 100,
          index: 1
        }
      ];

      // Ball in lower sensor
      const ballPosition: Vector3 = { x: 0, y: -50, z: 0 };
      const result = detectSensorCollision(ballPosition, ballRadius, sensors, state);

      expect(result).not.toBeNull();
      expect(result?.points).toBe(50);
      expect(result?.index).toBe(0);
    });

    it('should detect collision with sensor at realistic game position (Y = -320)', () => {
      // Simulate sensor position as calculated in game: LOGICAL_HEIGHT/2 - sensorY = 400 - 720 = -320
      const sensors: Sensor[] = [
        {
          position: [0, -320, 0], // Realistic sensor Y position
          size: [75.7, 40, 10], // Realistic sensor size (bucketWidth - 8, sensorHeight, 10)
          points: 100,
          index: 0
        }
      ];

      // Ball at sensor center
      const ballPosition: Vector3 = { x: 0, y: -320, z: 0 };
      const result = detectSensorCollision(ballPosition, ballRadius, sensors, state);

      expect(result).not.toBeNull();
      expect(result?.points).toBe(100);
      expect(result?.index).toBe(0);
    });

    it('should detect collision when ball is slightly above sensor (falling into it)', () => {
      const sensors: Sensor[] = [
        {
          position: [0, -320, 0],
          size: [75.7, 40, 10],
          points: 100,
          index: 0
        }
      ];

      // Ball slightly above sensor center (falling down)
      const ballPosition: Vector3 = { x: 0, y: -300, z: 0 };
      const result = detectSensorCollision(ballPosition, ballRadius, sensors, state);

      expect(result).not.toBeNull();
      expect(result?.points).toBe(100);
    });
  });

  describe('state management', () => {
    it('should create initial bounce detection state', () => {
      const state = createBounceDetectionState();
      expect(state.prevVelocity).toEqual({ x: 0, y: 0, z: 0 });
      expect(state.lastBounceTime).toBe(0);
      expect(state.hasStartedFalling).toBe(false);
    });

    it('should create initial sensor detection state', () => {
      const state = createSensorDetectionState();
      expect(state.contactedSensors.size).toBe(0);
    });

    it('should reset sensor detection state', () => {
      const state = createSensorDetectionState();
      state.contactedSensors.add(0);
      state.contactedSensors.add(1);
      
      expect(state.contactedSensors.size).toBe(2);
      
      resetSensorDetectionState(state);
      expect(state.contactedSensors.size).toBe(0);
    });
  });

  describe('detectBoundaryEscape', () => {
    const LOGICAL_WIDTH = 600;
    const LOGICAL_HEIGHT = 800;
    const ballRadius = 12.5;

    it('should detect escape from left boundary', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: bounds.left - 1, y: 0, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(true);
    });

    it('should detect escape from right boundary', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: bounds.right + 1, y: 0, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(true);
    });

    it('should detect escape from top boundary', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: 0, y: bounds.top + 1, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(true);
    });

    it('should detect escape from bottom boundary', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: 0, y: bounds.bottom - 1, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(true);
    });

    it('should not detect escape when ball is inside bounds', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: 0, y: 0, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(false);
    });

    it('should not detect escape when ball is at left boundary edge', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: bounds.left, y: 0, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(false);
    });

    it('should not detect escape when ball is at right boundary edge', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: bounds.right, y: 0, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(false);
    });

    it('should not detect escape when ball is at top boundary edge', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: 0, y: bounds.top, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(false);
    });

    it('should not detect escape when ball is at bottom boundary edge', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: 0, y: bounds.bottom, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(false);
    });

    it('should detect escape with different ball radius', () => {
      const smallRadius = 5;
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, smallRadius);
      const ballPosition: Vector3 = { x: bounds.left - 1, y: 0, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, smallRadius, bounds);
      expect(escaped).toBe(true);
    });

    it('should detect escape from corner (left and top)', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: bounds.left - 1, y: bounds.top + 1, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(true);
    });
  });

  describe('createBoundaryBounds', () => {
    const LOGICAL_WIDTH = 600;
    const LOGICAL_HEIGHT = 800;
    const ballRadius = 12.5;

    it('should create correct boundary bounds', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      
      expect(bounds.left).toBe(-LOGICAL_WIDTH / 2 - ballRadius);
      expect(bounds.right).toBe(LOGICAL_WIDTH / 2 + ballRadius);
      expect(bounds.top).toBe(LOGICAL_HEIGHT / 2 + ballRadius);
      expect(bounds.bottom).toBe(-LOGICAL_HEIGHT / 2 - ballRadius);
    });

    it('should apply top extension', () => {
      const topExtension = 100;
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius, topExtension);
      
      expect(bounds.top).toBe(LOGICAL_HEIGHT / 2 + ballRadius + topExtension);
      expect(bounds.left).toBe(-LOGICAL_WIDTH / 2 - ballRadius);
      expect(bounds.right).toBe(LOGICAL_WIDTH / 2 + ballRadius);
      expect(bounds.bottom).toBe(-LOGICAL_HEIGHT / 2 - ballRadius);
    });

    it('should handle zero top extension', () => {
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius, 0);
      
      expect(bounds.top).toBe(LOGICAL_HEIGHT / 2 + ballRadius);
    });

    it('should handle different ball radii', () => {
      const smallRadius = 5;
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, smallRadius);
      
      expect(bounds.left).toBe(-LOGICAL_WIDTH / 2 - smallRadius);
      expect(bounds.right).toBe(LOGICAL_WIDTH / 2 + smallRadius);
      expect(bounds.top).toBe(LOGICAL_HEIGHT / 2 + smallRadius);
      expect(bounds.bottom).toBe(-LOGICAL_HEIGHT / 2 - smallRadius);
    });

    it('should handle large ball radius', () => {
      const largeRadius = 100;
      const bounds = createBoundaryBounds(LOGICAL_WIDTH, LOGICAL_HEIGHT, largeRadius);
      
      expect(bounds.left).toBe(-LOGICAL_WIDTH / 2 - largeRadius);
      expect(bounds.right).toBe(LOGICAL_WIDTH / 2 + largeRadius);
    });
  });

  describe('createBoundaryBoundsMatter', () => {
    const LOGICAL_WIDTH = 600;
    const LOGICAL_HEIGHT = 800;
    const ballRadius = 12.5;

    it('should create correct boundary bounds for Matter.js coordinate system', () => {
      const bounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      
      // Matter.js: top-left origin, Y increases downward
      expect(bounds.left).toBe(-ballRadius); // Left boundary
      expect(bounds.right).toBe(LOGICAL_WIDTH + ballRadius); // Right boundary
      expect(bounds.top).toBe(-ballRadius); // Top boundary (negative/zero)
      expect(bounds.bottom).toBe(LOGICAL_HEIGHT + ballRadius); // Bottom boundary (positive)
    });

    it('should apply top extension for Matter.js', () => {
      const topExtension = 100;
      const bounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius, topExtension);
      
      expect(bounds.top).toBe(-ballRadius - topExtension); // -112.5
      expect(bounds.bottom).toBe(LOGICAL_HEIGHT + ballRadius); // 812.5
      expect(bounds.left).toBe(-ballRadius);
      expect(bounds.right).toBe(LOGICAL_WIDTH + ballRadius);
    });

    it('should handle ball release position (Y = -30) with top extension', () => {
      const topExtension = 100;
      const bounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius, topExtension);
      
      // Ball released at Y = -30 should be within bounds
      // Top boundary = -112.5, so -30 > -112.5, ball is within bounds
      const ballPosition: Vector3 = { x: LOGICAL_WIDTH / 2, y: -30, z: 0 };
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      
      expect(escaped).toBe(false); // Should NOT escape
      expect(bounds.top).toBe(-112.5); // Verify top boundary
    });

    it('should detect escape when ball goes above top boundary (Matter.js)', () => {
      const topExtension = 100;
      const bounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius, topExtension);
      
      // Ball above top boundary (Y < top)
      const ballPosition: Vector3 = { x: LOGICAL_WIDTH / 2, y: bounds.top - 1, z: 0 };
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      
      expect(escaped).toBe(true);
    });

    it('should detect escape when ball goes below bottom boundary (Matter.js)', () => {
      const bounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      
      // Ball below bottom boundary (Y > bottom)
      const ballPosition: Vector3 = { x: LOGICAL_WIDTH / 2, y: bounds.bottom + 1, z: 0 };
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      
      expect(escaped).toBe(true);
    });

    it('should detect escape from left boundary (Matter.js)', () => {
      const bounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: bounds.left - 1, y: LOGICAL_HEIGHT / 2, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(true);
    });

    it('should detect escape from right boundary (Matter.js)', () => {
      const bounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius);
      const ballPosition: Vector3 = { x: bounds.right + 1, y: LOGICAL_HEIGHT / 2, z: 0 };
      
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      expect(escaped).toBe(true);
    });

    it('should not detect escape when ball is inside bounds (Matter.js)', () => {
      const topExtension = 100;
      const bounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius, topExtension);
      
      // Ball at center of play area
      const ballPosition: Vector3 = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2, z: 0 };
      const escaped = detectBoundaryEscape(ballPosition, ballRadius, bounds);
      
      expect(escaped).toBe(false);
    });

    it('should not detect escape at boundary edges (Matter.js)', () => {
      const topExtension = 100;
      const bounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius, topExtension);
      
      // Ball at top boundary edge
      const ballAtTop: Vector3 = { x: LOGICAL_WIDTH / 2, y: bounds.top, z: 0 };
      expect(detectBoundaryEscape(ballAtTop, ballRadius, bounds)).toBe(false);
      
      // Ball at bottom boundary edge
      const ballAtBottom: Vector3 = { x: LOGICAL_WIDTH / 2, y: bounds.bottom, z: 0 };
      expect(detectBoundaryEscape(ballAtBottom, ballRadius, bounds)).toBe(false);
      
      // Ball at left boundary edge
      const ballAtLeft: Vector3 = { x: bounds.left, y: LOGICAL_HEIGHT / 2, z: 0 };
      expect(detectBoundaryEscape(ballAtLeft, ballRadius, bounds)).toBe(false);
      
      // Ball at right boundary edge
      const ballAtRight: Vector3 = { x: bounds.right, y: LOGICAL_HEIGHT / 2, z: 0 };
      expect(detectBoundaryEscape(ballAtRight, ballRadius, bounds)).toBe(false);
    });

    it('should handle realistic ball release scenario', () => {
      const topExtension = 100;
      const bounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, ballRadius, topExtension);
      
      // Ball released at typical drop position: X = 300 (center), Y = -30 (above top)
      const releasePosition: Vector3 = { x: 300, y: -30, z: 0 };
      const escaped = detectBoundaryEscape(releasePosition, ballRadius, bounds);
      
      // Should NOT escape because -30 > -112.5 (top boundary)
      expect(escaped).toBe(false);
      expect(bounds.top).toBe(-112.5);
    });
  });
});
