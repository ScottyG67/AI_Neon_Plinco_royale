/**
 * Laser handling utilities
 * Handles laser creation, lifecycle, and rendering calculations
 */

import { Laser } from '../types/game';

export const LASER_LIFETIME_MS = 200;

/**
 * Creates a new laser object
 * @param x1 Start X coordinate
 * @param y1 Start Y coordinate
 * @param x2 End X coordinate
 * @param y2 End Y coordinate
 * @param color Laser color
 * @returns New laser object
 */
export function createLaser(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string
): Laser {
  return {
    id: crypto.randomUUID(),
    x1,
    y1,
    x2,
    y2,
    color,
    createdAt: Date.now()
  };
}

/**
 * Filters out expired lasers based on their creation time
 * @param lasers Array of lasers
 * @param currentTime Current timestamp in milliseconds
 * @param lifetime Laser lifetime in milliseconds (default: LASER_LIFETIME_MS)
 * @returns Array of active (non-expired) lasers
 */
export function filterExpiredLasers(
  lasers: Laser[],
  currentTime: number = Date.now(),
  lifetime: number = LASER_LIFETIME_MS
): Laser[] {
  return lasers.filter(laser => currentTime - laser.createdAt < lifetime);
}

/**
 * Calculates the opacity of a laser based on its age
 * @param laser Laser object
 * @param currentTime Current timestamp in milliseconds
 * @param lifetime Laser lifetime in milliseconds (default: LASER_LIFETIME_MS)
 * @returns Opacity value between 0 and 1
 */
export function calculateLaserOpacity(
  laser: Laser,
  currentTime: number = Date.now(),
  lifetime: number = LASER_LIFETIME_MS
): number {
  const age = currentTime - laser.createdAt;
  return Math.max(0, 1 - (age / lifetime));
}

/**
 * Calculates the line width for rendering a laser based on its opacity
 * @param baseWidth Base line width
 * @param opacity Laser opacity (0-1)
 * @returns Scaled line width
 */
export function calculateLaserLineWidth(baseWidth: number, opacity: number): number {
  return baseWidth * opacity;
}
