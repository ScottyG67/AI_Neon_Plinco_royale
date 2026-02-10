/**
 * Collision detection utilities for Plinko game
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Sensor {
  position: [number, number, number];
  size: [number, number, number];
  points: number;
  index: number;
}

export interface BounceDetectionState {
  prevVelocity: Vector3;
  lastBounceTime: number;
  hasStartedFalling: boolean;
}

export interface SensorDetectionState {
  contactedSensors: Set<number>;
}

export interface BoundaryBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Detects if a bounce occurred based on velocity changes
 * @param currentVelocity Current velocity vector
 * @param state Previous state for bounce detection
 * @param currentTime Current timestamp in milliseconds
 * @param minSpeed Minimum speed to consider a collision (default: 2)
 * @param minBounceInterval Minimum time between bounce sounds in ms (default: 150)
 * @returns true if a bounce was detected, false otherwise
 */
export function detectBounce(
  currentVelocity: Vector3,
  state: BounceDetectionState,
  currentTime: number,
  minSpeed: number = 2,
  minBounceInterval: number = 150
): boolean {
  // Track if ball has started falling
  if (currentVelocity.y < -1) {
    state.hasStartedFalling = true;
  }

  // Only detect bounces after ball has started falling
  if (!state.hasStartedFalling) {
    state.prevVelocity = { ...currentVelocity };
    return false;
  }

  const speed = Math.sqrt(
    currentVelocity.x * currentVelocity.x + 
    currentVelocity.y * currentVelocity.y
  );

  const prevVel = state.prevVelocity;

  // Check if Y velocity reversed (ball bounced up/down) or X velocity reversed (hit side)
  const yReversed = 
    (prevVel.y < 0 && currentVelocity.y > 0) || 
    (prevVel.y > 0 && currentVelocity.y < 0);
  const xReversed = 
    (prevVel.x < 0 && currentVelocity.x > 0) || 
    (prevVel.x > 0 && currentVelocity.x < 0);

  // Only trigger on significant velocity reversals (actual bounces)
  const isBounce = (yReversed || xReversed) && 
                   speed > minSpeed && 
                   Math.abs(currentVelocity.y) > 1;

  // Always update previous velocity for next frame
  state.prevVelocity = { ...currentVelocity };

  if (isBounce) {
    const timeSinceLastBounce = currentTime - state.lastBounceTime;
    if (timeSinceLastBounce > minBounceInterval) {
      console.log('[COLLISION] Bounce detected:', {
        yReversed,
        xReversed,
        speed: speed.toFixed(2),
        velocity: { x: currentVelocity.x.toFixed(2), y: currentVelocity.y.toFixed(2) },
        timeSinceLastBounce,
        timestamp: currentTime
      });
      state.lastBounceTime = currentTime;
      return true;
    } else {
      console.log('[COLLISION] Bounce detected but throttled:', {
        timeSinceLastBounce,
        minBounceInterval,
        speed: speed.toFixed(2)
      });
    }
  }

  return false;
}

/**
 * Detects if ball is colliding with a sensor (scoring bucket)
 * @param ballPosition Current ball position
 * @param ballRadius Ball radius
 * @param sensors Array of sensor definitions
 * @param state Previous state for sensor detection
 * @returns Sensor that was hit, or null if none
 */
export function detectSensorCollision(
  ballPosition: Vector3,
  ballRadius: number,
  sensors: Sensor[],
  state: SensorDetectionState
): Sensor | null {
  for (const sensor of sensors) {
    // Skip if already contacted this sensor
    if (state.contactedSensors.has(sensor.index)) {
      continue;
    }

    const [sx, sy, sz] = sensor.position;
    const [sw, sh, sd] = sensor.size;

    // Check if ball center is within sensor bounds (with tolerance)
    const xMin = sx - sw/2 - ballRadius;
    const xMax = sx + sw/2 + ballRadius;
    const yMin = sy - sh/2 - ballRadius;
    const yMax = sy + sh/2 + ballRadius;
    
    const inX = ballPosition.x >= xMin && ballPosition.x <= xMax;
    const inY = ballPosition.y >= yMin && ballPosition.y <= yMax;
    // Z check: use absolute distance since sensors are symmetric in Z
    const inZ = Math.abs(ballPosition.z - sz) < sd/2 + ballRadius;
    
    // Debug logging for near misses (only log occasionally to avoid spam)
    if (Math.random() < 0.001 && inX && !inY && Math.abs(ballPosition.y - sy) < sh + ballRadius * 3) {
      console.log('[COLLISION] Near miss - X in bounds but Y out:', {
        sensorIndex: sensor.index,
        points: sensor.points,
        ballY: ballPosition.y.toFixed(2),
        sensorY: sy.toFixed(2),
        yMin: yMin.toFixed(2),
        yMax: yMax.toFixed(2),
        yDiff: (ballPosition.y - sy).toFixed(2),
        ballX: ballPosition.x.toFixed(2),
        sensorX: sx.toFixed(2),
        xMin: xMin.toFixed(2),
        xMax: xMax.toFixed(2)
      });
    }

    if (inX && inY && inZ) {
      const wasAlreadyContacted = state.contactedSensors.has(sensor.index);
      state.contactedSensors.add(sensor.index);
      
      if (!wasAlreadyContacted) {
        console.log('[COLLISION] Sensor collision detected:', {
          sensorIndex: sensor.index,
          points: sensor.points,
          ballPosition: { x: ballPosition.x.toFixed(2), y: ballPosition.y.toFixed(2), z: ballPosition.z.toFixed(2) },
          sensorPosition: sensor.position,
          sensorSize: sensor.size,
          ballRadius,
          contactedSensors: Array.from(state.contactedSensors)
        });
        return sensor;
      } else {
        console.log('[COLLISION] Sensor already contacted (ignoring):', {
          sensorIndex: sensor.index,
          points: sensor.points
        });
      }
    }
  }

  return null;
}

/**
 * Creates initial bounce detection state
 */
export function createBounceDetectionState(): BounceDetectionState {
  return {
    prevVelocity: { x: 0, y: 0, z: 0 },
    lastBounceTime: 0,
    hasStartedFalling: false
  };
}

/**
 * Creates initial sensor detection state
 */
export function createSensorDetectionState(): SensorDetectionState {
  return {
    contactedSensors: new Set<number>()
  };
}

/**
 * Resets sensor detection state (useful for new rounds)
 */
export function resetSensorDetectionState(state: SensorDetectionState): void {
  state.contactedSensors.clear();
}

/**
 * Creates boundary bounds for the play area (center origin coordinate system)
 * @param logicalWidth Logical game width
 * @param logicalHeight Logical game height
 * @param ballRadius Ball radius
 * @param topExtension Additional space at top (default: 0)
 * @returns Boundary bounds
 */
export function createBoundaryBounds(
  logicalWidth: number,
  logicalHeight: number,
  ballRadius: number,
  topExtension: number = 0
): BoundaryBounds {
  const halfWidth = logicalWidth / 2;
  const halfHeight = logicalHeight / 2;

  return {
    left: -halfWidth - ballRadius,
    right: halfWidth + ballRadius,
    top: halfHeight + ballRadius + topExtension,
    bottom: -halfHeight - ballRadius
  };
}

/**
 * Creates boundary bounds for Matter.js coordinate system (top-left origin)
 * @param logicalWidth Logical game width
 * @param logicalHeight Logical game height
 * @param ballRadius Ball radius
 * @param topExtension Additional space at top (default: 0)
 * @returns Boundary bounds in Matter.js coordinate system
 */
export function createBoundaryBoundsMatter(
  logicalWidth: number,
  logicalHeight: number,
  ballRadius: number,
  topExtension: number = 0
): BoundaryBounds {
  return {
    left: -ballRadius,
    right: logicalWidth + ballRadius,
    top: -ballRadius - topExtension,
    bottom: logicalHeight + ballRadius
  };
}

/**
 * Detects if a ball has escaped the play area boundaries
 * Works for both center-origin (Rapier/Three.js) and top-left-origin (Matter.js) coordinate systems
 * @param ballPosition Current ball position
 * @param ballRadius Ball radius
 * @param bounds Boundary bounds
 * @returns true if ball has escaped, false otherwise
 */
export function detectBoundaryEscape(
  ballPosition: Vector3,
  ballRadius: number,
  bounds: BoundaryBounds
): boolean {
  // Check X boundaries (same for both coordinate systems)
  if (ballPosition.x < bounds.left || ballPosition.x > bounds.right) {
    return true;
  }
  
  // Check Y boundaries - depends on coordinate system
  // For center-origin: top > bottom (e.g., top=412.5, bottom=-412.5)
  // For Matter.js: top < bottom (e.g., top=-112.5, bottom=812.5)
  const isCenterOrigin = bounds.top > bounds.bottom;
  
  if (isCenterOrigin) {
    // Center-origin: ball escapes if y > top OR y < bottom
    return ballPosition.y > bounds.top || ballPosition.y < bounds.bottom;
  } else {
    // Matter.js (top-left origin): ball escapes if y < top OR y > bottom
    return ballPosition.y < bounds.top || ballPosition.y > bounds.bottom;
  }
}
