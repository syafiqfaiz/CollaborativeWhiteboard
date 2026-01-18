# Product & Architecture Specification: UniBoard Lite

**Version:** 2.1 (Eraser Added)
**Status:** Final Draft
**Type:** Educational MVP
**Core Concept:** Serverless, Client-Authoritative P2P Whiteboard

---

## 1. Executive Summary

UniBoard Lite is a minimal collaborative whiteboard designed to teach realtime architecture concepts without backend complexity. It allows multiple anonymous users to draw on a shared canvas using an ephemeral, stateless architecture.

The system relies on Supabase Realtime as a message broker and utilizes a Peer-to-Peer *Handshake* for state synchronization, eliminating the need for a database.

---

## 2. Product Requirements

### 2.1 Core Features

* **Access:** Anonymous, URL-based access. Users provide a *Display Name* via modal.
* **Canvas:** Fixed 1920x1080 resolution, centered viewport.
* **Collaboration:**

  * **Live Drawing:** Strokes appear on other screens after the user finishes drawing (Mouse Up).
  * **Cursors:** Real-time ghost cursors with name tags.
  * **Presence:** Active user list.

### 2.2 Drawing Tools

* **Pen:**

  * Standard drawing.
  * **Colors:** Black, Red, Blue, Green.
  * **Width:** Fixed thin stroke (e.g., 4px).

* **Eraser:**

  * *White-out* style.
  * **Behavior:** Draws a thick path matching the background color.
  * **Width:** Fixed thick stroke (e.g., 20px).

### 2.3 User Flows

#### 2.3.1 Room Lifecycle

* **First User (Host):**

  * Opens URL → Joins Channel → Sees no peers → Initializes empty board.

* **Guest User:**

  * Opens URL → Joins Channel → Sees peers → Requests State → Receives State → Syncs.

#### 2.3.2 The *Stroke on Completion* Loop

* **Local:** User draws. Line renders locally in real-time (Optimistic UI).
* **Commit:** User releases mouse button.
* **Network:** The full `Stroke` object is broadcast.
* **Remote:** Peers receive the object and append it to their canvas.

---

## 3. Architecture Definition & Decisions (ARD)

### Decision 1: Transport Layer (Stateless Relay)

* **Decision:** Use Supabase Realtime (Broadcast) as a *dumb pipe*.
* **Context:** Need sub-200ms latency without maintaining a WebSocket server.
* **Alternative (Rejected):** Firebase Realtime DB.

  * Rejected because it implies persistence and costs scale with write volume.
* **Justification:** Fits the *ephemeral* goal. Messages are fire-and-forget; no storage costs.

### Decision 2: State Sync (P2P Handshake)

* **Decision:** Host–Guest Transfer. The *oldest* user in the room acts as the database.
* **Context:** New users join an empty room but need history. We have no DB.
* **Alternative (Rejected):** Postgres Persistence.

  * Rejected to keep the backend stateless.
* **Justification:** Teaches the concept of *Client Authority*.

### Decision 3: Update Granularity (Atomic vs. Streaming)

* **Decision:** Atomic Updates (Send on MouseUp).
* **Context:** How frequently do we send drawing data?
* **Alternative (Rejected):** Streaming (Sending points as they are drawn).

  * **Pros:** Real-time *ink flowing* effect on other screens.
  * **Cons:** Multiplies network traffic by ~100×. High complexity handling out-of-order packets.
* **Justification:** Simplicity. Sending the finished line reduces event volume drastically and ensures data integrity.

### Decision 4: Conflict Resolution

* **Decision:** Last Write Wins (Append-Only).
* **Context:** Two users draw over the same spot.
* **Alternative (Rejected):** CRDTs (e.g., Yjs).

  * Rejected due to high learning curve and bundle size.
* **Justification:** In a drawing app, visual overlap is acceptable. The order of arrival determines the z-index.

### Decision 5: Eraser Implementation

* **Decision:** Additive *White-out* Strokes.
* **Context:** Users need to correct mistakes.
* **Alternative (Rejected):** Object Deletion (Remove ID from array).

  * **Pros:** Reduces state size.
  * **Cons:** Requires a new event type (`DELETE_STROKE`). Hard to implement hit detection on thin lines.
* **Justification:** Simplicity. The eraser is technically just a thick white pen. This keeps the architecture purely *Append-Only* and avoids delete-propagation logic.

---

## 4. Data Models

### 4.1 The `Stroke` Object

```ts
interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;      // UUID v4
  userId: string;  // Session ID
  color: string;   // Hex (#FFFFFF for Eraser)
  width: number;   // Thickness (e.g., 5 for Pen, 20 for Eraser)
  points: Point[]; // Coordinates
}
```

### 4.2 Network Events

| Event         | Payload                 | Trigger                       |
| ------------- | ----------------------- | ----------------------------- |
| `cursor-move` | `{ id, x, y, name }`    | `mousemove` (throttled ~50ms) |
| `draw-line`   | `Stroke` object         | `mouseup` (stroke complete)   |
| `req-state`   | `{ requesterId }`       | `onJoin` (if peers exist)     |
| `sync-state`  | `{ strokes: Stroke[] }` | `onEvent: req-state`          |

---

## 5. Assumptions & Constraints

### 5.1 The *Single Host* Constraint

* **Assumption:** The longest-active user is the Host.
* **Risk:** If the Host leaves exactly when a new user joins, the handshake fails (race condition).
* **Acceptance:** Accepted for MVP.

### 5.2 Data Integrity

* **Assumption:** Clients are trusted.
* **Constraint:** No server-side validation. A malicious user can inject valid JSON and draw over the entire board.

### 5.3 Scalability

* **Constraint:** Designed for small rooms (2–5 users).
* **Bottleneck:** The `sync-state` payload grows linearly. Joining a room with 10k strokes will be slow (5MB+ JSON over WebSocket).

### 5.4 Network Reliability

* **Constraint:** No retry logic. If a packet is dropped, the stroke is missing for that user.
* **Mitigation:** TCP (WebSocket) handles basic packet loss, but connection drops are not handled.
