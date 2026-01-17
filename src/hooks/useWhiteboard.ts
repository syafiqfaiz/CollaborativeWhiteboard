import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import type { Stroke, UserCursor, ReqStatePayload, SyncStatePayload } from '../types';

export const COLORS = {
  BLACK: '#000000',
  RED: '#FF0000',
  BLUE: '#0000FF',
  GREEN: '#008000',
  ERASER: '#FFFFFF',
};

export const WIDTHS = {
  PEN: 4,
  ERASER: 20,
};

export function useWhiteboard() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [peers, setPeers] = useState<UserCursor[]>([]);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);

  const [currentUser, setCurrentUser] = useState(() => ({
    id: uuidv4(),
    name: '',
    color: COLORS.BLACK,
    width: WIDTHS.PEN,
  }));

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastCursorUpdate = useRef(0);
  const strokesRef = useRef<Stroke[]>([]);
  const hasRequestedState = useRef(false);

  // Sync ref with state
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('room') || 'room-1';
    const channel = supabase.channel(roomId);

    channel
      .on('broadcast', { event: 'cursor-move' }, ({ payload }: { payload: UserCursor }) => {
        setPeers((prev) => {
          const otherPeers = prev.filter((p) => p.id !== payload.id);
          return [...otherPeers, payload];
        });
      })
      .on('broadcast', { event: 'draw-line' }, ({ payload }: { payload: Stroke }) => {
        setStrokes((prev) => [...prev, payload]);
      })
      .on('broadcast', { event: 'req-state' }, ({ payload }: { payload: ReqStatePayload }) => {
        // Don't reply if I am the requester (though the condition below handles it as I wouldn't be oldest usually if I just joined, but good to be safe)
        if (payload.requesterId === currentUser.id) return;

        const state = channel.presenceState();
        const allPresences: { user_id: string; online_at: string }[] = [];
        for (const key in state) {
          allPresences.push(...(state[key] as { user_id: string; online_at: string }[]));
        }
        // Sort asc by online_at
        allPresences.sort((a, b) => {
          const timeA = new Date(a.online_at).getTime();
          const timeB = new Date(b.online_at).getTime();
          return timeA - timeB;
        });

        // If I am the oldest, send state
        if (allPresences.length > 0 && allPresences[0].user_id === currentUser.id) {
          channel.send({
            type: 'broadcast',
            event: 'sync-state',
            payload: { strokes: strokesRef.current },
          });
        }
      })
      .on('broadcast', { event: 'sync-state' }, ({ payload }: { payload: SyncStatePayload }) => {
        // Replace state with received state
        setStrokes(payload.strokes);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const allPresences: { user_id: string; online_at: string; name?: string }[] = [];
        for (const key in state) {
          allPresences.push(...(state[key] as { user_id: string; online_at: string; name?: string }[]));
        }

        setActiveUsers(allPresences.map((p) => p.name || 'Anonymous'));

        // If we haven't requested state and there are other people
        if (!hasRequestedState.current && allPresences.length > 1) {
          channel.send({
            type: 'broadcast',
            event: 'req-state',
            payload: { requesterId: currentUser.id },
          });
          hasRequestedState.current = true;
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: currentUser.id,
            name: currentUser.name,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id]); // Run once on mount

  // Update presence when name changes
  useEffect(() => {
    if (channelRef.current && currentUser.name) {
      channelRef.current.track({
        online_at: new Date().toISOString(),
        user_id: currentUser.id,
        name: currentUser.name,
      });
    }
  }, [currentUser.name, currentUser.id]);

  const startDrawing = useCallback(
    (x: number, y: number) => {
      const newStroke: Stroke = {
        id: uuidv4(),
        userId: currentUser.id,
        color: currentUser.color,
        width: currentUser.width,
        points: [{ x, y }],
      };
      setCurrentStroke(newStroke);
    },
    [currentUser.id, currentUser.color, currentUser.width],
  );

  const draw = useCallback(
    (x: number, y: number) => {
      setCurrentStroke((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, { x, y }],
        };
      });

      // Also broadcast cursor move while drawing
      const now = Date.now();
      if (now - lastCursorUpdate.current > 50) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'cursor-move',
          payload: { id: currentUser.id, x, y, name: currentUser.name },
        });
        lastCursorUpdate.current = now;
      }
    },
    [currentUser.id, currentUser.name],
  );

  const moveCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastCursorUpdate.current > 50) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'cursor-move',
          payload: { id: currentUser.id, x, y, name: currentUser.name },
        });
        lastCursorUpdate.current = now;
      }
    },
    [currentUser.id, currentUser.name],
  );

  const endDrawing = useCallback(() => {
    setCurrentStroke((prev) => {
      if (prev) {
        setStrokes((history) => [...history, prev]);
        channelRef.current?.send({
          type: 'broadcast',
          event: 'draw-line',
          payload: prev,
        });
      }
      return null;
    });
  }, []);

  const setTool = useCallback((color: string, width: number) => {
    setCurrentUser((prev) => ({ ...prev, color, width }));
  }, []);

  const setDisplayName = useCallback((name: string) => {
    setCurrentUser((prev) => ({ ...prev, name }));
  }, []);

  return {
    strokes,
    setStrokes,
    currentStroke,
    peers,
    currentUser,
    startDrawing,
    draw,
    moveCursor,
    endDrawing,
    setTool,
    setDisplayName,
    activeUsers,
  };
}
