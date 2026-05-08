/**
 * Chat Sentiment App - Express + Socket.IO Server
 * Real-time chat application with sentiment analysis
 */

'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Module imports
const sentiment = require('./sentiment');
const rooms = require('./rooms');
const users = require('./users');
const history = require('./history');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Configuration
const PORT = process.env.PORT || 3000;
const MAX_MESSAGE_LENGTH = 500;
const TYPING_DEBOUNCE_MS = 3000;

// In-memory typing timeout store: Map<socketId, timeoutId>
const typingTimeouts = new Map();

// ============================================================================
// Express Middleware
// ============================================================================

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================================
// REST API Routes
// ============================================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    connections: users.getOnlineCount()
  });
});

// Get all rooms
app.get('/api/rooms', (req, res) => {
  try {
    const allRooms = rooms.getAll();
    res.json({ rooms: allRooms, count: allRooms.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get room details
app.get('/api/rooms/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomUsers = users.getUsersInRoom(roomId);
    const stats = history.getStats(roomId);

    res.json({
      ...room,
      users: roomUsers,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get room messages
app.get('/api/rooms/:roomId/messages', (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before || null;

    if (!rooms.exists(roomId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const result = history.getMessages(roomId, { limit, before });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search messages in a room
app.get('/api/rooms/:roomId/search', (req, res) => {
  try {
    const { roomId } = req.params;
    const { q } = req.query;

    if (!rooms.exists(roomId)) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const results = history.search(roomId, q.trim());
    res.json({ messages: results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get room sentiment stats
app.get('/api/rooms/:roomId/sentiment', (req, res) => {
  try {
    const { roomId } = req.params;
    if (!rooms.exists(roomId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const stats = history.getStats(roomId);
    res.json(stats || { roomId, totalMessages: 0, sentimentCounts: {} });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new room
app.post('/api/rooms', (req, res) => {
  try {
    const { id, name, description } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: 'id and name are required' });
    }

    const room = rooms.create(id, name, description || '');
    res.status(201).json(room);

    // Notify all connected clients about the new room
    io.emit('room:created', room);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get online users
app.get('/api/users/online', (req, res) => {
  res.json({
    users: users.getAllOnline(),
    count: users.getOnlineCount()
  });
});

// ============================================================================
// Socket.IO Event Handlers
// ============================================================================

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // --------------------------------------------------------------------------
  // Join Room
  // --------------------------------------------------------------------------
  socket.on('user:join', async ({ username, roomId }, callback) => {
    try {
      // Validate inputs
      if (!username || !roomId) {
        return callback({ error: 'Username and room are required' });
      }

      const sanitizedUsername = users.sanitizeUsername(username);
      if (!sanitizedUsername) {
        return callback({ error: 'Invalid username format' });
      }

      // Check if room exists, create if not (for dynamic rooms)
      if (!rooms.exists(roomId)) {
        rooms.create(roomId, roomId.charAt(0).toUpperCase() + roomId.slice(1));
      }

      // Check username availability (allow same user from different tabs)
      // We allow rejoining with same username

      // Join socket room
      socket.join(roomId);

      // Register user
      const user = users.register(socket.id, sanitizedUsername, roomId);
      rooms.join(roomId, sanitizedUsername);

      // Get recent messages
      const recentMessages = history.getRecent(roomId, 30);

      // Notify callback with success
      callback({
        success: true,
        user: { username: user.username, roomId: user.roomId },
        messages: recentMessages
      });

      // Broadcast user joined to room
      socket.to(roomId).emit('user:joined', {
        username: sanitizedUsername,
        roomId,
        timestamp: new Date().toISOString(),
        onlineCount: users.getOnlineCount(),
        users: users.getUsersInRoom(roomId)
      });

      // Send system message
      const systemMsg = history.add(roomId, {
        username: 'system',
        text: `${sanitizedUsername} joined the room`,
        type: 'join'
      });
      io.to(roomId).emit('message:new', systemMsg);

      console.log(`User '${sanitizedUsername}' joined room '${roomId}'`);
    } catch (error) {
      console.error('Error in user:join:', error.message);
      callback({ error: error.message });
    }
  });

  // --------------------------------------------------------------------------
  // Chat Message
  // --------------------------------------------------------------------------
  socket.on('message:send', ({ text, roomId }, callback) => {
    try {
      const user = users.getBySocket(socket.id);
      if (!user) {
        return callback({ error: 'User not found' });
      }

      // Validate message
      if (!text || !text.trim()) {
        return callback({ error: 'Message cannot be empty' });
      }

      const trimmedText = text.trim().slice(0, MAX_MESSAGE_LENGTH);

      // Analyze sentiment
      const sentimentResult = sentiment.analyze(trimmedText);

      // Create message
      const message = history.add(roomId, {
        username: user.username,
        text: trimmedText,
        sentiment: {
          score: sentimentResult.score,
          comparative: sentimentResult.comparative,
          label: sentimentResult.label,
          confidence: sentimentResult.confidence,
          emoji: sentiment.getEmoji(sentimentResult.label)
        },
        type: 'chat'
      });

      // Increment room message count
      rooms.incrementMessageCount(roomId);

      // Broadcast message
      io.to(roomId).emit('message:new', message);

      callback({ success: true, message });

      console.log(`[${roomId}] ${user.username}: ${trimmedText} (${sentimentResult.label})`);
    } catch (error) {
      console.error('Error in message:send:', error.message);
      callback({ error: error.message });
    }
  });

  // --------------------------------------------------------------------------
  // Typing Indicator
  // --------------------------------------------------------------------------
  socket.on('typing:start', ({ roomId }) => {
    try {
      const user = users.getBySocket(socket.id);
      if (!user || !roomId) return;

      // Set typing status
      users.setTyping(socket.id, true, roomId);

      // Clear existing timeout
      if (typingTimeouts.has(socket.id)) {
        clearTimeout(typingTimeouts.get(socket.id));
      }

      // Set auto-stop timeout
      const timeout = setTimeout(() => {
        users.setTyping(socket.id, false);
        const typingUsers = users.getTypingInRoom(roomId, user.username);
        io.to(roomId).emit('typing:update', { typingUsers });
      }, TYPING_DEBOUNCE_MS);
      typingTimeouts.set(socket.id, timeout);

      // Broadcast typing status
      const typingUsers = users.getTypingInRoom(roomId, user.username);
      socket.to(roomId).emit('typing:update', { typingUsers });
    } catch (error) {
      console.error('Error in typing:start:', error.message);
    }
  });

  socket.on('typing:stop', ({ roomId }) => {
    try {
      const user = users.getBySocket(socket.id);
      if (!user || !roomId) return;

      // Clear timeout
      if (typingTimeouts.has(socket.id)) {
        clearTimeout(typingTimeouts.get(socket.id));
        typingTimeouts.delete(socket.id);
      }

      // Clear typing status
      users.setTyping(socket.id, false);

      // Broadcast updated typing status
      const typingUsers = users.getTypingInRoom(roomId, user.username);
      socket.to(roomId).emit('typing:update', { typingUsers });
    } catch (error) {
      console.error('Error in typing:stop:', error.message);
    }
  });

  // --------------------------------------------------------------------------
  // Disconnect
  // --------------------------------------------------------------------------
  socket.on('disconnect', (reason) => {
    try {
      // Clear typing timeout
      if (typingTimeouts.has(socket.id)) {
        clearTimeout(typingTimeouts.get(socket.id));
        typingTimeouts.delete(socket.id);
      }

      // Get user before unregistering
      const user = users.getBySocket(socket.id);
      if (!user) {
        console.log(`Socket disconnected (no user): ${socket.id}`);
        return;
      }

      const { username, roomId } = user;

      // Leave socket room
      socket.leave(roomId);

      // Unregister user
      users.unregister(socket.id);
      rooms.leave(roomId, username);

      // Broadcast user left
      socket.to(roomId).emit('user:left', {
        username,
        roomId,
        timestamp: new Date().toISOString(),
        onlineCount: users.getOnlineCount(),
        users: users.getUsersInRoom(roomId)
      });

      // Send system message
      const systemMsg = history.add(roomId, {
        username: 'system',
        text: `${username} left the room`,
        type: 'leave'
      });
      io.to(roomId).emit('message:new', systemMsg);

      console.log(`User '${username}' left room '${roomId}' (${reason})`);
    } catch (error) {
      console.error('Error in disconnect handler:', error.message);
    }
  });
});

// ============================================================================
// Server Startup
// ============================================================================

async function start() {
  try {
    // Initialize modules
    rooms.init();
    history.init();
    await history.load();

    server.listen(PORT, () => {
      console.log(`=====================================`);
      console.log(` Chat Sentiment App running on port ${PORT}`);
      console.log(`=====================================`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` Rooms: ${rooms.getAll().length} default`);
      console.log(` Max message length: ${MAX_MESSAGE_LENGTH} chars`);
      console.log(`=====================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await history.persist();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await history.persist();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Initialize rooms and history at module load for tests
rooms.init();
history.init();

// Start if this file is run directly
if (require.main === module) {
  start();
}

module.exports = { app, server, io, start };
