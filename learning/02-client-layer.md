# Lesson 2: Client Layer - Canvas Rendering, Optimistic UI, and the Main Loop

## Learning Objectives
By the end of this lesson, you'll understand:
- How HTML5 Canvas API renders graphics
- The "Optimistic UI" pattern for perceived performance
- The rendering loop that keeps the canvas updated
- Coordinate transformation between screen and canvas space

---

## 1. HTML5 Canvas Fundamentals

### What is Canvas?

Canvas is a **raster-based** (pixel) drawing surface in HTML.

```html
<canvas width="1920" height="1080"></canvas>
```

**Key Concepts:**
- **Resolution**: Fixed pixel dimensions (1920×1080)
- **Context**: 2D or 3D rendering context
- **Imperative API**: You tell it exactly what to draw

### Canvas vs SVG

| Canvas (Raster) | SVG (Vector) |
|----------------|--------------|
| Pixel-based bitmap | Mathematical shapes |
| Fast for many objects | Slow with many objects |
| No DOM nodes | Each shape is a DOM element |
| Can't select individual shapes | Can select/style shapes |
| **Our choice** ✅ | Not suitable for whiteboard |

---

## 2. Getting the Rendering Context

**File:** `src/components/Canvas.tsx` (Lines 41-44)

```typescript
const canvas = canvasRef.current;
if (!canvas) return;

const ctx = canvas.getContext('2d');
if (!ctx) return;
```

**What's happening:**
1. Get reference to `<canvas>` element
2. Request 2D rendering context
3. `ctx` is our drawing API

---

## 3. The Main Rendering Loop

### React's useEffect as the Game Loop

**File:** `src/components/Canvas.tsx` (Lines 40-60)

```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. CLEAR: Erase everything
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. BACKGROUND: Fill with white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3. HISTORY: Draw all completed strokes
  strokes.forEach((stroke) => drawStroke(ctx, stroke));

  // 4. CURRENT: Draw stroke being drawn right now
  if (currentStroke) {
    drawStroke(ctx, currentStroke);
  }
}, [strokes, currentStroke]);  // Re-run when data changes
```

### Why Full Redraw?

**Alternative Approaches:**
1. **Incremental Drawing**: Only draw new strokes
   - ❌ Complex: Need to track what's been drawn
   - ❌ Eraser doesn't work (can't "undraw")

2. **Full Redraw** (Our Choice):
   - ✅ Simple: Always renders correct state
   - ✅ Stateless: Canvas doesn't remember anything
   - ✅ Fast enough: 1000 strokes renders in ~16ms (60 FPS)

---

## 4. Drawing a Stroke with Canvas API

**File:** `src/components/Canvas.tsx` (Lines 26-38)

```typescript
const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  if (stroke.points.length < 1) return;
  
  // Configure stroke style
  ctx.beginPath();              // Start new path
  ctx.lineCap = 'round';        // Rounded line ends
  ctx.lineJoin = 'round';       // Rounded corners
  ctx.strokeStyle = stroke.color;  // #000000, #FF0000, etc.
  ctx.lineWidth = stroke.width;    // 4px or 20px
  
  // Move to first point (without drawing)
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  
  // Draw lines through all subsequent points
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  
  // Actually render the path
  ctx.stroke();
};
```

### Canvas API Methods Explained

| Method | Purpose | Example |
|--------|---------|---------|
| `beginPath()` | Start a new drawing path | Initialize before drawing |
| `moveTo(x, y)` | Move pen without drawing | Go to first point |
| `lineTo(x, y)` | Draw line from current position | Connect points |
| `stroke()` | Render the path | Make it visible |
| `lineCap` | End cap style | `'round'`, `'square'`, `'butt'` |
| `lineJoin` | Corner style | `'round'`, `'bevel'`, `'miter'` |

### Visual Example

```
Points: [{x:10, y:10}, {x:50, y:50}, {x:90, y:10}]

ctx.moveTo(10, 10)    →  •
ctx.lineTo(50, 50)    →  • ─────── •
ctx.lineTo(90, 10)    →  • ─────── • ─────── •
ctx.stroke()          →  Renders the path
```

---

## 5. Optimistic UI Pattern

### What is Optimistic UI?

**Don't wait for the server** - assume the operation will succeed and update UI immediately.

### Without Optimistic UI (Laggy)

```
User draws → Wait for network → Server confirms → Update UI
(200ms delay before seeing your own drawing)
```

### With Optimistic UI (Smooth)

```
User draws → Update UI immediately → Send to network in background
(0ms delay, feels instant)
```

### Our Implementation

**File:** `src/hooks/useWhiteboard.ts` (Lines 146-154)

```typescript
const draw = useCallback((x: number, y: number) => {
  // OPTIMISTIC: Update local state immediately
  setCurrentStroke((prev) => {
    if (!prev) return null;
    return {
      ...prev,
      points: [...prev.points, { x, y }],  // Add point locally
    };
  });

  // NETWORK: Send cursor update in background (throttled)
  const now = Date.now();
  if (now - lastCursorUpdate.current > 50) {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'cursor-move',
      payload: { id: currentUser.id, x, y, name: currentUser.name },
    });
    lastCursorUpdate.current = now;
  }
}, [currentUser.id, currentUser.name]);
```

**What's happening:**
1. **Immediate**: Add point to `currentStroke` state
2. **React re-renders**: Canvas shows new point instantly
3. **Background**: Send cursor position to peers (throttled)

---

## 6. Mouse Event Handling

### Coordinate Transformation

**Problem:** Mouse coordinates are in **screen space**, but canvas needs **canvas space**.

```
Screen Space:  Canvas displayed at 960×540 (50% scale)
Canvas Space:  Canvas resolution is 1920×1080 (100%)

Mouse at (100, 50) screen → (200, 100) canvas
```

**File:** `src/components/Canvas.tsx` (Lines 62-72)

```typescript
const getCoordinates = (e: MouseEvent) => {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };
  
  const rect = canvas.getBoundingClientRect();  // Actual size on screen
  const scaleX = canvas.width / rect.width;     // 1920 / 960 = 2
  const scaleY = canvas.height / rect.height;   // 1080 / 540 = 2
  
  return {
    x: (e.clientX - rect.left) * scaleX,  // Scale up
    y: (e.clientY - rect.top) * scaleY,
  };
};
```

### Drawing State Machine

```
IDLE → mousedown → DRAWING → mousemove → DRAWING → mouseup → IDLE
                      ↓           ↓                      ↓
                 startDrawing   draw()              endDrawing
```

**File:** `src/components/Canvas.tsx` (Lines 74-91)

```typescript
const handleMouseDown = (e: MouseEvent) => {
  const { x, y } = getCoordinates(e);
  startDrawing(x, y);  // Create new stroke
  moveCursor(x, y);    // Update cursor position
};

const handleMouseMove = (e: MouseEvent) => {
  const { x, y } = getCoordinates(e);
  if (e.buttons === 1) {  // Left mouse button held
    draw(x, y);           // Add point to stroke
  }
  moveCursor(x, y);       // Always update cursor
};

const handleMouseUp = () => {
  endDrawing();  // Finalize and broadcast stroke
};
```

---

## 7. State Management Flow

### Data Flow Diagram

```
User Input → Local State → React Re-render → Canvas Redraw
                ↓
          Network Broadcast → Peers
```

### State Structure

**File:** `src/hooks/useWhiteboard.ts` (Lines 20-22)

```typescript
const [strokes, setStrokes] = useState<Stroke[]>([]);        // History
const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);  // In-progress
```

**Why separate `currentStroke`?**
- ✅ **Performance**: Don't mutate history array on every mouse move
- ✅ **Clarity**: Clear distinction between committed vs. in-progress
- ✅ **Network**: Only send completed strokes

---

## 8. Performance Considerations

### Throttling Cursor Updates

**File:** `src/hooks/useWhiteboard.ts` (Lines 157-165)

```typescript
const now = Date.now();
if (now - lastCursorUpdate.current > 50) {  // Max 20 updates/sec
  channelRef.current?.send({
    type: 'broadcast',
    event: 'cursor-move',
    payload: { id: currentUser.id, x, y, name: currentUser.name },
  });
  lastCursorUpdate.current = now;
}
```

**Why throttle?**
- Mouse moves fire ~100 events/sec
- Network can't handle that volume
- 20 updates/sec is smooth enough for cursors

### Rendering Performance

| Stroke Count | Render Time | FPS |
|--------------|-------------|-----|
| 100 strokes | ~2ms | 500 FPS |
| 1,000 strokes | ~16ms | 60 FPS |
| 10,000 strokes | ~160ms | 6 FPS ⚠️ |

**Optimization strategies** (not implemented):
- Viewport culling (only draw visible strokes)
- Offscreen canvas caching
- WebGL rendering for large datasets

---

## 9. The Eraser "Trick"

### Not Actually Erasing

**File:** `src/hooks/useWhiteboard.ts` (Lines 11-16)

```typescript
export const COLORS = {
  BLACK: '#000000',
  RED: '#FF0000',
  BLUE: '#0000FF',
  GREEN: '#008000',
  ERASER: '#FFFFFF',  // White, not transparent!
};

export const WIDTHS = {
  PEN: 4,
  ERASER: 20,  // Thick stroke
};
```

**How it works:**
1. Eraser is just a **thick white pen**
2. Draws white strokes over existing strokes
3. Maintains **append-only** architecture
4. No need for deletion logic

**Visual:**
```
Black stroke:  ━━━━━━━━━━
Eraser stroke:     ████    (white, thick)
Result:        ━━━     ━━━
```

---

## 10. Code Exercise

**Challenge:** Add a "clear canvas" button

```typescript
// 1. Add button in Toolbar component
<button onClick={clearCanvas}>Clear All</button>

// 2. Implement clear function
const clearCanvas = () => {
  setStrokes([]);  // Clear local state
  
  // Broadcast clear event to peers
  channelRef.current?.send({
    type: 'broadcast',
    event: 'clear-canvas',
    payload: { userId: currentUser.id }
  });
};

// 3. Listen for clear events
channel.on('broadcast', { event: 'clear-canvas' }, () => {
  setStrokes([]);
});
```

---

## 11. Key Takeaways

| Concept | What We Learned |
|---------|----------------|
| **Canvas API** | Imperative, raster-based drawing with 2D context |
| **Rendering Loop** | Full redraw on state change (simple & correct) |
| **Optimistic UI** | Update local state immediately, network in background |
| **Coordinate Transform** | Scale mouse coordinates to canvas resolution |
| **State Separation** | `currentStroke` vs. `strokes` for performance |
| **Throttling** | Limit network updates to prevent overload |

---

## Next Steps

In **Lesson 3**, we'll explore backend infrastructure decisions: why we chose Supabase over custom servers, and how to scale real-time applications.
