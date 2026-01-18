# Lesson 5: Distributed Consistency - Conflict Resolution, LWW, and CRDTs

## Learning Objectives
By the end of this lesson, you'll understand:
- What distributed consistency means in collaborative apps
- Common conflict scenarios in real-time collaboration
- Last-Write-Wins (LWW) strategy and its trade-offs
- Introduction to CRDTs (Conflict-free Replicated Data Types)
- Why we chose LWW over CRDTs for this application

---

## 1. The Distributed Consistency Problem

### What is Distributed Consistency?

When multiple users edit the same data simultaneously, how do we ensure everyone sees the same final state?

```
User A: Draws red line at position X
User B: Draws blue line at position X (same time)

Question: Which line appears on top?
```

### The CAP Theorem (Simplified)

In distributed systems, you can only have 2 of 3:

1. **Consistency**: Everyone sees the same data
2. **Availability**: System always responds
3. **Partition Tolerance**: Works despite network issues

**Our choice:** Availability + Partition Tolerance = **Eventual Consistency**

---

## 2. Conflict Scenarios in Our Whiteboard

### Scenario 1: Overlapping Strokes

```
Time: T0
User A starts drawing red line
User B starts drawing blue line

Time: T1
User A finishes (broadcasts red stroke)
User B finishes (broadcasts blue stroke)

Time: T2
Both users receive both strokes
Question: Which stroke is on top?
```

### Scenario 2: Simultaneous Edits (If We Had Delete)

```
User A: Deletes stroke-123
User B: Modifies stroke-123

Question: Does stroke-123 exist or not?
```

### Scenario 3: Network Partition

```
User A and B in Room 1 (connected)
User C in Room 1 (disconnected)

User A draws → User B sees it
User C draws → Nobody sees it (yet)

User C reconnects
Question: How do we merge C's strokes?
```

---

## 3. Our Strategy: Last-Write-Wins (LWW)

### What is LWW?

**Simple rule:** The last message received wins.

**File:** `src/hooks/useWhiteboard.ts` (Lines 53-55)

```typescript
channel
  .on('broadcast', { event: 'draw-line' }, ({ payload }: { payload: Stroke }) => {
    // Simply append to array (order = arrival time)
    setStrokes((prev) => [...prev, payload]);
  })
```

**What's happening:**
1. Stroke arrives from network
2. Append to end of array
3. Render in order (last stroke on top)

### Visual Example

```
Timeline:
T0: User A draws red stroke → broadcasts
T1: User B draws blue stroke → broadcasts
T2: User A receives blue stroke → appends to array
T3: User B receives red stroke → appends to array

User A's array: [red, blue]  (blue on top)
User B's array: [blue, red]  (red on top)

⚠️ INCONSISTENT STATE!
```

### Why This Happens

**Network latency varies:**
```
User A → Supabase: 50ms
User B → Supabase: 200ms

User A's stroke arrives first at Supabase
But User B might receive messages in different order
```

---

## 4. How We Achieve Consistency (Append-Only)

### The Append-Only Architecture

**File:** Project Requirement Document (Lines 97-102)

```markdown
### Decision 4: Conflict Resolution

* **Decision:** Last Write Wins (Append-Only).
* **Context:** Two users draw over the same spot.
* **Justification:** In a drawing app, visual overlap is acceptable. 
  The order of arrival determines the z-index.
```

**Key insight:** We don't delete or modify strokes, only append.

### Why Append-Only Works

```
User A draws stroke-1 → [stroke-1]
User B draws stroke-2 → [stroke-1, stroke-2]
User A draws stroke-3 → [stroke-1, stroke-2, stroke-3]

No conflicts because:
- No deletions (can't delete something that doesn't exist)
- No modifications (can't modify something someone else modified)
- Only additions (always safe to add)
```

### The Eraser "Trick"

**File:** `src/hooks/useWhiteboard.ts` (Lines 11-16)

```typescript
export const COLORS = {
  BLACK: '#000000',
  RED: '#FF0000',
  BLUE: '#0000FF',
  GREEN: '#008000',
  ERASER: '#FFFFFF',  // White stroke, not deletion!
};
```

**Why this matters:**
- Eraser is just another stroke (white color)
- No delete operation needed
- Maintains append-only architecture
- No conflict resolution needed

---

## 5. Introduction to CRDTs

### What are CRDTs?

**Conflict-free Replicated Data Types** - Data structures that automatically resolve conflicts.

### Example: G-Counter (Grow-only Counter)

```typescript
class GCounter {
  counts: Map<string, number>;  // userId → count
  
  increment(userId: string) {
    this.counts.set(userId, (this.counts.get(userId) || 0) + 1);
  }
  
  value(): number {
    return Array.from(this.counts.values()).reduce((a, b) => a + b, 0);
  }
  
  merge(other: GCounter) {
    // Take maximum count for each user
    other.counts.forEach((count, userId) => {
      const current = this.counts.get(userId) || 0;
      this.counts.set(userId, Math.max(current, count));
    });
  }
}
```

**Properties:**
- ✅ **Commutative**: Order doesn't matter
- ✅ **Associative**: Grouping doesn't matter
- ✅ **Idempotent**: Applying twice = applying once

### CRDT for Collaborative Text (Yjs)

**Example:** Google Docs-style collaboration

```typescript
import * as Y from 'yjs';

const doc = new Y.Doc();
const text = doc.getText('content');

// User A types "Hello"
text.insert(0, 'Hello');

// User B types "World" at position 0
text.insert(0, 'World');

// Both users converge to: "WorldHello"
// (Deterministic, no conflicts)
```

---

## 6. Why We Didn't Use CRDTs

### Decision Analysis

**File:** Project Requirement Document (Lines 99-102)

```markdown
* **Alternative (Rejected):** CRDTs (e.g., Yjs).
  * Rejected due to high learning curve and bundle size.
* **Justification:** In a drawing app, visual overlap is acceptable.
```

### Trade-off Analysis

| Factor | LWW (Our Choice) | CRDT (Yjs) |
|--------|------------------|------------|
| **Complexity** | ✅ Simple (10 lines) | ❌ Complex (library needed) |
| **Bundle Size** | ✅ 0 KB | ❌ ~50 KB (Yjs) |
| **Learning Curve** | ✅ Easy | ❌ Steep |
| **Consistency** | ⚠️ Eventual | ✅ Strong |
| **Use Case Fit** | ✅ Drawing (overlap OK) | ⚠️ Overkill for whiteboard |

### When to Use CRDTs

Use CRDTs when:
- ✅ Strong consistency required (collaborative text editing)
- ✅ Complex conflict scenarios (simultaneous edits to same object)
- ✅ Offline-first apps (sync after reconnection)

**Examples:**
- Google Docs (text editing)
- Figma (object properties)
- Notion (block-based content)

---

## 7. Handling Network Partitions

### The "Host Handshake" Pattern

**File:** `src/hooks/useWhiteboard.ts` (Lines 56-80)

```typescript
.on('broadcast', { event: 'req-state' }, ({ payload }: { payload: ReqStatePayload }) => {
  if (payload.requesterId === currentUser.id) return;

  const state = channel.presenceState();
  const allPresences = [];
  for (const key in state) {
    allPresences.push(...state[key]);
  }
  
  // Sort by join time (oldest first)
  allPresences.sort((a, b) => {
    const timeA = new Date(a.online_at).getTime();
    const timeB = new Date(b.online_at).getTime();
    return timeA - timeB;
  });

  // If I'm the oldest, send state
  if (allPresences.length > 0 && allPresences[0].user_id === currentUser.id) {
    channel.send({
      type: 'broadcast',
      event: 'sync-state',
      payload: { strokes: strokesRef.current },
    });
  }
})
```

**What's happening:**
1. New user joins → requests state
2. All users check if they're the oldest
3. Oldest user sends complete state
4. New user replaces their state

### Race Condition (Accepted Limitation)

**Scenario:**
```
T0: User A (oldest) in room
T1: User B joins → requests state
T2: User A leaves (before sending state)
T3: User B receives no response → empty board
```

**Mitigation strategies (not implemented):**
- Retry logic (request state again after timeout)
- Multiple hosts (top 3 oldest users respond)
- Persistent storage (fallback to database)

**Our decision:** Accept for MVP (educational purpose)

---

## 8. Operational Transforms (Alternative to CRDT)

### What is OT?

**Operational Transform** - Transform operations based on concurrent operations.

**Example:** Collaborative text editing

```
Initial: "Hello"

User A: Insert "World" at position 5 → "HelloWorld"
User B: Delete "H" at position 0 → "ello"

Without OT:
User A applies B's delete → "elloWorld" (wrong!)

With OT:
User A transforms B's delete (position 0 → 0) → "elloWorld"
User B transforms A's insert (position 5 → 4) → "elloWorld"
Both converge to: "elloWorld" ✅
```

### OT vs CRDT

| Factor | OT | CRDT |
|--------|----|----- |
| **Complexity** | ❌ Very high | ⚠️ High |
| **Consistency** | ✅ Strong | ✅ Strong |
| **Offline Support** | ❌ Difficult | ✅ Easy |
| **Examples** | Google Docs (old), Etherpad | Figma, Notion |

**Trend:** Industry moving from OT to CRDTs

---

## 9. Consistency Levels Spectrum

```
Weak Consistency ←――――――――――――――――→ Strong Consistency
                                    
LWW (Us)     Eventual     CRDT      OT      Distributed Locks
   ↓            ↓          ↓         ↓              ↓
Fast, Simple  Good enough  Complex   Very Complex  Slow, Reliable
```

**Our position:** LWW (weak consistency) is sufficient for whiteboard use case.

---

## 10. Code Exercise

**Challenge:** Add timestamp-based ordering for consistent z-index

```typescript
// Modify Stroke interface
interface Stroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: Point[];
  timestamp: number;  // Add this
}

// When creating stroke
const newStroke: Stroke = {
  id: uuidv4(),
  userId: currentUser.id,
  color: currentUser.color,
  width: currentUser.width,
  points: [{ x, y }],
  timestamp: Date.now(),  // Add timestamp
};

// When receiving strokes, sort by timestamp
.on('broadcast', { event: 'draw-line' }, ({ payload }) => {
  setStrokes((prev) => {
    const updated = [...prev, payload];
    // Sort by timestamp (oldest first)
    updated.sort((a, b) => a.timestamp - b.timestamp);
    return updated;
  });
})
```

**Result:** All users see same z-index order (consistent!)

---

## 11. Real-World Examples

### Google Docs
- **Strategy:** CRDT (Yjs) + OT hybrid
- **Consistency:** Strong (everyone sees same text)
- **Trade-off:** Complex implementation

### Figma
- **Strategy:** CRDT for properties, LWW for positions
- **Consistency:** Eventual (good enough for design)
- **Trade-off:** Balanced complexity

### Our Whiteboard
- **Strategy:** LWW (append-only)
- **Consistency:** Weak (z-index may differ)
- **Trade-off:** Simple, fast, educational

---

## 12. Key Takeaways

| Concept | What We Learned |
|---------|----------------|
| **Distributed Consistency** | Challenge of keeping multiple clients in sync |
| **LWW** | Simple strategy: last message received wins |
| **Append-Only** | No deletions = no conflicts |
| **CRDTs** | Automatic conflict resolution, but complex |
| **OT** | Transform operations, very complex |
| **Trade-offs** | Simplicity vs. consistency (we chose simplicity) |

---

## Conclusion

You've completed the architecture deep-dive! You now understand:

1. **Transport Layer**: WebSockets, Pub/Sub, Stateless Relay
2. **Client Layer**: Canvas rendering, Optimistic UI, Main Loop
3. **Backend Infrastructure**: PaaS vs Custom, Scaling, Sessions
4. **Data Structures**: Vector vs Raster, Coordinates, Compression
5. **Distributed Consistency**: LWW, CRDTs, Conflict Resolution

**Next steps:**
- Build your own collaborative app
- Experiment with CRDTs (try Yjs)
- Read about Figma's architecture
- Explore WebRTC for peer-to-peer collaboration

---

## Further Reading

- [Yjs Documentation](https://docs.yjs.dev/)
- [Figma's Multiplayer Technology](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [CRDTs Explained](https://crdt.tech/)
- [Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation)
- [CAP Theorem](https://en.wikipedia.org/wiki/CAP_theorem)
