import React, { useEffect, useRef, useState, useMemo } from 'react';
import Matter from 'matter-js';
import confetti from 'canvas-confetti';
import { Player, GamePhase } from '../types';
import { CATEGORY_BALL, CATEGORY_PEG, CATEGORY_SENSOR, CATEGORY_WALL, POINT_DISTRIBUTION, COLORS } from '../constants';
import { playBounce, playScore, playLaser, playExplosion, resumeAudio } from '../audio';
import { Socket } from 'socket.io-client';

interface GameCanvasProps {
  players: Player[];
  phase: GamePhase;
  onScoreUpdate: (playerId: string, score: number) => void;
  onBallDestroyed: (ballId: string, ballOwnerId: string) => void;
  onGameFinish: () => void;
  socket: Socket | null;
  myId: string | null;
}

interface Laser {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    createdAt: number;
}

const LOGICAL_WIDTH = 600;
const LOGICAL_HEIGHT = 800;

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
          const newLaser: Laser = {
              id: crypto.randomUUID(),
              ...data,
              createdAt: Date.now()
          };
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

    // 1. Setup Matter.js Engine
    const Engine = Matter.Engine,
          Render = Matter.Render,
          Runner = Matter.Runner,
          Bodies = Matter.Bodies,
          Composite = Matter.Composite,
          Events = Matter.Events,
          World = Matter.World;

    const engine = Engine.create();
    engine.gravity.y = 0.5; 
    engineRef.current = engine;

    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;

    // 2. Setup Render
    const render = Render.create({
      element: containerRef.current,
      engine: engine,
      options: {
        width,
        height,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio
      }
    });
    renderRef.current = render;

    // 3. Create Static World Objects
    const wallOptions = { 
      isStatic: true, 
      render: { fillStyle: COLORS.wall },
      collisionFilter: { category: CATEGORY_WALL },
      friction: 0 
    };
    
    const ground = Bodies.rectangle(width / 2, height + 50, width, 100, wallOptions);
    const leftWall = Bodies.rectangle(-25, height / 2, 50, height * 2, wallOptions);
    const rightWall = Bodies.rectangle(width + 25, height / 2, 50, height * 2, wallOptions);

    const bucketCount = POINT_DISTRIBUTION.length;
    const bucketWidth = width / bucketCount;
    const separatorHeight = 100;
    const sensorHeight = 40;

    const separators: Matter.Body[] = [];
    const sensors: Matter.Body[] = [];

    POINT_DISTRIBUTION.forEach((points, i) => {
        const x = i * bucketWidth + (bucketWidth / 2);
        
        if (i < bucketCount - 1) {
            const sepX = (i + 1) * bucketWidth;
            separators.push(Bodies.rectangle(sepX, height - separatorHeight / 2, 4, separatorHeight, {
                isStatic: true,
                render: { fillStyle: COLORS.accent },
                collisionFilter: { category: CATEGORY_WALL },
                friction: 0,
                restitution: 0.2
            }));
        }

        const sensor = Bodies.rectangle(x, height - sensorHeight/2, bucketWidth - 8, sensorHeight, {
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

    // Plinko Pegs
    const pegs: Matter.Body[] = [];
    const rows = 10;
    const startY = 80;
    const endY = height - separatorHeight - 30; 
    const spacingY = (endY - startY) / (rows - 1);
    const gridCols = bucketCount + 1; 
    const spacingX = width / gridCols;

    for (let row = 0; row < rows; row++) {
        const y = startY + row * spacingY;
        const isStaggered = row % 2 === 1;

        if (isStaggered) {
             for (let col = 1; col < gridCols; col++) {
                 const x = col * spacingX;
                 pegs.push(Bodies.circle(x, y, 7.5, {
                    isStatic: true,
                    render: { fillStyle: COLORS.peg },
                    restitution: 0.5,
                    friction: 0,
                    collisionFilter: { category: CATEGORY_PEG }
                }));
             }
        } else {
             for (let col = 0; col < gridCols; col++) {
                 const x = (col + 0.5) * spacingX;
                 if (x > 10 && x < width - 10) {
                    pegs.push(Bodies.circle(x, y, 7.5, {
                        isStatic: true,
                        render: { fillStyle: COLORS.peg },
                        restitution: 0.5,
                        friction: 0,
                        collisionFilter: { category: CATEGORY_PEG }
                    }));
                 }
             }
        }
    }

    Composite.add(engine.world, [ground, leftWall, rightWall, ...separators, ...sensors, ...pegs]);

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
        const bodies = Composite.allBodies(engine.world);
        bodies.forEach(body => {
            if (body.label.startsWith('ball-')) {
                const playerId = body.label.split('ball-')[1]; // Label: ball-{playerId}
                const player = playersRef.current.find(p => p.id === playerId);
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

        const now = Date.now();
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
                     World.remove(engine.world, ball);
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
    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);

    return () => {
        Render.stop(render);
        Runner.stop(runner);
        World.clear(engine.world, false);
        Engine.clear(engine);
        if (render.canvas) render.canvas.remove();
        engineRef.current = null;
        renderRef.current = null;
    };
  }, []); 

  // --- Physics Helper ---
  const spawnPhysicsBall = (player: Player, x: number) => {
      if (!engineRef.current) return;
      
      const isCheater = player.isCheater;
      const width = LOGICAL_WIDTH;
      const dropX = isCheater ? width / 2 : x;
      // Generate a semi-unique label (ball-PLAYERID)
      // Ideally we'd use a UUID from the server for the ball itself.
      // For this MVP, we assume one ball per player active.
      // Or we can append a random string.
      const ballLabel = `ball-${player.id}`;

      const ball = Matter.Bodies.circle(dropX, -30, 12.5, {
          label: ballLabel,
          restitution: 0.5,
          friction: 0.001,
          frictionAir: 0.015,
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

      // Add a custom ID property to the body if needed for exact targeting
      ball.id = parseInt(player.id.substring(0, 5), 16) || Matter.Common.nextId(); 
      // ^ Hacky for spectator targeting, ideally we use string IDs but Matter uses Int IDs.
      // Let's rely on label matching for spectator logic.

      Matter.Composite.add(engineRef.current.world, ball);
  };

  // --- Input ---
  const handleMouseMove = (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top;
      const logicalX = relativeX * (LOGICAL_WIDTH / rect.width);
      const logicalY = relativeY * (LOGICAL_HEIGHT / rect.height);
      setMousePos({ x: logicalX, y: logicalY });
  };

  const handleClick = (e: React.MouseEvent) => {
      resumeAudio();

      if (isPlayer && !hasFinished) {
          // Prevent multiple ball drops - check if player has already dropped
          if (hasDroppedBall) {
              return; // Already dropped, can't drop again
          }
          
          // Drop Ball
          const padding = 20;
          const clampedX = Math.max(padding, Math.min(LOGICAL_WIDTH - padding, mousePos.x));
          if (socketRef.current) {
              socketRef.current.emit('drop_ball', { x: clampedX });
              // Mark that we've dropped our ball
              setHasDroppedBall(true);
              // Note: We do NOT spawn locally immediately. We wait for server echo.
              // This ensures everyone spawns at roughly same time.
          }
      } else if (isSpectator) {
          // Blast
          handleSpectatorBlast(e);
      }
  };

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

  return (
    <div 
        ref={wrapperRef} 
        className="w-full h-full flex items-center justify-center relative select-none"
    >
        <div 
            ref={containerRef} 
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            style={{ 
                width: LOGICAL_WIDTH, 
                height: LOGICAL_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                cursor: 'none' 
            }}
            className="relative border-x-4 border-b-4 border-fuchsia-600 rounded-b-xl bg-slate-900/50 backdrop-blur-sm shadow-[0_0_30px_rgba(255,0,255,0.2)] overflow-hidden"
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