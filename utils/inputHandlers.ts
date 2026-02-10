/**
 * Input handler utilities
 * Handles mouse and touch events with coordinate conversion
 */

import { screenToLogicalMatter, clampToPlayAreaMatter, type ContainerRect } from './coordinateConversion';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './gameConstants';

export interface InputHandlerOptions {
  containerRef: React.RefObject<HTMLDivElement>;
  wrapperRef: React.RefObject<HTMLDivElement>;
  scale: number;
  onPositionUpdate: (pos: { x: number; y: number }) => void;
  onAction?: (pos: { x: number; y: number }) => void;
}

/**
 * Gets the container rectangle for coordinate conversion
 * @param containerRef Container element ref
 * @param wrapperRef Wrapper element ref
 * @param scale Current scale factor
 * @returns Container rectangle or null if refs are not available
 */
function getContainerRect(
  containerRef: React.RefObject<HTMLDivElement>,
  wrapperRef: React.RefObject<HTMLDivElement>,
  scale: number
): ContainerRect | null {
  if (!containerRef.current || !wrapperRef.current) return null;

  const wrapperRect = wrapperRef.current.getBoundingClientRect();
  const scaledWidth = LOGICAL_WIDTH * scale;
  const scaledHeight = LOGICAL_HEIGHT * scale;
  const offsetX = (wrapperRect.width - scaledWidth) / 2;
  const offsetY = (wrapperRect.height - scaledHeight) / 2;

  return {
    left: wrapperRect.left + offsetX,
    top: wrapperRect.top + offsetY,
    width: scaledWidth,
    height: scaledHeight
  };
}

/**
 * Converts screen coordinates to logical coordinates and updates position
 * @param screenX Screen X coordinate
 * @param screenY Screen Y coordinate
 * @param options Input handler options
 * @returns Logical coordinates or null if conversion failed
 */
function convertAndUpdatePosition(
  screenX: number,
  screenY: number,
  options: InputHandlerOptions
): { x: number; y: number } | null {
  const containerRect = getContainerRect(
    options.containerRef,
    options.wrapperRef,
    options.scale
  );

  if (!containerRect) return null;

  const logical = screenToLogicalMatter(
    screenX,
    screenY,
    containerRect,
    options.scale,
    LOGICAL_WIDTH,
    LOGICAL_HEIGHT
  );

  options.onPositionUpdate(logical);
  return logical;
}

/**
 * Creates mouse move event handler
 * @param options Input handler options
 * @returns Mouse move event handler
 */
export function createMouseMoveHandler(
  options: InputHandlerOptions
): (e: React.MouseEvent) => void {
  return (e: React.MouseEvent) => {
    convertAndUpdatePosition(e.clientX, e.clientY, options);
  };
}

/**
 * Creates touch move event handler
 * @param options Input handler options
 * @returns Touch move event handler
 */
export function createTouchMoveHandler(
  options: InputHandlerOptions
): (e: React.TouchEvent) => void {
  return (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      convertAndUpdatePosition(touch.clientX, touch.clientY, options);
    }
  };
}

/**
 * Creates touch end event handler
 * @param options Input handler options
 * @returns Touch end event handler
 */
export function createTouchEndHandler(
  options: InputHandlerOptions
): (e: React.TouchEvent) => void {
  return (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.changedTouches.length > 0 && options.onAction) {
      const touch = e.changedTouches[0];
      const logical = convertAndUpdatePosition(touch.clientX, touch.clientY, options);
      if (logical) {
        options.onAction(logical);
      }
    }
  };
}

/**
 * Creates pointer down event handler
 * @param options Input handler options
 * @returns Pointer down event handler
 */
export function createPointerDownHandler(
  options: InputHandlerOptions
): (e: React.PointerEvent) => void {
  return (e: React.PointerEvent) => {
    if (options.onAction) {
      const logical = convertAndUpdatePosition(e.clientX, e.clientY, options);
      if (logical) {
        // Small delay to ensure position is updated
        setTimeout(() => {
          if (options.onAction) {
            options.onAction(logical);
          }
        }, 0);
      }
    }
  };
}

/**
 * Creates click event handler with position clamping
 * @param options Input handler options
 * @param padding Padding from edges for clamping (default: 20)
 * @returns Click event handler
 */
export function createClickHandler(
  options: InputHandlerOptions,
  padding: number = 20
): (e: React.MouseEvent) => void {
  return (e: React.MouseEvent) => {
    if (options.onAction) {
      const logical = convertAndUpdatePosition(e.clientX, e.clientY, options);
      if (logical) {
        const clamped = clampToPlayAreaMatter(
          logical.x,
          logical.y,
          LOGICAL_WIDTH,
          LOGICAL_HEIGHT,
          padding
        );
        options.onAction(clamped);
      }
    }
  };
}
