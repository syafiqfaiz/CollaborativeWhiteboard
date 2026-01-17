import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWhiteboard } from './useWhiteboard';

const { mockChannel } = vi.hoisted(() => {
    const channel: any = {
        on: vi.fn(),
        subscribe: vi.fn(),
        send: vi.fn(),
        track: vi.fn(),
        presenceState: vi.fn().mockReturnValue({}),
    };

    channel.on.mockReturnValue(channel);
    // subscribe can return a subscription object, or undefined in older versions,
    // but typically it returns Subscription. My code checks status in callback.
    channel.subscribe.mockImplementation((cb: any) => {
        if (cb) cb('SUBSCRIBED');
        return { unsubscribe: vi.fn() };
    });

    return { mockChannel: channel };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  },
}));

describe('useWhiteboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset internal state of mockChannel if needed, but vitest mockReset clears calls.
    // We need to restore the mockImplementation of subscribe though if we cleared it?
    // vi.clearAllMocks clears call history. vi.resetAllMocks clears implementations.
    // I should strictly use clearAllMocks.
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWhiteboard());
    expect(result.current.strokes).toEqual([]);
    expect(result.current.currentStroke).toBeNull();
  });

  it('should update currentStroke when drawing', () => {
    const { result } = renderHook(() => useWhiteboard());

    act(() => {
      result.current.startDrawing(10, 10);
    });

    expect(result.current.currentStroke).not.toBeNull();
    expect(result.current.currentStroke?.points).toEqual([{ x: 10, y: 10 }]);

    act(() => {
      result.current.draw(20, 20);
    });

    expect(result.current.currentStroke?.points).toHaveLength(2);
    expect(result.current.currentStroke?.points[1]).toEqual({ x: 20, y: 20 });
  });

  it('should add stroke to history on endDrawing', () => {
    const { result } = renderHook(() => useWhiteboard());

    act(() => {
      result.current.startDrawing(10, 10);
      result.current.draw(20, 20);
      result.current.endDrawing();
    });

    expect(result.current.strokes).toHaveLength(1);
    expect(result.current.currentStroke).toBeNull();
    // Check if broadcast was sent
    expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({
        event: 'draw-line'
    }));
  });

  it('should set display name', () => {
      const { result } = renderHook(() => useWhiteboard());
      act(() => {
          result.current.setDisplayName('Alice');
      });
      expect(result.current.currentUser.name).toBe('Alice');
  });

  it('should update tool', () => {
      const { result } = renderHook(() => useWhiteboard());
      act(() => {
          result.current.setTool('#FF0000', 10);
      });
      expect(result.current.currentUser.color).toBe('#FF0000');
      expect(result.current.currentUser.width).toBe(10);
  });
});
