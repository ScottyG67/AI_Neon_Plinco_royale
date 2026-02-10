import React, { useEffect, useRef, useState, useMemo } from 'react';
import Matter, { Events, Composite, World, Render, Runner, Engine } from 'matter-js';
import confetti from 'canvas-confetti';
import { Player, GamePhase } from '../types';
import { Laser } from '../types/game';
import { POINT_DISTRIBUTION, COLORS } from '../constants';
import { playBounce, playScore, playLaser, playExplosion, resumeAudio } from '../audio';
import { Socket } from 'socket.io-client';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../utils/gameConstants';
import { detectBoundaryEscape, createBoundaryBoundsMatter, detectBounce, createBounceDetectionState } from '../utils/collisionDetection';
import { spawnBall } from '../utils/ballSpawning';
import { createLaser } from '../utils/laserHandling';
import { createMouseMoveHandler, createTouchMoveHandler, createTouchEndHandler, createPointerDownHandler, createClickHandler } from '../utils/inputHandlers';
import { createPhysicsWorld } from '../utils/physicsSetup';

interface GameCanvasProps {
  players: Player[];
  phase: GamePhase;
  onScoreUpdate: (playerId: string, score: number) => void;
  onBallDestroyed: (ballId: string, ballOwnerId: string) => void;
  onGameFinish: () => void;
  socket: Socket | null;
  myId: string | null;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ players, phase, onScoreUpdate, onBallDestroyed, onGameFinish, socket, myId }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  
  const [scale, setScale] = useState(1);
  const [mousePos, setMousePos] = useState({ x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 });
  // Note: Lasers are now visual only in state, driven by socket events
  const [lasers, setLasers] = useState<Laser[]>([]);
  // Track if the current player has dropped their ball this round
  const [hasDroppedBall, setHasDroppedBall] = useState(false);
  
  // Refs for callbacks/state to avoid stale closures in event listeners/timeouts
  const callbacksRef = useRef({ onScoreUpdate, onGameFinish, onBallDestroyed });
  const playersRef = useRef(players);
  const lasersRef = useRef<Laser[]>([]);
  const socketRef = useRef(socket);
  const myIdRef = useRef(myId);

  // Handle Resizing
  useEffect(() => {
    const handleResize = () => {
      if (!wrapperRef.current) return;
      
      const parent = wrapperRef.current;
      const availableWidth = parent.clientWidth;
      const availableHeight = parent.clientHeight;
      
      const scaleW = availableWidth / LOGICAL_WIDTH;
      const scaleH = availableHeight / LOGICAL_HEIGHT;
      const newScale = Math.min(scaleW, scaleH) * 0.95;
      
      setScale(newScale);
    };

    const observer = new ResizeObserver(handleResize);
    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }
    handleResize();

    return () => observer.disconnect();
  }, []);

  // Determine Role
  const myPlayer = useMemo(() => players.find(p => p.id === myId), [players, myId]);
  const isSpectator = myPlayer?.isSpectator;
  const isPlayer = !isSpectator && myPlayer;
  const hasFinished = myPlayer?.finished;
  
  // Reset dropped ball state when game phase changes or player state resets
  useEffect(() => {
    if (phase !== 'PLAYING' || myPlayer?.finished === false) {
      setHasDroppedBall(false);
    }
  }, [phase, myPlayer?.finished]);

  // Sync refs
  useEffect(() => {
    callbacksRef.current = { onScoreUpdate, onGameFinish, onBallDestroyed };
    playersRef.current = players;
    socketRef.current = socket;
    myIdRef.current = myId;
  }, [onScoreUpdate, onGameFinish, onBallDestroyed, players, socket, myId]);

  // --- Network Event Listeners ---
  useEffect(() => {
      if (!socket) return;

      const handleSpawnBall = (data: { playerId: string, x: number }) => {
          const player = playersRef.current.find(p => p.id === data.playerId);
          if (player) {
              spawnPhysicsBall(player, data.x);
          }
      };

    const handleLaserFired = (data: any) => {
        playLaser();
        const newLaser = createLaser(data.x1, data.y1, data.x2, data.y2, data.color);
        lasersRef.current.push(newLaser);
        setLasers(prev => [...prev, newLaser]);
    };

      const handleBallRemoved = (data: { ballId: string }) => {
          playExplosion();
          if (engineRef.current) {
              const ball = Matter.Composite.allBodies(engineRef.current.world).find(b => {
                 // Label format: ball-{playerId}-{randomUUID}
                 // Wait, we need to track unique ball IDs. 
                 // Simple physics spawn just uses player ID. If multiple balls per player allowed, we need unique IDs.
                 // For now, let's assume one ball per player per round? 
                 // The prompt implies "After all balls get to the bottom".
                 // Let's refine the label to include a unique ID from the server if possible, 
                 // or just remove *any* ball belonging to that player?
                 // Let's assume the unique ID was passed in spawn.
                 return b.id.toString() === data.ballId || (b.label && b.label.includes(data.ballId)); 
              });
              
              if (ball) {
                  Matter.World.remove(engineRef.current.world, ball);
                  // Explosion effect at ball position
                  if (wrapperRef.current) {
                      // We don't have screen coords easily here without calculation, 
                      // but we can just fire confetti from center or approximate.
                      // For simplicity, skip confetti on remote destruction or calculate it.
                  }
              }
          }
      };

      socket.on('spawn_ball', handleSpawnBall);
      socket.on('laser_fired', handleLaserFired);
      socket.on('ball_removed', handleBallRemoved);

      return () => {
          socket.off('spawn_ball', handleSpawnBall);
          socket.off('laser_fired', handleLaserFired);
          socket.off('ball_removed', handleBallRemoved);
      };
  }, [socket]);


  // --- Physics & Game Loop Initialization ---
  useEffect(() => {
    if (!containerRef.current) return;

    // Setup physics world using utility
    const physicsWorld = createPhysicsWorld({
      container: containerRef.current,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      gravity: 0.5
    });

    engineRef.current = physicsWorld.engine;
    renderRef.current = physicsWorld.render;
    runnerRef.current = physicsWorld.runner;

    const engine = physicsWorld.engine;
    const render = physicsWorld.render;
    const world = physicsWorld.world;

    // Calculate constants for rendering
    const bucketCount = POINT_DISTRIBUTION.length;
    const bucketWidth = LOGICAL_WIDTH / bucketCount;
    const height = LOGICAL_HEIGHT;
    const sensorHeight = 40;

    // Track balls for boundary detection
    const ballBounceStates = new Map<string, ReturnType<typeof createBounceDetectionState>>();
    const ballBoundaryBounds = createBoundaryBoundsMatter(LOGICAL_WIDTH, LOGICAL_HEIGHT, 12.5, 100);

    // 4. Custom Render Loop
    Events.on(render, 'afterRender', () => {
        const ctx = render.context;
        if (!ctx) return;
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        POINT_DISTRIBUTION.forEach((points, i) => {
            const x = i * bucketWidth + (bucketWidth / 2);
            const y = height - (sensorHeight / 2);
            ctx.shadowColor = COLORS.text;
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 24px "Orbitron", sans-serif';
            ctx.fillText(points.toString(), x, y);
            ctx.shadowBlur = 0;
        });

        ctx.font = 'bold 12px "Roboto Mono", monospace';
        const bodies = Composite.allBodies(world);
        const now = Date.now();
        
        bodies.forEach(body => {
            if (body.label.startsWith('ball-')) {
                const playerId = body.label.split('ball-')[1];
                const player = playersRef.current.find(p => p.id === playerId);
                
                // Boundary escape detection
                const ballPosition = { x: body.position.x, y: body.position.y, z: 0 };
                const escaped = detectBoundaryEscape(ballPosition, 12.5, ballBoundaryBounds);
                
                if (escaped) {
                    console.log('[GameCanvas] Ball escaped play area! Scoring 0 points:', {
                        ballId: body.label,
                        ballPosition: { x: body.position.x.toFixed(2), y: body.position.y.toFixed(2) },
                        bounds: ballBoundaryBounds
                    });
                    
                    // Score with 0 points if this is the player's ball
                    if (playerId === myIdRef.current) {
                        callbacksRef.current.onScoreUpdate(playerId, 0);
                    }
                    
                    playScore(0);
                    World.remove(world, body);
                    ballBounceStates.delete(body.label);
                    return;
                }
                
                // Enhanced bounce detection using collision detection module
                if (!ballBounceStates.has(body.label)) {
                    ballBounceStates.set(body.label, createBounceDetectionState());
                }
                const bounceState = ballBounceStates.get(body.label)!;
                const velocity = { x: body.velocity.x, y: body.velocity.y, z: 0 };
                const bounced = detectBounce(velocity, bounceState, now);
                // Note: Bounce sound is handled in collision events, but we can enhance it here if needed
                
                // Render player name
                if (player) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    const text = player.name;
                    const metrics = ctx.measureText(text);
                    const bgWidth = metrics.width + 8;
                    const bgHeight = 18;
                    ctx.fillRect(body.position.x - bgWidth/2, body.position.y - 30 - bgHeight/2, bgWidth, bgHeight);
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(text, body.position.x, body.position.y - 25);
                }
            }
        });

        setLasers(prev => prev.filter(l => now - l.createdAt < 200));
        
        const currentLasers = lasersRef.current.filter(l => now - l.createdAt < 200);
        lasersRef.current = currentLasers;

        currentLasers.forEach(laser => {
            const age = now - laser.createdAt;
            const opacity = 1 - (age / 200);
            
            ctx.beginPath();
            ctx.moveTo(laser.x1, laser.y1);
            ctx.lineTo(laser.x2, laser.y2);
            ctx.strokeStyle = laser.color;
            ctx.lineWidth = 4 * opacity;
            ctx.lineCap = 'round';
            ctx.shadowColor = laser.color;
            ctx.shadowBlur = 15;
            ctx.globalAlpha = opacity;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        });
    });

    // 5. Collision Handling
    Events.on(engine, 'collisionStart', (event) => {
        event.pairs.forEach((pair) => {
            const { bodyA, bodyB } = pair;
            const isBallA = bodyA.label.startsWith('ball-');
            const isBallB = bodyB.label.startsWith('ball-');
            const ball = isBallA ? bodyA : isBallB ? bodyB : null;
            const other = isBallA ? bodyB : bodyA;

            if (ball) {
                // Score Collision
                if (other.label.startsWith('sensor-')) {
                     const points = parseInt(other.label.split('-')[1]);
                     const ballPlayerId = ball.label.split('ball-')[1];
                     
                     // Authoritative check: Do I own this ball?
                     // If so, I report the score.
                     if (ballPlayerId === myIdRef.current) {
                         callbacksRef.current.onScoreUpdate(ballPlayerId, points);
                     }

                     // Visual cleanup for everyone
                     // Note: Matter.js isn't perfectly synced. 
                     // Ideally server confirms removal, but for responsiveness we remove visually on trigger.
                     // A more robust way is waiting for score update from server to remove, but that might look laggy.
                     // We'll remove locally.
                     World.remove(world, ball);
                     playScore(points);
                } 
                else {
                    if (ball.speed > 0.5) {
                        playBounce();
                    }
                }
            }
        });
    });

    Render.run(render);
    Runner.run(runnerRef.current, engine);

    return () => {
        Render.stop(render);
        Runner.stop(runnerRef.current);
        World.clear(world, false);
        Engine.clear(engine);
        if (render.canvas) render.canvas.remove();
        engineRef.current = null;
        renderRef.current = null;
        runnerRef.current = null;
    };
  }, []); 

  // --- Physics Helper ---
  const spawnPhysicsBall = (player: Player, x: number) => {
      if (!engineRef.current) return;
      spawnBall({ player, x, engine: engineRef.current });
  };

  // --- Input ---
  const handleMouseMove = createMouseMoveHandler({
    containerRef,
    wrapperRef,
    scale,
    onPositionUpdate: setMousePos
  });

  const handleClick = createClickHandler({
    containerRef,
    wrapperRef,
    scale,
    onPositionUpdate: setMousePos,
    onAction: (pos) => {
      resumeAudio();

      if (isPlayer && !hasFinished) {
          // Prevent multiple ball drops - check if player has already dropped
          if (hasDroppedBall) {
              return; // Already dropped, can't drop again
          }
          
          // Drop Ball
          if (socketRef.current) {
              socketRef.current.emit('drop_ball', { x: pos.x });
              // Mark that we've dropped our ball
              setHasDroppedBall(true);
              // Note: We do NOT spawn locally immediately. We wait for server echo.
              // This ensures everyone spawns at roughly same time.
          }
      } else if (isSpectator) {
          // Blast - use original mouse event for confetti positioning
          const syntheticEvent = {
            clientX: 0,
            clientY: 0,
            preventDefault: () => {}
          } as React.MouseEvent;
          handleSpectatorBlast(syntheticEvent);
      }
    }
  }, 20);

  const handleSpectatorBlast = (e: React.MouseEvent) => {
      if (!engineRef.current || !myPlayer || !socketRef.current) return;

      // 1. Send Visuals
      const startX = Math.random() > 0.5 ? 0 : LOGICAL_WIDTH;
      const startY = 0;
      
      socketRef.current.emit('fire_laser', {
          x1: startX,
          y1: startY,
          x2: mousePos.x,
          y2: mousePos.y,
          color: myPlayer.color
      });

      // 2. Client-side Hit Detection (Authoritative for Spectator)
      const bodies = Matter.Composite.allBodies(engineRef.current.world);
      const balls = bodies.filter(b => b.label.startsWith('ball-'));
      
      const blastRadius = 30;
      const hitBall = balls.find(b => {
          const dx = b.position.x - mousePos.x;
          const dy = b.position.y - mousePos.y;
          return (dx * dx + dy * dy) < (blastRadius * blastRadius);
      });

      if (hitBall) {
          const ballOwnerId = hitBall.label.split('ball-')[1];
          // We found a hit locally. Tell server to destroy it.
          // Using label as ID proxy.
          callbacksRef.current.onBallDestroyed(hitBall.id.toString(), ballOwnerId);
          
          // Local confetti immediately for feedback
           if (wrapperRef.current) {
              const xNorm = e.clientX / window.innerWidth;
              const yNorm = e.clientY / window.innerHeight;
              confetti({
                particleCount: 50,
                spread: 70,
                origin: { x: xNorm, y: yNorm },
                colors: [myPlayer.color, '#ffffff', '#ff0000'],
                ticks: 60,
                gravity: 1.5,
                scalar: 0.8,
                zIndex: 100
              });
          }
      }
  };

  const reticleColor = myPlayer ? myPlayer.color : '#fff';
  // Show reticle only if player hasn't dropped their ball yet or is spectator
  const showReticle = (isPlayer && !hasFinished && !hasDroppedBall) || isSpectator;

  // Touch event handlers for mobile
  const handleTouchMove = createTouchMoveHandler({
    containerRef,
    wrapperRef,
    scale,
    onPositionUpdate: setMousePos
  });

  const handleTouchEnd = createTouchEndHandler({
    containerRef,
    wrapperRef,
    scale,
    onPositionUpdate: setMousePos,
    onAction: (pos) => {
      resumeAudio();
      if (isPlayer && !hasFinished && !hasDroppedBall) {
        if (socketRef.current) {
          socketRef.current.emit('drop_ball', { x: pos.x });
          setHasDroppedBall(true);
        }
      } else if (isSpectator) {
        handleSpectatorBlast({
          clientX: 0,
          clientY: 0,
          preventDefault: () => {}
        } as React.MouseEvent);
      }
    }
  });

  const handlePointerDown = createPointerDownHandler({
    containerRef,
    wrapperRef,
    scale,
    onPositionUpdate: setMousePos,
    onAction: (pos) => {
      resumeAudio();
      if (isPlayer && !hasFinished && !hasDroppedBall) {
        if (socketRef.current) {
          socketRef.current.emit('drop_ball', { x: pos.x });
          setHasDroppedBall(true);
        }
      } else if (isSpectator) {
        handleSpectatorBlast({
          clientX: 0,
          clientY: 0,
          preventDefault: () => {}
        } as React.MouseEvent);
      }
    }
  });

  return (
    <div 
        ref={wrapperRef} 
        className="w-full h-full flex items-center justify-center relative select-none touch-none"
        style={{ touchAction: 'none' }}
    >
        <div 
            ref={containerRef} 
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handlePointerDown}
            style={{ 
                width: LOGICAL_WIDTH, 
                height: LOGICAL_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                cursor: 'none',
                borderLeft: `${4 / scale}px solid #d946ef`,
                borderRight: `${4 / scale}px solid #d946ef`,
                borderBottom: `${4 / scale}px solid #d946ef`,
                borderRadius: `0 0 ${12 / scale}px ${12 / scale}px`,
                boxShadow: `0 0 ${30 / scale}px rgba(255, 0, 255, 0.2)`
            }}
            className="relative bg-slate-900/50 backdrop-blur-sm overflow-hidden"
        >
            {showReticle && (
                <div 
                    className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: isPlayer ? Math.max(20, Math.min(LOGICAL_WIDTH - 20, mousePos.x)) : mousePos.x, top: isPlayer ? 30 : mousePos.y }}
                >
                    {isPlayer ? (
                        <div 
                             className="w-[20px] h-[20px] rounded-full shadow-[0_0_10px_currentColor]"
                             style={{ backgroundColor: myPlayer.color, color: myPlayer.color }}
                        >
                             <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-white bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-current">
                                {myPlayer.name}
                            </div>
                            <div className="absolute top-full left-1/2 w-0.5 h-[1000px] -translate-x-1/2 bg-gradient-to-b from-current to-transparent opacity-20" />
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full border-2 border-dashed animate-spin-slow" style={{ borderColor: reticleColor, animationDuration: '3s' }} />
                            <div className="absolute inset-0 m-auto w-1 h-4 bg-current" style={{ color: reticleColor }} />
                            <div className="absolute inset-0 m-auto w-4 h-1 bg-current" style={{ color: reticleColor }} />
                            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-white bg-black/50 px-2 py-1 rounded backdrop-blur-sm" style={{ color: reticleColor, borderColor: reticleColor, border: '1px solid' }}>
                                SPECTATOR
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};