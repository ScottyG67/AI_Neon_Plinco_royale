/**
 * Coordinate conversion utilities
 * Converts between screen coordinates and logical game coordinates
 */

export interface ContainerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Convert screen coordinates to logical game coordinates
 * @param screenX Screen X coordinate
 * @param screenY Screen Y coordinate
 * @param containerRect Container bounding rectangle
 * @param scale Current scale factor
 * @param logicalWidth Logical game width
 * @param logicalHeight Logical game height
 * @returns Logical coordinates { x, y }
 */
export function screenToLogical(
  screenX: number,
  screenY: number,
  containerRect: ContainerRect,
  scale: number,
  logicalWidth: number,
  logicalHeight: number
): { x: number; y: number } {
  // Calculate container center
  const centerX = containerRect.left + containerRect.width / 2;
  const centerY = containerRect.top + containerRect.height / 2;

  // Get relative position from center
  const relativeX = screenX - centerX;
  const relativeY = screenY - centerY;

  // Convert to logical coordinates (accounting for scale)
  const logicalX = (relativeX / scale) + logicalWidth / 2;
  const logicalY = logicalHeight / 2 - (relativeY / scale);

  return { x: logicalX, y: logicalY };
}

/**
 * Convert logical game coordinates to screen coordinates
 * @param logicalX Logical X coordinate
 * @param logicalY Logical Y coordinate
 * @param containerRect Container bounding rectangle
 * @param scale Current scale factor
 * @param logicalWidth Logical game width
 * @param logicalHeight Logical game height
 * @returns Screen coordinates { x, y }
 */
export function logicalToScreen(
  logicalX: number,
  logicalY: number,
  containerRect: ContainerRect,
  scale: number,
  logicalWidth: number,
  logicalHeight: number
): { x: number; y: number } {
  // Calculate container center
  const centerX = containerRect.left + containerRect.width / 2;
  const centerY = containerRect.top + containerRect.height / 2;

  // Convert from logical to relative coordinates
  const relativeX = (logicalX - logicalWidth / 2) * scale;
  const relativeY = (logicalHeight / 2 - logicalY) * scale;

  // Convert to screen coordinates
  const screenX = centerX + relativeX;
  const screenY = centerY + relativeY;

  return { x: screenX, y: screenY };
}

/**
 * Clamp coordinates to play area bounds
 * @param x X coordinate
 * @param y Y coordinate
 * @param logicalWidth Logical game width
 * @param logicalHeight Logical game height
 * @param padding Padding from edges (default: 20)
 * @returns Clamped coordinates { x, y }
 */
export function clampToPlayArea(
  x: number,
  y: number,
  logicalWidth: number,
  logicalHeight: number,
  padding: number = 20
): { x: number; y: number } {
  return {
    x: Math.max(padding, Math.min(logicalWidth - padding, x)),
    y: Math.max(padding, Math.min(logicalHeight - padding, y))
  };
}

/**
 * Convert screen coordinates to Matter.js logical coordinates (top-left origin)
 * Matter.js uses top-left origin: X: 0 to width, Y: 0 to height
 * @param screenX Screen X coordinate
 * @param screenY Screen Y coordinate
 * @param containerRect Container bounding rectangle
 * @param scale Current scale factor
 * @param logicalWidth Logical game width
 * @param logicalHeight Logical game height
 * @returns Logical coordinates { x, y } in Matter.js coordinate system
 */
export function screenToLogicalMatter(
  screenX: number,
  screenY: number,
  containerRect: ContainerRect,
  scale: number,
  logicalWidth: number,
  logicalHeight: number
): { x: number; y: number } {
  // Get relative position from container top-left
  const relativeX = screenX - containerRect.left;
  const relativeY = screenY - containerRect.top;
  
  // Convert to logical coordinates (accounting for scale)
  // Matter.js uses top-left origin, so no center offset needed
  const logicalX = (relativeX / scale);
  const logicalY = (relativeY / scale);
  
  return { x: logicalX, y: logicalY };
}

/**
 * Clamp coordinates to Matter.js play area bounds (top-left origin)
 * @param x X coordinate (Matter.js system: 0 to width)
 * @param y Y coordinate (Matter.js system: 0 to height)
 * @param logicalWidth Logical game width
 * @param logicalHeight Logical game height
 * @param padding Padding from edges (default: 20)
 * @returns Clamped coordinates { x, y }
 */
export function clampToPlayAreaMatter(
  x: number,
  y: number,
  logicalWidth: number,
  logicalHeight: number,
  padding: number = 20
): { x: number; y: number } {
  return {
    x: Math.max(padding, Math.min(logicalWidth - padding, x)),
    y: Math.max(padding, Math.min(logicalHeight - padding, y))
  };
}
