# Architecture Documentation

## Chat Sentiment App - System Architecture

## Overview

The Chat Sentiment App is a real-time chat application built on Node.js with Express and Socket.IO. It features lexicon-based sentiment analysis, room-based messaging, user tracking, and message persistence.

## System Diagram

```
+--------------------------------------------------+
|                  Client (Browser)                 |
|  +-------------+  +------------+  +-----------+  |
|  |   Chat UI   |  |  Socket.IO |  |  Sentiment|  |
|  |  (HTML/CSS) |  |   Client   |  |  Preview  |  |
|  +-------------+  +------------+  +-----------+  |
+-----------|-------------|-------------|----------+
            |             |             |
            |  WebSocket  |             |
            +-------------+             |
                      |                 |
+--------------------------------------------------+
|                  Express Server                   |
|                                                   |
|  +------------+  +-----------------------------+  |
|  |   HTTP     |  |        Socket.IO Server      |  |
|  |  Routes    |  |                             |  |
|  |  /api/*    |  |  Events:                    |  |
|  +------------+  |  - user:join                |  |
|        |         |  - message:send             |  |
|        |         |  - typing:start/stop        |  |
|        |         |  - disconnect               |  |
|        |         +-----------------------------+  |
|        |                      |                  |
|  +-----v------+  +------------v----------+       |
|  |  Express   |  |   Server Modules       |       |
|  | Middleware |  |  - sentiment.js        |       |
|  | - json     |  |  - rooms.js            |       |
|  | - static   |  |  - users.js            |       |
|  | - logging  |  |  - history.js          |       |
|  +------------+  +------------------------+       |
+--------------------------------------------------+
```

## Module Architecture

### 1. `server.js` - Main Server Entry Point

**Responsibilities:**
- Initialize Express application
- Configure Socket.IO server
- Register REST API routes
- Handle Socket.IO event lifecycle
- Serve static frontend files
- Implement graceful shutdown

**Dependencies:** sentiment.js, rooms.js, users.js, history.js

**Key Components:**
```javascript
// Express middleware stack
app.use(express.json());
app.use(express.static('public'));
app.use(requestLogger);
app.use(errorHandler);

// Socket.IO event handlers
io.on('connection', handleConnection);
```

### 2. `sentiment.js` - Sentiment Analysis Engine

**Pattern:** Pure function engine with embedded lexicon

**Algorithm:**
1. Tokenize input text (lowercase, strip punctuation)
2. For each token, lookup score in `SENTIMENT_LEXICON`
3. Check for intensifier words preceding the token
4. Check for negation words within scope (3-word window)
5. Calculate aggregate score and determine label

**Lexicon Structure:**
| Category | Words | Score Range |
|----------|-------|-------------|
| Very Positive | excellent, amazing, awesome, love, perfect | +4 to +5 |
| Positive | good, nice, glad, fun, pleasant | +2 to +3 |
| Neutral/Negation | not, no, never, none | 0 |
| Negative | bad, sad, poor, ugly, weak | -2 |
| Very Negative | terrible, awful, hate, worst | -4 to -5 |

**Negation Logic:**
- Negation words (not, no, never) within 3 words flip the sentiment
- Double negation cancels out

**Intensifier Multipliers:**
| Intensifier | Multiplier |
|-------------|------------|
| extremely, absolutely | 2.0x |
| totally, completely, utterly | 1.8x |
| incredibly, very, highly | 1.5x |
| really, quite, rather | 1.3-1.4x |
| somewhat | 0.8x |
| slightly | 0.6x |

### 3. `rooms.js` - Room Management

**Pattern:** In-memory Map with CRUD operations

**Data Structure:**
```javascript
Map<roomId, {
  id: string,
  name: string,
  description: string,
  createdBy: string,
  isDefault: boolean,
  members: Set<string>,
  createdAt: ISOString,
  messageCount: number
}>
```

**Operations:**
- `init()` - Create default rooms
- `create(id, name, description)` - Create custom room
- `join(roomId, username)` / `leave(roomId, username)` - Membership
- `getMembers(roomId)` - List members
- `removeUserFromAll(username)` - Cleanup on disconnect

### 4. `users.js` - User Tracking

**Pattern:** Dual Map indexing for fast lookups

**Data Structures:**
```javascript
Map<socketId, User>           // Fast socket -> user lookup
Map<username, Set<socketId>>  // Multi-device support
Map<username, UserProfile>    // Persistent profile data
```

**Features:**
- Multi-device support (same username, multiple sockets)
- Typing status tracking
- Online/away/dnd status
- User profiles with connection history

### 5. `history.js` - Message Persistence

**Pattern:** In-memory Map with optional JSON file persistence

**Data Structure:**
```javascript
Map<roomId, Message[]>
```

**Message Format:**
```javascript
{
  id: string,           // Unique message ID
  roomId: string,       // Room reference
  username: string,     // Sender
  text: string,         // Message content
  timestamp: ISOString, // When sent
  sentiment: {          // Analysis result
    score: number,
    comparative: number,
    label: string,
    confidence: number,
    emoji: string
  },
  type: 'chat' | 'system' | 'join' | 'leave'
}
```

**Features:**
- Per-room message caps (200 messages)
- Pagination support
- Full-text search
- Sentiment statistics aggregation
- Auto-save to JSON every 30 seconds
- Graceful shutdown persistence

## API Specification

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health status |
| GET | `/api/rooms` | List all rooms |
| POST | `/api/rooms` | Create new room |
| GET | `/api/rooms/:roomId` | Room details + users + stats |
| GET | `/api/rooms/:roomId/messages` | Get messages (paginated) |
| GET | `/api/rooms/:roomId/search` | Search messages |
| GET | `/api/rooms/:roomId/sentiment` | Sentiment statistics |
| GET | `/api/users/online` | Online user list |

### Socket.IO Events

**Client -> Server:**

| Event | Payload | Description |
|-------|---------|-------------|
| `user:join` | `{ username, roomId }` | Join a room |
| `message:send` | `{ text, roomId }` | Send a chat message |
| `typing:start` | `{ roomId }` | Started typing |
| `typing:stop` | `{ roomId }` | Stopped typing |

**Server -> Client:**

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | `Message` | New message in room |
| `user:joined` | `{ username, roomId, users }` | User joined |
| `user:left` | `{ username, roomId, users }` | User left |
| `typing:update` | `{ typingUsers }` | Typing status update |
| `room:created` | `Room` | New room created |

## Data Flow

### Message Send Flow
```
User types message
    |
    v
Client emits "message:send"
    |
    v
Server receives event
    |
    v
Server validates input
    |
    v
Server calls sentiment.analyze(text)
    |
    v
Server creates message with sentiment data
    |
    v
Server stores in history
    |
    v
Server broadcasts "message:new" to room
    |
    v
All clients in room receive and display message
```

### User Join Flow
```
User fills login form
    |
    v
Client emits "user:join" with { username, roomId }
    |
    v
Server validates username and room
    |
    v
Server registers user in users module
    |
    v
Server adds user to room's member set
    |
    v
Server fetches recent messages from history
    |
    v
Server acknowledges with { success, user, messages }
    |
    v
Server broadcasts "user:joined" to room
    |
    v
System message added to history and broadcast
```

## Error Handling Strategy

1. **Input Validation:** All user inputs sanitized before processing
2. **Username Sanitization:** Lowercase, alphanumeric + hyphen/underscore only, max 30 chars
3. **Message Limits:** 500 character max, empty messages rejected
4. **Socket Error Handling:** Callback-based error responses
5. **Express Error Middleware:** Centralized error handling
6. **Graceful Shutdown:** SIGTERM/SIGINT handlers persist data before exit

## Scalability Considerations

**Current Limitations:**
- Single Node.js process
- In-memory storage (lost on restart without persistence)
- No horizontal scaling support

**Future Improvements:**
- Redis adapter for Socket.IO multi-server scaling
- MongoDB/PostgreSQL for persistent storage
- Message queue for high-throughput scenarios
- CDN for static assets
