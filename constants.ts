import { Bucket } from './types';

// Synthwave Palette
export const COLORS = {
  background: '#0f0518',
  peg: '#ff00ff', // Magenta
  wall: '#2d1b4e',
  ballDefault: '#00ffff', // Cyan
  ballCheater: '#ffff00', // Yellow
  text: '#ffffff',
  accent: '#9d00ff', // Purple
  buckets: ['#ff0055', '#ff5500', '#ffff00', '#00ff00', '#00ffff'],
};

export const CHEAT_NAME = "TotallyNotCheating";

// Physics Categories (Bitmasks)
export const CATEGORY_PEG = 0x0001;
export const CATEGORY_WALL = 0x0002;
export const CATEGORY_BALL = 0x0004;
export const CATEGORY_SENSOR = 0x0008;

// Buckets Configuration
// We'll generate these dynamically based on board width in the component, 
// but here are the point values from center outward.
// Center is index 3 (if 7 buckets) or logic dependent.
export const POINT_DISTRIBUTION = [10, 25, 50, 100, 50, 25, 10];