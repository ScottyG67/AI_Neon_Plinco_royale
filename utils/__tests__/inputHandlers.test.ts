import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMouseMoveHandler,
  createTouchMoveHandler,
  createTouchEndHandler,
  createPointerDownHandler,
  createClickHandler,
  type InputHandlerOptions
} from '../inputHandlers';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../gameConstants';

describe('inputHandlers', () => {
  let mockContainerRef: React.RefObject<HTMLDivElement>;
  let mockWrapperRef: React.RefObject<HTMLDivElement>;
  let onPositionUpdate: (pos: { x: number; y: number }) => void;
  let onAction: (pos: { x: number; y: number }) => void;

  beforeEach(() => {
    onPositionUpdate = vi.fn();
    onAction = vi.fn();

    // Create mock DOM elements
    const containerElement = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: LOGICAL_WIDTH,
        height: LOGICAL_HEIGHT
      })
    } as HTMLDivElement;

    const wrapperElement = {
      getBoundingClientRect: () => ({
        left: 100,
        top: 100,
        width: LOGICAL_WIDTH * 2,
        height: LOGICAL_HEIGHT * 2
      })
    } as HTMLDivElement;

    mockContainerRef = { current: containerElement };
    mockWrapperRef = { current: wrapperElement };
  });

  describe('createMouseMoveHandler', () => {
    it('should update position on mouse move', () => {
      const options: InputHandlerOptions = {
        containerRef: mockContainerRef,
        wrapperRef: mockWrapperRef,
        scale: 1,
        onPositionUpdate
      };

      const handler = createMouseMoveHandler(options);
      const mockEvent = {
        clientX: 100 + LOGICAL_WIDTH / 2,
        clientY: 100 + LOGICAL_HEIGHT / 2,
        preventDefault: vi.fn()
      } as unknown as React.MouseEvent;

      handler(mockEvent);

      expect(onPositionUpdate).toHaveBeenCalled();
      const call = onPositionUpdate.mock.calls[0][0];
      expect(call).toHaveProperty('x');
      expect(call).toHaveProperty('y');
    });

    it('should handle null refs gracefully', () => {
      const nullRef = { current: null };
      const options: InputHandlerOptions = {
        containerRef: nullRef,
        wrapperRef: nullRef,
        scale: 1,
        onPositionUpdate
      };

      const handler = createMouseMoveHandler(options);
      const mockEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: vi.fn()
      } as unknown as React.MouseEvent;

      handler(mockEvent);

      expect(onPositionUpdate).not.toHaveBeenCalled();
    });
  });

  describe('createTouchMoveHandler', () => {
    it('should update position on touch move', () => {
      const options: InputHandlerOptions = {
        containerRef: mockContainerRef,
        wrapperRef: mockWrapperRef,
        scale: 1,
        onPositionUpdate
      };

      const handler = createTouchMoveHandler(options);
      const mockEvent = {
        touches: [{
          clientX: 100 + LOGICAL_WIDTH / 2,
          clientY: 100 + LOGICAL_HEIGHT / 2
        }],
        preventDefault: vi.fn()
      } as unknown as React.TouchEvent;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onPositionUpdate).toHaveBeenCalled();
    });

    it('should handle empty touches array', () => {
      const options: InputHandlerOptions = {
        containerRef: mockContainerRef,
        wrapperRef: mockWrapperRef,
        scale: 1,
        onPositionUpdate
      };

      const handler = createTouchMoveHandler(options);
      const mockEvent = {
        touches: [],
        preventDefault: vi.fn()
      } as unknown as React.TouchEvent;

      handler(mockEvent);

      expect(onPositionUpdate).not.toHaveBeenCalled();
    });
  });

  describe('createTouchEndHandler', () => {
    it('should call onAction when touch ends', () => {
      const options: InputHandlerOptions = {
        containerRef: mockContainerRef,
        wrapperRef: mockWrapperRef,
        scale: 1,
        onPositionUpdate,
        onAction
      };

      const handler = createTouchEndHandler(options);
      const mockEvent = {
        changedTouches: [{
          clientX: 100 + LOGICAL_WIDTH / 2,
          clientY: 100 + LOGICAL_HEIGHT / 2
        }],
        preventDefault: vi.fn()
      } as unknown as React.TouchEvent;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(onAction).toHaveBeenCalled();
    });

    it('should not call onAction if not provided', () => {
      const options: InputHandlerOptions = {
        containerRef: mockContainerRef,
        wrapperRef: mockWrapperRef,
        scale: 1,
        onPositionUpdate
      };

      const handler = createTouchEndHandler(options);
      const mockEvent = {
        changedTouches: [{
          clientX: 100,
          clientY: 100
        }],
        preventDefault: vi.fn()
      } as unknown as React.TouchEvent;

      handler(mockEvent);

      expect(onAction).not.toHaveBeenCalled();
    });
  });

  describe('createPointerDownHandler', () => {
    it('should call onAction when pointer down', async () => {
      const options: InputHandlerOptions = {
        containerRef: mockContainerRef,
        wrapperRef: mockWrapperRef,
        scale: 1,
        onPositionUpdate,
        onAction
      };

      const handler = createPointerDownHandler(options);
      const mockEvent = {
        clientX: 100 + LOGICAL_WIDTH / 2,
        clientY: 100 + LOGICAL_HEIGHT / 2,
        preventDefault: vi.fn()
      } as unknown as React.PointerEvent;

      handler(mockEvent);

      // Wait for setTimeout
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(onAction).toHaveBeenCalled();
    });
  });

  describe('createClickHandler', () => {
    it('should clamp position and call onAction', () => {
      const options: InputHandlerOptions = {
        containerRef: mockContainerRef,
        wrapperRef: mockWrapperRef,
        scale: 1,
        onPositionUpdate,
        onAction
      };

      const handler = createClickHandler(options, 20);
      const mockEvent = {
        clientX: 100 + LOGICAL_WIDTH / 2,
        clientY: 100 + LOGICAL_HEIGHT / 2,
        preventDefault: vi.fn()
      } as unknown as React.MouseEvent;

      handler(mockEvent);

      expect(onAction).toHaveBeenCalled();
      const call = onAction.mock.calls[0][0];
      // Position should be clamped within bounds
      expect(call.x).toBeGreaterThanOrEqual(20);
      expect(call.x).toBeLessThanOrEqual(LOGICAL_WIDTH - 20);
      expect(call.y).toBeGreaterThanOrEqual(20);
      expect(call.y).toBeLessThanOrEqual(LOGICAL_HEIGHT - 20);
    });

    it('should use custom padding', () => {
      const options: InputHandlerOptions = {
        containerRef: mockContainerRef,
        wrapperRef: mockWrapperRef,
        scale: 1,
        onPositionUpdate,
        onAction
      };

      const handler = createClickHandler(options, 50);
      const mockEvent = {
        clientX: 100 + LOGICAL_WIDTH / 2,
        clientY: 100 + LOGICAL_HEIGHT / 2,
        preventDefault: vi.fn()
      } as unknown as React.MouseEvent;

      handler(mockEvent);

      const call = onAction.mock.calls[0][0];
      expect(call.x).toBeGreaterThanOrEqual(50);
      expect(call.x).toBeLessThanOrEqual(LOGICAL_WIDTH - 50);
    });
  });
});
