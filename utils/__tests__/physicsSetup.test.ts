import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// @vitest-environment jsdom
import Matter from 'matter-js';
import {
  createPhysicsWorld,
  createWorldObjects,
  createWalls,
  createPegsAndSensors,
  createPegs,
  type PhysicsWorld
} from '../physicsSetup';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../gameConstants';
import { POINT_DISTRIBUTION, CATEGORY_WALL, CATEGORY_PEG, CATEGORY_SENSOR } from '../../constants';

describe('physicsSetup', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('createPhysicsWorld', () => {
    it('should create physics world with all components', () => {
      const world = createPhysicsWorld({ container });

      expect(world.engine).toBeDefined();
      expect(world.render).toBeDefined();
      expect(world.runner).toBeDefined();
      expect(world.world).toBeDefined();
      expect(world.walls.length).toBeGreaterThan(0);
      expect(world.pegs.length).toBeGreaterThan(0);
      expect(world.sensors.length).toBeGreaterThan(0);
      expect(world.separators.length).toBeGreaterThan(0);
    });

    it('should use default dimensions when not specified', () => {
      const world = createPhysicsWorld({ container });

      expect(world.render.options.width).toBe(LOGICAL_WIDTH);
      expect(world.render.options.height).toBe(LOGICAL_HEIGHT);
    });

    it('should use custom dimensions when specified', () => {
      const customWidth = 800;
      const customHeight = 1000;
      const world = createPhysicsWorld({
        container,
        width: customWidth,
        height: customHeight
      });

      expect(world.render.options.width).toBe(customWidth);
      expect(world.render.options.height).toBe(customHeight);
    });

    it('should set default gravity', () => {
      const world = createPhysicsWorld({ container });
      expect(world.engine.gravity.y).toBe(0.5);
    });

    it('should use custom gravity when specified', () => {
      const customGravity = 1.0;
      const world = createPhysicsWorld({
        container,
        gravity: customGravity
      });
      expect(world.engine.gravity.y).toBe(customGravity);
    });

    it('should add all objects to world', () => {
      const world = createPhysicsWorld({ container });
      const allBodies = Matter.Composite.allBodies(world.world);

      const expectedCount = world.walls.length + world.pegs.length + 
                          world.sensors.length + world.separators.length;
      expect(allBodies.length).toBe(expectedCount);
    });
  });

  describe('createWorldObjects', () => {
    it('should create all world objects', () => {
      const objects = createWorldObjects();

      expect(objects.walls.length).toBe(3); // ground, left, right
      expect(objects.pegs.length).toBeGreaterThan(0);
      expect(objects.sensors.length).toBe(POINT_DISTRIBUTION.length);
      expect(objects.separators.length).toBe(POINT_DISTRIBUTION.length - 1);
    });

    it('should use default dimensions when not specified', () => {
      const objects = createWorldObjects();
      // Verify walls are created with default dimensions
      expect(objects.walls.length).toBe(3);
    });
  });

  describe('createWalls', () => {
    it('should create three walls', () => {
      const walls = createWalls();
      expect(walls.length).toBe(3);
    });

    it('should create walls with correct properties', () => {
      const walls = createWalls();
      
      walls.forEach(wall => {
        expect(wall.isStatic).toBe(true);
        expect(wall.collisionFilter.category).toBe(CATEGORY_WALL);
        expect(wall.friction).toBe(0);
      });
    });

    it('should position ground at bottom', () => {
      const walls = createWalls();
      const ground = walls.find(w => w.position.y > LOGICAL_HEIGHT);
      expect(ground).toBeDefined();
      expect(ground?.position.y).toBe(LOGICAL_HEIGHT + 50);
    });

    it('should position side walls correctly', () => {
      const walls = createWalls();
      const leftWall = walls.find(w => w.position.x < 0);
      const rightWall = walls.find(w => w.position.x > LOGICAL_WIDTH);

      expect(leftWall).toBeDefined();
      expect(rightWall).toBeDefined();
      expect(leftWall?.position.x).toBe(-25);
      expect(rightWall?.position.x).toBe(LOGICAL_WIDTH + 25);
    });
  });

  describe('createPegsAndSensors', () => {
    it('should create correct number of sensors', () => {
      const { sensors } = createPegsAndSensors();
      expect(sensors.length).toBe(POINT_DISTRIBUTION.length);
    });

    it('should create correct number of separators', () => {
      const { separators } = createPegsAndSensors();
      expect(separators.length).toBe(POINT_DISTRIBUTION.length - 1);
    });

    it('should create sensors with correct labels', () => {
      const { sensors } = createPegsAndSensors();
      
      POINT_DISTRIBUTION.forEach((points, i) => {
        const sensor = sensors.find(s => s.label === `sensor-${points}`);
        expect(sensor).toBeDefined();
      });
    });

    it('should create sensors as static and sensor type', () => {
      const { sensors } = createPegsAndSensors();
      
      sensors.forEach(sensor => {
        expect(sensor.isStatic).toBe(true);
        expect(sensor.isSensor).toBe(true);
        expect(sensor.collisionFilter.category).toBe(CATEGORY_SENSOR);
      });
    });

    it('should create pegs with correct properties', () => {
      const { pegs } = createPegsAndSensors();
      
      expect(pegs.length).toBeGreaterThan(0);
      pegs.forEach(peg => {
        expect(peg.isStatic).toBe(true);
        expect(peg.collisionFilter.category).toBe(CATEGORY_PEG);
        expect(peg.restitution).toBe(0.5);
        expect(peg.friction).toBe(0);
      });
    });
  });

  describe('createPegs', () => {
    it('should create pegs in grid pattern', () => {
      const pegs = createPegs();
      expect(pegs.length).toBeGreaterThan(0);
    });

    it('should create pegs with correct radius', () => {
      const pegs = createPegs();
      pegs.forEach(peg => {
        expect(peg.circleRadius).toBe(7.5);
      });
    });

    it('should create pegs with correct properties', () => {
      const pegs = createPegs();
      pegs.forEach(peg => {
        expect(peg.isStatic).toBe(true);
        expect(peg.collisionFilter.category).toBe(CATEGORY_PEG);
        expect(peg.restitution).toBe(0.5);
        expect(peg.friction).toBe(0);
      });
    });

    it('should avoid pegs too close to edges', () => {
      const pegs = createPegs();
      pegs.forEach(peg => {
        expect(peg.position.x).toBeGreaterThan(10);
        expect(peg.position.x).toBeLessThan(LOGICAL_WIDTH - 10);
      });
    });

    it('should create staggered rows correctly', () => {
      const pegs = createPegs();
      // Group pegs by Y position
      const pegsByRow = new Map<number, Matter.Body[]>();
      pegs.forEach(peg => {
        const y = Math.round(peg.position.y);
        if (!pegsByRow.has(y)) {
          pegsByRow.set(y, []);
        }
        pegsByRow.get(y)!.push(peg);
      });

      // Check that rows alternate between different column counts
      const rowYs = Array.from(pegsByRow.keys()).sort();
      expect(rowYs.length).toBeGreaterThan(1);
    });
  });
});
