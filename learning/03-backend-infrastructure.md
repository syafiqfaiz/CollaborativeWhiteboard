# Lesson 3: Backend Infrastructure - Custom Servers vs PaaS, Scaling, and Sessions

## Learning Objectives
By the end of this lesson, you'll understand:
- The trade-offs between custom WebSocket servers and Platform-as-a-Service (PaaS)
- Why we chose Supabase Realtime over building our own server
- How sticky sessions work in WebSocket architectures
- Scaling strategies for real-time applications

---

## 1. Architecture Decision: Custom Server vs PaaS

### Option 1: Custom WebSocket Server (Node.js/Go)

**Example Stack:**
```
Frontend → Load Balancer → WebSocket Server (Node.js + Socket.io)
                                    ↓
                              Redis Pub/Sub
                                    ↓
                           PostgreSQL (optional)
```

**Pros:**
- ✅ Full control over logic
- ✅ Custom optimizations
- ✅ No vendor lock-in

**Cons:**
- ❌ Infrastructure management (servers, load balancers, Redis)
- ❌ Scaling complexity (sticky sessions, horizontal scaling)
- ❌ Monitoring & debugging
- ❌ Cost (server hosting, DevOps time)

### Option 2: PaaS (Supabase Realtime) ✅ Our Choice

**Example Stack:**
```
Frontend → Supabase Realtime (Managed WebSocket Service)
```

**Pros:**
- ✅ Zero infrastructure management
- ✅ Built-in scaling
- ✅ Free tier (generous limits)
- ✅ Presence tracking included
- ✅ Fast time-to-market

**Cons:**
- ⚠️ Vendor lock-in
- ⚠️ Less control over internals
- ⚠️ Pricing at scale (can get expensive)

---

## 2. Our Implementation: Supabase Client

### Initialization

**File:** `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder',
);
```

**What's happening:**
1. Import Supabase JavaScript client
2. Read credentials from environment variables
3. Create singleton client instance

### Environment Configuration

**File:** `.env.example`

```bash
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_KEY=your_supabase_anon_key_here
```

**Security Note:**
- `VITE_SUPABASE_KEY` is the **anon public key** (safe to expose)
- Real security comes from Row Level Security (RLS) policies
- For our use case, we don't use RLS (no database)

---

## 3. What Supabase Realtime Does Behind the Scenes

### Under the Hood

Supabase Realtime is built on **Phoenix Framework** (Elixir):

```
Your Browser → WebSocket → Phoenix Channels → Broadcast to all subscribers
                                    ↓
                            (No database writes)
```

**Key Components:**
1. **Phoenix Channels**: Elixir's pub/sub system
2. **Presence**: Distributed user tracking (CRDT-based)
3. **Broadcast**: Fire-and-forget messaging

### Why Elixir/Phoenix?

- **Concurrency**: Handles millions of connections on one server
- **Fault Tolerance**: Processes crash independently
- **Low Latency**: ~10-50ms message delivery
- **Battle-tested**: Used by Discord, Pinterest, etc.

---

## 4. If We Built a Custom Server (Hypothetical)

### Node.js + Socket.io Example

```javascript
// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const Redis = require('ioredis');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Redis for pub/sub across multiple servers
const pub = new Redis();
const sub = new Redis();

io.on('connection', (socket) => {
  const roomId = socket.handshake.query.room || 'room-1';
  
  // Join room
  socket.join(roomId);
  
  // Listen for draw events
  socket.on('draw-line', (stroke) => {
    // Broadcast to room (including other servers via Redis)
    pub.publish(`room:${roomId}:draw`, JSON.stringify(stroke));
  });
  
  // Listen for cursor moves
  socket.on('cursor-move', (cursor) => {
    socket.to(roomId).emit('cursor-move', cursor);
  });
});

// Subscribe to Redis for cross-server messages
sub.subscribe('room:*:draw');
sub.on('message', (channel, message) => {
  const roomId = channel.split(':')[1];
  io.to(roomId).emit('draw-line', JSON.parse(message));
});

server.listen(3000);
```

**Complexity Added:**
- Redis for cross-server communication
- Room management logic
- Connection handling
- Error handling & reconnection logic
- Monitoring & logging

**Estimated Development Time:** 2-4 weeks  
**Supabase Setup Time:** 10 minutes

---

## 5. Sticky Sessions Problem

### What are Sticky Sessions?

When you have **multiple WebSocket servers**, you need to ensure a user's connection stays on the **same server**.

```
User A → Load Balancer → Server 1 (WebSocket connection)
User B → Load Balancer → Server 2 (WebSocket connection)
```

**Problem:**
- User A sends message
- Server 1 receives it
- Server 1 needs to send to User B
- But User B is on Server 2!

### Solutions

#### 1. Sticky Sessions (Session Affinity)

```
Load Balancer remembers: User A → Server 1
                         User B → Server 2
```

**Pros:**
- ✅ Simple to implement

**Cons:**
- ❌ Uneven load distribution
- ❌ Server restart disconnects users

#### 2. Redis Pub/Sub (Our Hypothetical Example)

```
Server 1 → Redis Pub/Sub → Server 2
```

**Pros:**
- ✅ Servers can communicate
- ✅ No sticky sessions needed

**Cons:**
- ❌ Additional infrastructure (Redis)
- ❌ Latency overhead (~5-10ms)

#### 3. Managed Service (Supabase) ✅

Supabase handles this internally with **Elixir's distributed nodes**.

---

## 6. Scaling Strategies

### Vertical Scaling (Scale Up)

```
1 Server: 4 CPU, 8GB RAM → 16 CPU, 64GB RAM
```

**Limits:**
- Single server: ~50,000 concurrent connections
- Expensive at high specs

### Horizontal Scaling (Scale Out)

```
1 Server → 5 Servers → 50 Servers
```

**Challenges:**
- Need load balancer
- Need message broker (Redis/RabbitMQ)
- Sticky sessions or pub/sub

### Supabase Auto-Scaling

Supabase handles scaling automatically:
- **Free Tier**: Up to 200 concurrent connections
- **Pro Tier**: Up to 500 concurrent connections
- **Enterprise**: Custom limits

**For our use case:**
- 5 users per room × 40 rooms = 200 connections (Free tier ✅)

---

## 7. Cost Comparison

### Custom Server (AWS Example)

| Component | Cost/Month |
|-----------|------------|
| EC2 t3.medium (2 servers) | $60 |
| Application Load Balancer | $20 |
| ElastiCache Redis | $15 |
| CloudWatch Monitoring | $10 |
| **Total** | **$105/month** |

**Plus:**
- DevOps time (~10 hours/month)
- Maintenance & updates

### Supabase

| Tier | Cost/Month | Connections |
|------|------------|-------------|
| Free | $0 | 200 |
| Pro | $25 | 500 |
| **Total** | **$0-25/month** | Enough for MVP |

**Plus:**
- Zero DevOps time
- Automatic updates

---

## 8. When to Build Custom vs Use PaaS

### Use PaaS (Supabase, Pusher, Ably) When:

- ✅ MVP or small-scale app
- ✅ Standard use cases (chat, notifications, collaboration)
- ✅ Limited DevOps resources
- ✅ Fast time-to-market critical

### Build Custom Server When:

- ✅ Very high scale (millions of connections)
- ✅ Custom business logic in real-time layer
- ✅ Cost optimization at scale (PaaS gets expensive)
- ✅ Regulatory requirements (data sovereignty)

### Our Decision Matrix

| Factor | Weight | Custom | Supabase |
|--------|--------|--------|----------|
| Time to market | High | ❌ 4 weeks | ✅ 1 day |
| Cost (MVP) | High | ❌ $105/mo | ✅ $0/mo |
| Scalability | Low | ✅ Unlimited | ⚠️ 500 users |
| Control | Low | ✅ Full | ❌ Limited |
| **Winner** | | | **Supabase** ✅ |

---

## 9. Monitoring & Debugging

### Supabase Dashboard

Supabase provides built-in monitoring:
- Real-time connection count
- Message throughput
- Error logs
- Presence state

### Custom Server Monitoring

Would need to implement:
- Prometheus metrics
- Grafana dashboards
- Error tracking (Sentry)
- Log aggregation (ELK stack)

**Estimated setup time:** 1-2 weeks

---

## 10. Migration Path (If We Outgrow Supabase)

### Step 1: Add Abstraction Layer

```typescript
// realtime.service.ts
interface RealtimeService {
  subscribe(roomId: string): Channel;
  broadcast(event: string, payload: any): void;
  track(presence: any): void;
}

class SupabaseRealtimeService implements RealtimeService {
  // Current implementation
}

class CustomRealtimeService implements RealtimeService {
  // Future custom implementation
}
```

### Step 2: Gradual Migration

1. Deploy custom server alongside Supabase
2. Route 10% of traffic to custom server
3. Monitor performance & errors
4. Gradually increase to 100%
5. Deprecate Supabase

**Estimated migration time:** 2-3 months

---

## 11. Code Exercise

**Challenge:** Add connection status indicator

```typescript
// useWhiteboard.ts
const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    setConnectionStatus('connected');
  } else if (status === 'CLOSED') {
    setConnectionStatus('disconnected');
  }
});

// In UI component
{connectionStatus === 'connected' && <span>🟢 Online</span>}
{connectionStatus === 'disconnected' && <span>🔴 Offline</span>}
```

---

## 12. Key Takeaways

| Concept | What We Learned |
|---------|----------------|
| **PaaS vs Custom** | PaaS wins for MVPs, custom for scale/control |
| **Supabase Realtime** | Managed WebSocket service built on Phoenix/Elixir |
| **Sticky Sessions** | Challenge in multi-server WebSocket deployments |
| **Scaling** | Vertical (bigger servers) vs Horizontal (more servers) |
| **Cost** | Supabase $0-25/mo vs Custom $105+/mo |
| **Migration** | Abstract early to enable future migration |

---

## Next Steps

In **Lesson 4**, we'll explore data structures: vector vs raster storage, coordinate normalization, and payload compression techniques.
