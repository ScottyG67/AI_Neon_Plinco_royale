/**
 * Physics setup utilities for Matter.js
 * Handles engine, world, and render initialization
 */

import Matter from 'matter-js';
import { POINT_DISTRIBUTION, COLORS, CATEGORY_BALL, CATEGORY_PEG, CATEGORY_SENSOR, CATEGORY_WALL } from '../constants';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './gameConstants';

export interface PhysicsWorld {
  engine: Matter.Engine;
  render: Matter.Render;
  runner: Matter.Runner;
  world: Matter.World;
  walls: Matter.Body[];
  pegs: Matter.Body[];
  sensors: Matter.Body[];
  separators: Matter.Body[];
}

export interface PhysicsSetupOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  gravity?: number;
}

/**
 * Creates and initializes Matter.js physics engine
 * @param options Physics setup options
 * @returns Physics world with engine, render, and world objects
 */
export function createPhysicsWorld(options: PhysicsSetupOptions): PhysicsWorld {
  const width = options.width ?? LOGICAL_WIDTH;
  const height = options.height ?? LOGICAL_HEIGHT;
  const gravity = options.gravity ?? 0.5;

  // Create engine
  const engine = Matter.Engine.create();
  engine.gravity.y = gravity;

  // Create render
  const render = Matter.Render.create({
    element: options.container,
    engine: engine,
    options: {
      width,
      height,
      wireframes: false,
      background: 'transparent',
      pixelRatio: window.devicePixelRatio
    }
  });

  // Create world objects
  const { walls, pegs, sensors, separators } = createWorldObjects(width, height);

  // Add all objects to world
  Matter.Composite.add(engine.world, [...walls, ...pegs, ...sensors, ...separators]);

  // Create runner
  const runner = Matter.Runner.create();

  return {
    engine,
    render,
    runner,
    world: engine.world,
    walls,
    pegs,
    sensors,
    separators
  };
}

/**
 * Creates static world objects (walls, pegs, sensors, separators)
 * @param width World width
 * @param height World height
 * @returns Object containing arrays of world bodies
 */
export function createWorldObjects(
  width: number = LOGICAL_WIDTH,
  height: number = LOGICAL_HEIGHT
): {
  walls: Matter.Body[];
  pegs: Matter.Body[];
  sensors: Matter.Body[];
  separators: Matter.Body[];
} {
  const walls = createWalls(width, height);
  const { pegs, sensors, separators } = createPegsAndSensors(width, height);

  return { walls, pegs, sensors, separators };
}

/**
 * Creates wall bodies (ground, left, right)
 * @param width World width
 * @param height World height
 * @returns Array of wall bodies
 */
export function createWalls(
  width: number = LOGICAL_WIDTH,
  height: number = LOGICAL_HEIGHT
): Matter.Body[] {
  const wallOptions = {
    isStatic: true,
    render: { fillStyle: COLORS.wall },
    collisionFilter: { category: CATEGORY_WALL },
    friction: 0
  };

  const ground = Matter.Bodies.rectangle(width / 2, height + 50, width, 100, wallOptions);
  const leftWall = Matter.Bodies.rectangle(-25, height / 2, 50, height * 2, wallOptions);
  const rightWall = Matter.Bodies.rectangle(width + 25, height / 2, 50, height * 2, wallOptions);

  // Matter.js overrides properties for static bodies, so set them after creation
  [ground, leftWall, rightWall].forEach(wall => {
    wall.friction = 0;
  });

  return [ground, leftWall, rightWall];
}

/**
 * Creates peg and sensor bodies
 * @param width World width
 * @param height World height
 * @returns Object containing pegs, sensors, and separators
 */
export function createPegsAndSensors(
  width: number = LOGICAL_WIDTH,
  height: number = LOGICAL_HEIGHT
): {
  pegs: Matter.Body[];
  sensors: Matter.Body[];
  separators: Matter.Body[];
} {
  const bucketCount = POINT_DISTRIBUTION.length;
  const bucketWidth = width / bucketCount;
  const separatorHeight = 100;
  const sensorHeight = 40;

  const separators: Matter.Body[] = [];
  const sensors: Matter.Body[] = [];

  // Create separators and sensors
  POINT_DISTRIBUTION.forEach((points, i) => {
    const x = i * bucketWidth + (bucketWidth / 2);

    // Create separator (except for last bucket)
    if (i < bucketCount - 1) {
      const sepX = (i + 1) * bucketWidth;
      const separator = Matter.Bodies.rectangle(sepX, height - separatorHeight / 2, 4, separatorHeight, {
        isStatic: true,
        render: { fillStyle: COLORS.accent },
        collisionFilter: { category: CATEGORY_WALL },
        friction: 0,
        restitution: 0.2
      });
      // Matter.js overrides properties for static bodies, so set them after creation
      separator.friction = 0;
      separator.restitution = 0.2;
      separators.push(separator);
    }

    // Create sensor
    const sensor = Matter.Bodies.rectangle(x, height - sensorHeight / 2, bucketWidth - 8, sensorHeight, {
      isStatic: true,
      isSensor: true,
      label: `sensor-${points}`,
      render: {
        fillStyle: COLORS.buckets[Math.min(Math.abs(3 - i), COLORS.buckets.length - 1)],
        opacity: 0.3
      },
      collisionFilter: { category: CATEGORY_SENSOR }
    });
    sensors.push(sensor);
  });

  // Create pegs
  const pegs = createPegs(width, height, separatorHeight);

  return { pegs, sensors, separators };
}

/**
 * Creates peg bodies in a grid pattern
 * @param width World width
 * @param height World height
 * @param separatorHeight Height of separators (to avoid overlap)
 * @returns Array of peg bodies
 */
export function createPegs(
  width: number = LOGICAL_WIDTH,
  height: number = LOGICAL_HEIGHT,
  separatorHeight: number = 100
): Matter.Body[] {
  const pegs: Matter.Body[] = [];
  const rows = 10;
  const startY = 80;
  const endY = height - separatorHeight - 30;
  const spacingY = (endY - startY) / (rows - 1);
  const bucketCount = POINT_DISTRIBUTION.length;
  const gridCols = bucketCount + 1;
  const spacingX = width / gridCols;
  const pegRadius = 7.5;

  for (let row = 0; row < rows; row++) {
    const y = startY + row * spacingY;
    const isStaggered = row % 2 === 1;

    if (isStaggered) {
      // Staggered rows: skip first column
      for (let col = 1; col < gridCols; col++) {
        const x = col * spacingX;
        const peg = Matter.Bodies.circle(x, y, pegRadius, {
          isStatic: true,
          render: { fillStyle: COLORS.peg },
          restitution: 0.5,
          friction: 0,
          collisionFilter: { category: CATEGORY_PEG }
        });
        // Matter.js overrides properties for static bodies, so set them after creation
        peg.restitution = 0.5;
        peg.friction = 0;
        pegs.push(peg);
      }
    } else {
      // Regular rows: all columns, offset by half spacing
      for (let col = 0; col < gridCols; col++) {
        const x = (col + 0.5) * spacingX;
        // Avoid pegs too close to edges
        if (x > 10 && x < width - 10) {
          const peg = Matter.Bodies.circle(x, y, pegRadius, {
            isStatic: true,
            render: { fillStyle: COLORS.peg },
            restitution: 0.5,
            friction: 0,
            collisionFilter: { category: CATEGORY_PEG }
          });
          // Matter.js overrides properties for static bodies, so set them after creation
          peg.restitution = 0.5;
          peg.friction = 0;
          pegs.push(peg);
        }
      }
    }
  }

  return pegs;
}
