# Lesson 4: Data Structures - Vector vs Raster, Coordinate Systems, and Compression

## Learning Objectives
By the end of this lesson, you'll understand:
- The difference between vector and raster graphics storage
- Why we chose a vector-based approach for strokes
- Coordinate normalization across different screen sizes
- Payload compression techniques for network efficiency

---

## 1. Vector vs Raster Storage

### Raster (Bitmap) Storage

**What it is:** Store the actual pixels

```
Canvas: 1920×1080 = 2,073,600 pixels
Each pixel: 4 bytes (RGBA)
Total: 8.3 MB per frame
```

**Example:**
```
[255,0,0,255, 255,0,0,255, 0,0,0,255, ...]
 ↑ Red pixel  ↑ Red pixel  ↑ Black pixel
```

**Pros:**
- ✅ Exact representation
- ✅ Fast rendering (just copy pixels)

**Cons:**
- ❌ Huge file size (8.3 MB)
- ❌ Doesn't scale (pixelated when zoomed)
- ❌ Can't edit individual strokes

### Vector (Path) Storage ✅ Our Choice

**What it is:** Store mathematical descriptions of shapes

```
Stroke: {
  color: "#FF0000",
  width: 4,
  points: [{x: 10, y: 20}, {x: 30, y: 40}, {x: 50, y: 60}]
}
```

**Example from our code:**

**File:** `src/types.ts` (Lines 6-12)

```typescript
export interface Stroke {
  id: string;        // UUID: "a1b2c3d4-..."
  userId: string;    // Creator ID
  color: string;     // Hex: "#FF0000"
  width: number;     // Pixels: 4 or 20
  points: Point[];   // Coordinates array
}

export interface Point {
  x: number;  // 0-1920
  y: number;  // 0-1080
}
```

**Storage size:**
```
Stroke with 50 points:
- id: 36 bytes
- userId: 36 bytes
- color: 7 bytes
- width: 1 byte
- points: 50 × 16 bytes = 800 bytes
Total: ~880 bytes (vs 8.3 MB raster!)
```

**Pros:**
- ✅ **Tiny size**: 880 bytes vs 8.3 MB (9,400× smaller!)
- ✅ **Scalable**: Zoom without pixelation
- ✅ **Editable**: Can modify individual strokes
- ✅ **Network-friendly**: Fast to transmit

**Cons:**
- ⚠️ Rendering cost (need to redraw paths)
- ⚠️ Complex shapes (many points) can be slow

---

## 2. Our Data Structure Design

### Stroke Object Breakdown

**File:** `src/hooks/useWhiteboard.ts` (Lines 134-141)

```typescript
const startDrawing = useCallback((x: number, y: number) => {
  const newStroke: Stroke = {
    id: uuidv4(),              // "3f4e5d6c-7a8b-9c0d-1e2f-3a4b5c6d7e8f"
    userId: currentUser.id,    // "a1b2c3d4-5e6f-7g8h-9i0j-1k2l3m4n5o6p"
    color: currentUser.color,  // "#FF0000"
    width: currentUser.width,  // 4
    points: [{ x, y }],        // [{x: 123, y: 456}]
  };
  setCurrentStroke(newStroke);
}, [currentUser.id, currentUser.color, currentUser.width]);
```

### Why UUID for Stroke ID?

**Alternatives:**
1. **Auto-increment**: `stroke-1`, `stroke-2`, ...
   - ❌ Requires coordination (who assigns next number?)
   - ❌ Conflicts in distributed system

2. **Timestamp**: `1705567890123`
   - ❌ Collisions possible (two users draw at same millisecond)

3. **UUID v4** ✅ Our Choice
   - ✅ Globally unique (collision probability: 1 in 10³⁸)
   - ✅ No coordination needed
   - ✅ Generated client-side

---

## 3. Coordinate Systems

### Problem: Different Screen Sizes

```
User A: 1920×1080 monitor (100% scale)
User B: 1366×768 laptop (smaller screen)
User C: 3840×2160 4K monitor (200% scale)
```

**Challenge:** How do we ensure drawings align across all screens?

### Solution: Fixed Canvas Resolution

**File:** `src/components/Canvas.tsx` (Lines 95-100)

```typescript
<div className="relative shadow-2xl bg-white shrink-0" 
     style={{ width: 1920, height: 1080 }}>
  <canvas
    ref={canvasRef}
    width={1920}   // Canvas resolution (fixed)
    height={1080}
    className="w-full h-full cursor-crosshair block"
  />
</div>
```

**What's happening:**
1. Canvas **resolution** is always 1920×1080 (internal coordinates)
2. Canvas **display size** adapts to screen (CSS scaling)
3. All users share the same coordinate space (0-1920, 0-1080)

### Coordinate Transformation

**File:** `src/components/Canvas.tsx` (Lines 62-72)

```typescript
const getCoordinates = (e: MouseEvent) => {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };
  
  const rect = canvas.getBoundingClientRect();  // Actual screen size
  const scaleX = canvas.width / rect.width;     // 1920 / 960 = 2
  const scaleY = canvas.height / rect.height;   // 1080 / 540 = 2
  
  return {
    x: (e.clientX - rect.left) * scaleX,  // Screen → Canvas
    y: (e.clientY - rect.top) * scaleY,
  };
};
```

**Example:**
```
Canvas displayed at 960×540 (50% scale)
User clicks at screen position (100, 50)

scaleX = 1920 / 960 = 2
scaleY = 1080 / 540 = 2

Canvas position:
x = (100 - 0) × 2 = 200
y = (50 - 0) × 2 = 100

Stored as: {x: 200, y: 100}
```

**Why this works:**
- ✅ All users store coordinates in same space (1920×1080)
- ✅ Rendering scales automatically (CSS)
- ✅ No need to send screen size in payload

---

## 4. Payload Size Analysis

### Single Stroke Payload

**File:** Network event `draw-line`

```json
{
  "id": "3f4e5d6c-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
  "userId": "a1b2c3d4-5e6f-7g8h-9i0j-1k2l3m4n5o6p",
  "color": "#FF0000",
  "width": 4,
  "points": [
    {"x": 123, "y": 456},
    {"x": 124, "y": 457},
    {"x": 125, "y": 458}
  ]
}
```

**Size breakdown:**
- JSON overhead: ~150 bytes
- 3 points: ~60 bytes
- **Total: ~210 bytes**

### State Sync Payload

**File:** `src/hooks/useWhiteboard.ts` (Lines 74-78)

```typescript
channel.send({
  type: 'broadcast',
  event: 'sync-state',
  payload: { strokes: strokesRef.current },  // All strokes!
});
```

**Size calculation:**
```
100 strokes × 50 points each × 210 bytes = 1.05 MB
1,000 strokes × 50 points each = 10.5 MB ⚠️
```

**Bottleneck identified:**
- New user joining room with 1,000 strokes = 10.5 MB download
- On 4G (5 Mbps): ~17 seconds to load

---

## 5. Compression Techniques (Not Implemented)

### 1. Point Reduction (Douglas-Peucker Algorithm)

**Concept:** Remove points that don't significantly change the path

```
Original:  •─•─•─•─•─•─•─•  (8 points)
Reduced:   •───────────────•  (2 points, visually similar)
```

**Implementation example:**
```typescript
function simplifyStroke(points: Point[], tolerance: number): Point[] {
  // Douglas-Peucker algorithm
  // Removes points within 'tolerance' distance from line
  return douglasPeucker(points, tolerance);
}

// Before sending
const simplified = simplifyStroke(stroke.points, 2);  // 2px tolerance
channel.send({ ...stroke, points: simplified });
```

**Savings:** 50-80% fewer points (depends on drawing style)

### 2. Coordinate Compression

**Concept:** Use smaller data types

```typescript
// Current: 64-bit floats
{x: 123.456789, y: 456.789012}  // 16 bytes

// Optimized: 16-bit integers
{x: 123, y: 456}  // 4 bytes (4× smaller!)
```

**Trade-off:** Lose sub-pixel precision (acceptable for whiteboard)

### 3. Binary Encoding (Protocol Buffers)

**Current: JSON**
```json
{"x": 123, "y": 456}  // 20 bytes
```

**Optimized: Binary**
```
[0x7B, 0x00, 0xC8, 0x01]  // 4 bytes (5× smaller!)
```

**Implementation:** Use Protocol Buffers or MessagePack

**Trade-off:** More complex encoding/decoding

### 4. Gzip Compression

**Built into HTTP/WebSocket:**
```typescript
// Supabase handles this automatically
// No code changes needed
```

**Savings:** ~70% for JSON payloads

---

## 6. Memory Management

### Current State Storage

**File:** `src/hooks/useWhiteboard.ts` (Lines 20-21)

```typescript
const [strokes, setStrokes] = useState<Stroke[]>([]);
const strokesRef = useRef<Stroke[]>([]);
```

**Memory usage:**
```
1,000 strokes × 50 points × 16 bytes = 800 KB (in RAM)
10,000 strokes = 8 MB
100,000 strokes = 80 MB ⚠️
```

### Optimization Strategies (Not Implemented)

#### 1. Viewport Culling

Only render strokes visible in viewport:

```typescript
const visibleStrokes = strokes.filter(stroke => {
  return isInViewport(stroke, viewportBounds);
});

visibleStrokes.forEach(stroke => drawStroke(ctx, stroke));
```

#### 2. Stroke Merging

Merge old strokes into a background image:

```typescript
// Every 100 strokes, render to offscreen canvas
if (strokes.length % 100 === 0) {
  const bgCanvas = document.createElement('canvas');
  const bgCtx = bgCanvas.getContext('2d');
  
  // Render all strokes to background
  strokes.forEach(stroke => drawStroke(bgCtx, stroke));
  
  // Clear strokes array, keep only background
  setBackgroundImage(bgCanvas.toDataURL());
  setStrokes([]);
}
```

#### 3. Pagination

Limit state sync to recent strokes:

```typescript
// Only send last 500 strokes
const recentStrokes = strokes.slice(-500);
channel.send({ strokes: recentStrokes });
```

---

## 7. Data Structure Alternatives

### Alternative 1: Quadtree (Spatial Indexing)

**Use case:** Fast lookup of strokes in a region

```typescript
class Quadtree {
  insert(stroke: Stroke): void;
  query(bounds: Rectangle): Stroke[];
}

// Find strokes in viewport
const visible = quadtree.query(viewportBounds);
```

**Trade-off:** More complex, useful for large canvases

### Alternative 2: Stroke Layers

**Use case:** Organize strokes by user or time

```typescript
interface Layer {
  id: string;
  name: string;
  strokes: Stroke[];
  visible: boolean;
}

const layers: Layer[] = [
  { id: '1', name: 'User A', strokes: [...], visible: true },
  { id: '2', name: 'User B', strokes: [...], visible: false },
];
```

**Trade-off:** More UI complexity

---

## 8. Real-World Example: Figma's Approach

Figma (collaborative design tool) uses:

1. **Vector storage** (like us)
2. **Operational Transforms** (for conflict resolution)
3. **Binary protocol** (custom format, not JSON)
4. **WebAssembly** (for fast rendering)
5. **Viewport culling** (only render visible objects)

**Result:** Handles 100,000+ objects smoothly

---

## 9. Code Exercise

**Challenge:** Add stroke count and memory usage display

```typescript
// Calculate memory usage
const calculateMemoryUsage = (strokes: Stroke[]): number => {
  const json = JSON.stringify(strokes);
  return new Blob([json]).size;  // Bytes
};

// In component
const memoryUsage = calculateMemoryUsage(strokes);
const memoryMB = (memoryUsage / 1024 / 1024).toFixed(2);

// Display
<div>
  Strokes: {strokes.length} | Memory: {memoryMB} MB
</div>
```

---

## 10. Key Takeaways

| Concept | What We Learned |
|---------|----------------|
| **Vector vs Raster** | Vector is 9,400× smaller, scalable, editable |
| **UUID** | Globally unique IDs without coordination |
| **Fixed Canvas** | 1920×1080 coordinate space shared by all users |
| **Coordinate Transform** | Scale screen coordinates to canvas space |
| **Payload Size** | 210 bytes per stroke, 10 MB for 1,000 strokes |
| **Compression** | Point reduction, binary encoding, gzip |

---

## Next Steps

In **Lesson 5**, we'll explore distributed consistency: conflict resolution strategies, Last-Write-Wins, and an introduction to CRDTs.
