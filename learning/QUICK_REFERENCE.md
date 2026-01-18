# Quick Reference Guide - Architecture Concepts

## 🎯 Core Concepts Summary

### 1. Transport Layer (Lesson 1)

**WebSocket Connection:**
```typescript
const channel = supabase.channel('room-1');
channel.subscribe();
```

**Broadcast Message:**
```typescript
channel.send({
  type: 'broadcast',
  event: 'draw-line',
  payload: stroke
});
```

**Listen for Messages:**
```typescript
channel.on('broadcast', { event: 'draw-line' }, ({ payload }) => {
  setStrokes(prev => [...prev, payload]);
});
```

---

### 2. Client Rendering (Lesson 2)

**Canvas Setup:**
```typescript
const ctx = canvas.getContext('2d');
ctx.clearRect(0, 0, 1920, 1080);
```

**Draw Stroke:**
```typescript
ctx.beginPath();
ctx.moveTo(points[0].x, points[0].y);
points.forEach(p => ctx.lineTo(p.x, p.y));
ctx.stroke();
```

**Optimistic UI:**
```typescript
// Update local state immediately
setCurrentStroke({ ...stroke, points: [...points, {x, y}] });

// Send to network in background
channel.send({ type: 'broadcast', event: 'cursor-move', payload });
```

---

### 3. Data Structures (Lesson 4)

**Stroke Object:**
```typescript
interface Stroke {
  id: string;        // UUID
  userId: string;    // Creator
  color: string;     // Hex color
  width: number;     // 4 or 20
  points: Point[];   // Coordinates
}
```

**Size Comparison:**
- Vector: ~880 bytes per stroke
- Raster: 8.3 MB per frame
- **Savings: 9,400× smaller!**

---

### 4. Distributed Consistency (Lesson 5)

**Last-Write-Wins:**
```typescript
// Simply append in order received
setStrokes(prev => [...prev, newStroke]);
```

**Append-Only Architecture:**
- ✅ No deletions
- ✅ No modifications
- ✅ Only additions
- ✅ No conflicts!

**Eraser = White Stroke:**
```typescript
COLORS.ERASER = '#FFFFFF';  // Not deletion!
WIDTHS.ERASER = 20;         // Thick stroke
```

---

## 📊 Decision Matrix

| Decision | Options | Our Choice | Why |
|----------|---------|------------|-----|
| **Transport** | HTTP Polling vs WebSocket | WebSocket | Real-time, low latency |
| **Backend** | Custom Server vs PaaS | Supabase (PaaS) | Fast setup, low cost |
| **Storage** | Raster vs Vector | Vector | 9,400× smaller |
| **Consistency** | CRDT vs LWW | LWW | Simple, good enough |
| **Rendering** | Incremental vs Full Redraw | Full Redraw | Simple, stateless |

---

## 🔄 Data Flow

```
User Input
    ↓
Local State Update (Optimistic UI)
    ↓
Canvas Re-render
    ↓
Network Broadcast (Background)
    ↓
Supabase Relay
    ↓
Other Clients Receive
    ↓
Update Their State
    ↓
Re-render Canvas
```

---

## 📈 Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| **Latency** | 10-50ms | WebSocket message delivery |
| **Cursor Updates** | 20/sec | Throttled to 50ms |
| **Stroke Size** | ~880 bytes | 50 points average |
| **Render Time** | <16ms | 1,000 strokes @ 60 FPS |
| **Memory** | ~800 KB | 1,000 strokes in RAM |

---

## 🛠️ Common Patterns

### Pattern 1: Throttling

```typescript
const lastUpdate = useRef(0);

const throttledUpdate = (data) => {
  const now = Date.now();
  if (now - lastUpdate.current > 50) {  // 50ms
    channel.send(data);
    lastUpdate.current = now;
  }
};
```

### Pattern 2: Coordinate Transform

```typescript
const getCanvasCoords = (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
};
```

### Pattern 3: State Sync (P2P Handshake)

```typescript
// New user requests state
channel.send({
  type: 'broadcast',
  event: 'req-state',
  payload: { requesterId: myId }
});

// Oldest user responds
if (isOldestUser) {
  channel.send({
    type: 'broadcast',
    event: 'sync-state',
    payload: { strokes: allStrokes }
  });
}
```

---

## 🎓 Key Takeaways

1. **Simplicity Wins**: LWW is simpler than CRDTs for our use case
2. **Optimistic UI**: Update local state immediately for perceived performance
3. **Vector Storage**: 9,400× more efficient than raster
4. **PaaS for MVP**: Supabase faster/cheaper than custom server
5. **Append-Only**: Eliminates conflict resolution complexity

---

## 🚨 Common Pitfalls

### Pitfall 1: Not Throttling Cursor Updates
```typescript
// ❌ BAD: Sends 100 messages/sec
onMouseMove = (e) => {
  channel.send({ event: 'cursor-move', payload: coords });
};

// ✅ GOOD: Sends 20 messages/sec
onMouseMove = (e) => {
  if (Date.now() - lastUpdate > 50) {
    channel.send({ event: 'cursor-move', payload: coords });
  }
};
```

### Pitfall 2: Mutating State
```typescript
// ❌ BAD: Mutates array
strokes.push(newStroke);
setStrokes(strokes);

// ✅ GOOD: Creates new array
setStrokes([...strokes, newStroke]);
```

### Pitfall 3: Forgetting Coordinate Transform
```typescript
// ❌ BAD: Uses screen coordinates
const x = e.clientX;
const y = e.clientY;

// ✅ GOOD: Transforms to canvas coordinates
const x = (e.clientX - rect.left) * scaleX;
const y = (e.clientY - rect.top) * scaleY;
```

---

## 📚 Further Learning

### Next Steps
1. Implement exercises from each lesson
2. Add new features (shapes, colors, undo)
3. Optimize performance (viewport culling)
4. Explore CRDTs (try Yjs library)
5. Build your own collaborative app

### Recommended Reading
- Designing Data-Intensive Applications (Martin Kleppmann)
- Figma's Multiplayer Architecture Blog Post
- Yjs Documentation
- Phoenix Framework Guides

---

## 💡 Interview Questions You Can Now Answer

1. **"Explain how WebSockets differ from HTTP"**
   - Persistent connection, bidirectional, low latency

2. **"What is optimistic UI and why use it?"**
   - Update local state immediately, perceived performance

3. **"Vector vs Raster storage for collaborative drawing?"**
   - Vector: 9,400× smaller, scalable, editable

4. **"How do you handle conflicts in distributed systems?"**
   - Last-Write-Wins, append-only, eventual consistency

5. **"When to build custom server vs use PaaS?"**
   - PaaS for MVP, custom for scale/control

---

**You're now ready to build real-time collaborative applications! 🚀**
