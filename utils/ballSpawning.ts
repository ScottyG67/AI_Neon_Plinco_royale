/**
 * Ball spawning utilities for Matter.js physics
 * Handles creation and configuration of ball bodies
 */

import Matter from 'matter-js';
import { Player } from '../types';
import { CATEGORY_BALL, CATEGORY_PEG, CATEGORY_WALL, CATEGORY_SENSOR } from '../constants';

export interface BallSpawnOptions {
  player: Player;
  x: number;
  engine: Matter.Engine;
}

export interface BallPhysicsProperties {
  restitution: number;
  friction: number;
  frictionAir: number;
  radius: number;
  dropY: number;
}

export const DEFAULT_BALL_PHYSICS: BallPhysicsProperties = {
  restitution: 0.5,
  friction: 0.001,
  frictionAir: 0.015,
  radius: 12.5,
  dropY: -30
};

/**
 * Creates a ball body for Matter.js physics engine
 * @param options Ball spawn options
 * @param physicsProperties Optional physics properties (defaults to DEFAULT_BALL_PHYSICS)
 * @returns Matter.js body for the ball
 */
export function createBallBody(
  options: BallSpawnOptions,
  physicsProperties: BallPhysicsProperties = DEFAULT_BALL_PHYSICS
): Matter.Body {
  const { player, x } = options;
  const { radius, dropY, restitution, friction, frictionAir } = physicsProperties;
  
  const isCheater = player.isCheater;
  const dropX = isCheater ? 0 : x; // Cheaters drop at center (0 in Matter.js coords)
  
  const ballLabel = `ball-${player.id}`;

  const ball = Matter.Bodies.circle(dropX, dropY, radius, {
    label: ballLabel,
    restitution,
    friction,
    frictionAir,
    render: { 
      fillStyle: player.color,
      strokeStyle: '#fff',
      lineWidth: 2
    },
    collisionFilter: {
      category: CATEGORY_BALL,
      mask: isCheater 
        ? CATEGORY_WALL | CATEGORY_SENSOR | CATEGORY_BALL 
        : CATEGORY_PEG | CATEGORY_WALL | CATEGORY_SENSOR | CATEGORY_BALL
    }
  });

  // Add a custom ID property for spectator targeting
  // Note: Matter.js uses Int IDs, so we convert player ID string to int
  ball.id = parseInt(player.id.substring(0, 5), 16) || Matter.Common.nextId();

  return ball;
}

/**
 * Spawns a ball into the physics world
 * @param options Ball spawn options
 * @param physicsProperties Optional physics properties
 */
export function spawnBall(
  options: BallSpawnOptions,
  physicsProperties?: BallPhysicsProperties
): void {
  const ball = createBallBody(options, physicsProperties);
  Matter.Composite.add(options.engine.world, ball);
}
