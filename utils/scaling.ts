/**
 * Scaling utilities for responsive game display
 */

export interface ScaleOptions {
  minScale?: number;
  maxScale?: number;
  padding?: number; // 0-1, default 0.95
  minScaleThreshold?: number; // default 0.3
}

/**
 * Calculate scale factor to fit logical dimensions within available space
 * @param availableWidth Available container width in pixels
 * @param availableHeight Available container height in pixels
 * @param logicalWidth Logical game width
 * @param logicalHeight Logical game height
 * @param options Scaling options
 * @returns Scale factor (0-1 or higher)
 */
export function calculateScale(
  availableWidth: number,
  availableHeight: number,
  logicalWidth: number,
  logicalHeight: number,
  options?: ScaleOptions
): number {
  const {
    minScale = 0,
    maxScale = Infinity,
    padding = 0.95,
    minScaleThreshold = 0.3
  } = options || {};

  // Handle edge cases
  if (availableWidth <= 0 || availableHeight <= 0) {
    return minScaleThreshold;
  }

  if (logicalWidth <= 0 || logicalHeight <= 0) {
    return 1;
  }

  // Calculate scale for width and height
  const scaleW = availableWidth / logicalWidth;
  const scaleH = availableHeight / logicalHeight;

  // Use the smaller scale to ensure everything fits
  let scale = Math.min(scaleW, scaleH);

  // Apply padding
  scale *= padding;

  // Apply minimum threshold
  scale = Math.max(minScaleThreshold, scale);

  // Apply min/max constraints
  scale = Math.max(minScale, Math.min(maxScale, scale));

  return scale;
}

/**
 * Creates initial scaling state
 */
export interface ScaleState {
  scale: number;
  lastCalculated: number;
}

export function createScaleState(): ScaleState {
  return {
    scale: 1,
    lastCalculated: Date.now()
  };
}
