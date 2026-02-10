import { describe, it, expect, beforeEach } from 'vitest';
import Matter from 'matter-js';
import { createBallBody, spawnBall, DEFAULT_BALL_PHYSICS, type BallSpawnOptions } from '../ballSpawning';
import { Player } from '../../types';
import { CATEGORY_BALL, CATEGORY_PEG, CATEGORY_WALL, CATEGORY_SENSOR } from '../../constants';

describe('ballSpawning', () => {
  let engine: Matter.Engine;
  let testPlayer: Player;

  beforeEach(() => {
    engine = Matter.Engine.create();
    testPlayer = {
      id: 'test-player-1',
      name: 'Test Player',
      color: '#ff0000',
      score: 0,
      finished: false,
      isSpectator: false,
      isCheater: false
    };
  });

  describe('createBallBody', () => {
    it('should create a ball body with correct properties', () => {
      const options: BallSpawnOptions = {
        player: testPlayer,
        x: 300,
        engine
      };

      const ball = createBallBody(options);

      expect(ball.label).toBe('ball-test-player-1');
      expect(ball.circleRadius).toBe(DEFAULT_BALL_PHYSICS.radius);
      expect(ball.position.x).toBe(300);
      expect(ball.position.y).toBe(DEFAULT_BALL_PHYSICS.dropY);
      expect(ball.restitution).toBe(DEFAULT_BALL_PHYSICS.restitution);
      expect(ball.friction).toBe(DEFAULT_BALL_PHYSICS.friction);
      expect(ball.frictionAir).toBe(DEFAULT_BALL_PHYSICS.frictionAir);
    });

    it('should set correct collision filter for normal player', () => {
      const options: BallSpawnOptions = {
        player: testPlayer,
        x: 300,
        engine
      };

      const ball = createBallBody(options);

      expect(ball.collisionFilter.category).toBe(CATEGORY_BALL);
      expect(ball.collisionFilter.mask).toBe(
        CATEGORY_PEG | CATEGORY_WALL | CATEGORY_SENSOR | CATEGORY_BALL
      );
    });

    it('should set correct collision filter for cheater', () => {
      const cheaterPlayer: Player = {
        ...testPlayer,
        isCheater: true
      };

      const options: BallSpawnOptions = {
        player: cheaterPlayer,
        x: 300,
        engine
      };

      const ball = createBallBody(options);

      expect(ball.collisionFilter.category).toBe(CATEGORY_BALL);
      expect(ball.collisionFilter.mask).toBe(
        CATEGORY_WALL | CATEGORY_SENSOR | CATEGORY_BALL
      );
      // Cheaters should NOT collide with pegs
      expect(ball.collisionFilter.mask & CATEGORY_PEG).toBe(0);
    });

    it('should drop cheater ball at center (x=0)', () => {
      const cheaterPlayer: Player = {
        ...testPlayer,
        isCheater: true
      };

      const options: BallSpawnOptions = {
        player: cheaterPlayer,
        x: 300, // Should be ignored for cheaters
        engine
      };

      const ball = createBallBody(options);

      expect(ball.position.x).toBe(0);
    });

    it('should use custom physics properties when provided', () => {
      const customPhysics = {
        restitution: 0.8,
        friction: 0.01,
        frictionAir: 0.02,
        radius: 15,
        dropY: -50
      };

      const options: BallSpawnOptions = {
        player: testPlayer,
        x: 300,
        engine
      };

      const ball = createBallBody(options, customPhysics);

      expect(ball.restitution).toBe(0.8);
      expect(ball.friction).toBe(0.01);
      expect(ball.frictionAir).toBe(0.02);
      expect(ball.circleRadius).toBe(15);
      expect(ball.position.y).toBe(-50);
    });

    it('should set ball render properties correctly', () => {
      const options: BallSpawnOptions = {
        player: testPlayer,
        x: 300,
        engine
      };

      const ball = createBallBody(options);

      expect(ball.render.fillStyle).toBe('#ff0000');
      expect(ball.render.strokeStyle).toBe('#fff');
      expect(ball.render.lineWidth).toBe(2);
    });

    it('should assign custom ID to ball body', () => {
      const options: BallSpawnOptions = {
        player: testPlayer,
        x: 300,
        engine
      };

      const ball = createBallBody(options);

      expect(ball.id).toBeDefined();
      expect(typeof ball.id).toBe('number');
    });
  });

  describe('spawnBall', () => {
    it('should add ball to physics world', () => {
      const options: BallSpawnOptions = {
        player: testPlayer,
        x: 300,
        engine
      };

      const initialBodyCount = Matter.Composite.allBodies(engine.world).length;
      
      spawnBall(options);

      const finalBodyCount = Matter.Composite.allBodies(engine.world).length;
      expect(finalBodyCount).toBe(initialBodyCount + 1);

      const bodies = Matter.Composite.allBodies(engine.world);
      const addedBall = bodies.find(b => b.label === 'ball-test-player-1');
      expect(addedBall).toBeDefined();
    });

    it('should use custom physics properties when provided', () => {
      const customPhysics = {
        ...DEFAULT_BALL_PHYSICS,
        radius: 20
      };

      const options: BallSpawnOptions = {
        player: testPlayer,
        x: 300,
        engine
      };

      spawnBall(options, customPhysics);

      const bodies = Matter.Composite.allBodies(engine.world);
      const ball = bodies.find(b => b.label === 'ball-test-player-1');
      expect(ball?.circleRadius).toBe(20);
    });
  });
});
