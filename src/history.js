/**
 * Message Persistence Module
 * In-memory storage with optional JSON file persistence
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');

// In-memory message store: Map<roomId, Message[]>
const messages = new Map();

// Configuration
const MAX_MESSAGES_PER_ROOM = 200;
const HISTORY_FILE = path.join(__dirname, '..', 'data', 'chat_history.json');
const PERSIST_INTERVAL_MS = 30000; // Auto-save every 30 seconds

/**
 * @typedef {object} Message
 * @property {string} id
 * @property {string} roomId
 * @property {string} username
 * @property {string} text
 * @property {string} timestamp
 * @property {object|null} sentiment
 * @property {string} type - 'chat' | 'system' | 'join' | 'leave'
 */

/**
 * Initialize history module
 */
function init() {
  // Setup auto-save interval
  setInterval(autoSave, PERSIST_INTERVAL_MS);
}

/**
 * Add a message to history
 * @param {string} roomId
 * @param {object} message
 * @returns {object} Stored message
 */
function add(roomId, message) {
  if (!roomId || !message) return null;

  const roomMessages = messages.get(roomId) || [];

  const storedMessage = {
    id: generateId(),
    roomId,
    username: message.username || 'system',
    text: String(message.text || ''),
    timestamp: new Date().toISOString(),
    sentiment: message.sentiment || null,
    type: message.type || 'chat'
  };

  roomMessages.push(storedMessage);

  // Trim if exceeds max
  if (roomMessages.length > MAX_MESSAGES_PER_ROOM) {
    roomMessages.splice(0, roomMessages.length - MAX_MESSAGES_PER_ROOM);
  }

  messages.set(roomId, roomMessages);
  return storedMessage;
}

/**
 * Get messages for a room with pagination
 * @param {string} roomId
 * @param {object} options
 * @returns {object} { messages, total, hasMore }
 */
function getMessages(roomId, options = {}) {
  if (!roomId) return { messages: [], total: 0, hasMore: false };

  const { limit = 50, before = null } = options;
  const roomMessages = messages.get(roomId) || [];

  let filtered = [...roomMessages];

  // Filter by timestamp if before is provided
  if (before) {
    filtered = filtered.filter(m => m.timestamp < before);
  }

  const total = filtered.length;

  // Apply limit (get most recent)
  const limited = filtered.slice(-limit).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  return {
    messages: limited,
    total: roomMessages.length,
    hasMore: roomMessages.length > limit && limited.length === limit
  };
}

/**
 * Get recent messages for a room (last N messages)
 * @param {string} roomId
 * @param {number} count
 * @returns {object[]}
 */
function getRecent(roomId, count = 30) {
  const result = getMessages(roomId, { limit: count });
  return result.messages;
}

/**
 * Get last N messages across all rooms
 * @param {number} count
 * @returns {object[]}
 */
function getGlobalRecent(count = 20) {
  const allMessages = [];
  for (const [roomId, roomMessages] of messages.entries()) {
    for (const msg of roomMessages) {
      allMessages.push({ ...msg, roomId });
    }
  }

  return allMessages
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, count);
}

/**
 * Search messages in a room
 * @param {string} roomId
 * @param {string} query
 * @returns {object[]}
 */
function search(roomId, query) {
  if (!roomId || !query) return [];
  const roomMessages = messages.get(roomId) || [];
  const lowerQuery = query.toLowerCase();

  return roomMessages.filter(m =>
    m.text.toLowerCase().includes(lowerQuery) ||
    m.username.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get message statistics for a room
 * @param {string} roomId
 * @returns {object|null}
 */
function getStats(roomId) {
  if (!roomId || !messages.has(roomId)) return null;
  const roomMessages = messages.get(roomId);
  const sentimentCounts = {};
  let totalScore = 0;

  for (const msg of roomMessages) {
    if (msg.sentiment && msg.sentiment.label) {
      sentimentCounts[msg.sentiment.label] = (sentimentCounts[msg.sentiment.label] || 0) + 1;
      totalScore += msg.sentiment.score || 0;
    }
  }

  return {
    roomId,
    totalMessages: roomMessages.length,
    sentimentCounts,
    averageScore: roomMessages.length > 0 ? totalScore / roomMessages.length : 0,
    timeSpan: roomMessages.length > 0 ? {
      first: roomMessages[0].timestamp,
      last: roomMessages[roomMessages.length - 1].timestamp
    } : null
  };
}

/**
 * Delete a message by id
 * @param {string} roomId
 * @param {string} messageId
 * @returns {boolean}
 */
function deleteMessage(roomId, messageId) {
  if (!roomId || !messageId || !messages.has(roomId)) return false;
  const roomMessages = messages.get(roomId);
  const index = roomMessages.findIndex(m => m.id === messageId);
  if (index === -1) return false;
  roomMessages.splice(index, 1);
  return true;
}

/**
 * Clear history for a room
 * @param {string} roomId
 */
function clearRoom(roomId) {
  if (roomId) {
    messages.delete(roomId);
  }
}

/**
 * Clear all history
 */
function clear() {
  messages.clear();
}

/**
 * Persist messages to JSON file
 */
async function persist() {
  try {
    const dataDir = path.dirname(HISTORY_FILE);
    await fs.mkdir(dataDir, { recursive: true });

    const exportData = {};
    for (const [roomId, roomMessages] of messages.entries()) {
      exportData[roomId] = roomMessages;
    }

    await fs.writeFile(HISTORY_FILE, JSON.stringify(exportData, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to persist messages:', error.message);
    return false;
  }
}

/**
 * Load messages from JSON file
 */
async function load() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(data);

    for (const [roomId, roomMessages] of Object.entries(parsed)) {
      if (Array.isArray(roomMessages)) {
        messages.set(roomId, roomMessages);
      }
    }
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to load messages:', error.message);
    }
    return false;
  }
}

/**
 * Auto-save handler
 */
async function autoSave() {
  await persist();
}

/**
 * Generate a unique message id
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

module.exports = {
  init,
  add,
  getMessages,
  getRecent,
  getGlobalRecent,
  search,
  getStats,
  deleteMessage,
  clearRoom,
  clear,
  persist,
  load,
  // Config for testing
  MAX_MESSAGES_PER_ROOM,
  HISTORY_FILE
};
