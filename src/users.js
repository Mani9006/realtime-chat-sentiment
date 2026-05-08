/**
 * User Tracking Module
 * Manages online users, socket mappings, and activity tracking
 */

'use strict';

// In-memory user stores
// Map<socketId, User>
const socketUsers = new Map();
// Map<username, Set<socketId>>
const usernameSockets = new Map();
// Map<username, UserProfile>
const userProfiles = new Map();

/**
 * @typedef {object} User
 * @property {string} socketId
 * @property {string} username
 * @property {string} roomId
 * @property {string} joinedAt
 * @property {boolean} isTyping
 * @property {string|null} typingIn
 */

/**
 * Register a new user connection
 * @param {string} socketId
 * @param {string} username
 * @param {string} roomId
 * @returns {object} User object
 */
function register(socketId, username, roomId) {
  if (!socketId || !username || !roomId) {
    throw new Error('socketId, username, and roomId are required');
  }

  const sanitizedUsername = sanitizeUsername(username);
  if (!sanitizedUsername) {
    throw new Error('Invalid username');
  }

  const user = {
    socketId,
    username: sanitizedUsername,
    roomId,
    joinedAt: new Date().toISOString(),
    isTyping: false,
    typingIn: null,
    status: 'online'
  };

  socketUsers.set(socketId, user);

  if (!usernameSockets.has(sanitizedUsername)) {
    usernameSockets.set(sanitizedUsername, new Set());
  }
  usernameSockets.get(sanitizedUsername).add(socketId);

  // Update or create profile
  if (!userProfiles.has(sanitizedUsername)) {
    userProfiles.set(sanitizedUsername, {
      username: sanitizedUsername,
      firstSeen: user.joinedAt,
      lastSeen: user.joinedAt,
      totalConnections: 0,
      roomsJoined: new Set()
    });
  }
  const profile = userProfiles.get(sanitizedUsername);
  profile.totalConnections += 1;
  profile.lastSeen = user.joinedAt;
  profile.roomsJoined.add(roomId);

  return user;
}

/**
 * Unregister a user by socket id
 * @param {string} socketId
 * @returns {object|null} Removed user or null
 */
function unregister(socketId) {
  if (!socketId || !socketUsers.has(socketId)) return null;

  const user = socketUsers.get(socketId);
  socketUsers.delete(socketId);

  // Remove from username sockets
  if (usernameSockets.has(user.username)) {
    usernameSockets.get(user.username).delete(socketId);
    if (usernameSockets.get(user.username).size === 0) {
      usernameSockets.delete(user.username);
      // Update last seen
      if (userProfiles.has(user.username)) {
        userProfiles.get(user.username).lastSeen = new Date().toISOString();
      }
    }
  }

  return user;
}

/**
 * Get user by socket id
 * @param {string} socketId
 * @returns {object|null}
 */
function getBySocket(socketId) {
  if (!socketId) return null;
  return socketUsers.get(socketId) || null;
}

/**
 * Get sockets by username
 * @param {string} username
 * @returns {string[]}
 */
function getSocketsByUsername(username) {
  if (!username || !usernameSockets.has(username)) return [];
  return Array.from(usernameSockets.get(username));
}

/**
 * Update user room
 * @param {string} socketId
 * @param {string} newRoomId
 * @returns {boolean}
 */
function updateRoom(socketId, newRoomId) {
  if (!socketId || !newRoomId) return false;
  if (!socketUsers.has(socketId)) return false;

  const user = socketUsers.get(socketId);
  user.roomId = newRoomId;

  if (userProfiles.has(user.username)) {
    userProfiles.get(user.username).roomsJoined.add(newRoomId);
  }

  return true;
}

/**
 * Set typing status
 * @param {string} socketId
 * @param {boolean} isTyping
 * @param {string|null} roomId
 * @returns {boolean}
 */
function setTyping(socketId, isTyping, roomId = null) {
  if (!socketId || !socketUsers.has(socketId)) return false;

  const user = socketUsers.get(socketId);
  user.isTyping = isTyping;
  user.typingIn = isTyping ? roomId : null;
  return true;
}

/**
 * Get users in a specific room
 * @param {string} roomId
 * @returns {object[]}
 */
function getUsersInRoom(roomId) {
  if (!roomId) return [];
  const users = [];
  for (const user of socketUsers.values()) {
    if (user.roomId === roomId) {
      users.push({
        username: user.username,
        roomId: user.roomId,
        isTyping: user.isTyping,
        status: user.status
      });
    }
  }
  return users;
}

/**
 * Get all online users (unique by username)
 * @returns {object[]}
 */
function getAllOnline() {
  const seen = new Set();
  const users = [];
  for (const user of socketUsers.values()) {
    if (!seen.has(user.username)) {
      seen.add(user.username);
      users.push({
        username: user.username,
        roomId: user.roomId,
        status: user.status
      });
    }
  }
  return users;
}

/**
 * Get count of online users
 * @returns {number}
 */
function getOnlineCount() {
  return usernameSockets.size;
}

/**
 * Get typing users in a room
 * @param {string} roomId
 * @param {string} excludeUsername
 * @returns {string[]}
 */
function getTypingInRoom(roomId, excludeUsername = null) {
  if (!roomId) return [];
  const typing = [];
  for (const user of socketUsers.values()) {
    if (user.typingIn === roomId && user.isTyping && user.username !== excludeUsername) {
      typing.push(user.username);
    }
  }
  return typing;
}

/**
 * Check if username is available
 * @param {string} username
 * @returns {boolean}
 */
function isUsernameAvailable(username) {
  if (!username) return false;
  return !usernameSockets.has(sanitizeUsername(username));
}

/**
 * Sanitize username input
 * @param {string} username
 * @returns {string|null}
 */
function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const sanitized = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  return sanitized.length > 0 ? sanitized : null;
}

/**
 * Get user profile
 * @param {string} username
 * @returns {object|null}
 */
function getProfile(username) {
  if (!username || !userProfiles.has(username)) return null;
  const profile = userProfiles.get(username);
  return {
    username: profile.username,
    firstSeen: profile.firstSeen,
    lastSeen: profile.lastSeen,
    totalConnections: profile.totalConnections,
    roomsJoined: Array.from(profile.roomsJoined)
  };
}

/**
 * Get all user profiles
 * @returns {object[]}
 */
function getAllProfiles() {
  return Array.from(userProfiles.values()).map(p => ({
    username: p.username,
    firstSeen: p.firstSeen,
    lastSeen: p.lastSeen,
    totalConnections: p.totalConnections,
    roomsJoined: Array.from(p.roomsJoined)
  }));
}

/**
 * Update user status
 * @param {string} socketId
 * @param {string} status
 * @returns {boolean}
 */
function setStatus(socketId, status) {
  if (!socketId || !socketUsers.has(socketId)) return false;
  const validStatuses = ['online', 'away', 'dnd'];
  if (!validStatuses.includes(status)) return false;

  socketUsers.get(socketId).status = status;
  return true;
}

/**
 * Clear all users (useful for testing)
 */
function clear() {
  socketUsers.clear();
  usernameSockets.clear();
  userProfiles.clear();
}

module.exports = {
  register,
  unregister,
  getBySocket,
  getSocketsByUsername,
  updateRoom,
  setTyping,
  getUsersInRoom,
  getAllOnline,
  getOnlineCount,
  getTypingInRoom,
  isUsernameAvailable,
  sanitizeUsername,
  getProfile,
  getAllProfiles,
  setStatus,
  clear
};
