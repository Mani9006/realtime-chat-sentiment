/**
 * Room Management Module
 * Handles room creation, deletion, membership, and metadata
 */

'use strict';

// In-memory room store
// Map<roomId, Room>
const rooms = new Map();

// Default rooms available to all users
const DEFAULT_ROOMS = [
  { id: 'general', name: 'General Chat', description: 'Open discussion for everyone', isDefault: true },
  { id: 'tech', name: 'Technology', description: 'Tech talks and programming', isDefault: true },
  { id: 'random', name: 'Random', description: 'Off-topic conversations', isDefault: true },
  { id: 'support', name: 'Support', description: 'Help and support channel', isDefault: true }
];

/**
 * Initialize default rooms
 */
function init() {
  for (const room of DEFAULT_ROOMS) {
    rooms.set(room.id, {
      ...room,
      members: new Set(),
      createdAt: new Date().toISOString(),
      messageCount: 0
    });
  }
}

/**
 * Create a new room
 * @param {string} id
 * @param {string} name
 * @param {string} description
 * @param {string} createdBy
 * @returns {object} Room object
 */
function create(id, name, description = '', createdBy = 'system') {
  if (!id || typeof id !== 'string') {
    throw new Error('Room id must be a non-empty string');
  }
  if (!name || typeof name !== 'string') {
    throw new Error('Room name must be a non-empty string');
  }
  if (rooms.has(id)) {
    throw new Error(`Room '${id}' already exists`);
  }

  const room = {
    id: id.trim().toLowerCase().replace(/\s+/g, '-'),
    name: name.trim(),
    description: description.trim(),
    createdBy,
    isDefault: false,
    members: new Set(),
    createdAt: new Date().toISOString(),
    messageCount: 0
  };

  rooms.set(room.id, room);
  return sanitize(room);
}

/**
 * Get a room by id
 * @param {string} id
 * @returns {object|null}
 */
function get(id) {
  if (!id || !rooms.has(id)) return null;
  return sanitize(rooms.get(id));
}

/**
 * Get all rooms
 * @returns {object[]}
 */
function getAll() {
  return Array.from(rooms.values()).map(sanitize);
}

/**
 * Add a user to a room
 * @param {string} roomId
 * @param {string} username
 * @returns {boolean}
 */
function join(roomId, username) {
  if (!roomId || !username) return false;
  if (!rooms.has(roomId)) return false;

  rooms.get(roomId).members.add(username);
  return true;
}

/**
 * Remove a user from a room
 * @param {string} roomId
 * @param {string} username
 * @returns {boolean}
 */
function leave(roomId, username) {
  if (!roomId || !username) return false;
  if (!rooms.has(roomId)) return false;

  rooms.get(roomId).members.delete(username);
  return true;
}

/**
 * Get members of a room
 * @param {string} roomId
 * @returns {string[]}
 */
function getMembers(roomId) {
  if (!roomId || !rooms.has(roomId)) return [];
  return Array.from(rooms.get(roomId).members);
}

/**
 * Remove a user from all rooms
 * @param {string} username
 */
function removeUserFromAll(username) {
  if (!username) return;
  for (const room of rooms.values()) {
    room.members.delete(username);
  }
}

/**
 * Check if a room exists
 * @param {string} roomId
 * @returns {boolean}
 */
function exists(roomId) {
  return !!roomId && rooms.has(roomId);
}

/**
 * Increment message count for a room
 * @param {string} roomId
 */
function incrementMessageCount(roomId) {
  if (roomId && rooms.has(roomId)) {
    rooms.get(roomId).messageCount++;
  }
}

/**
 * Delete a non-default room
 * @param {string} roomId
 * @returns {boolean}
 */
function remove(roomId) {
  if (!roomId || !rooms.has(roomId)) return false;
  const room = rooms.get(roomId);
  if (room.isDefault) return false;
  return rooms.delete(roomId);
}

/**
 * Get rooms a user is in
 * @param {string} username
 * @returns {string[]}
 */
function getUserRooms(username) {
  if (!username) return [];
  const userRooms = [];
  for (const [id, room] of rooms.entries()) {
    if (room.members.has(username)) {
      userRooms.push(id);
    }
  }
  return userRooms;
}

/**
 * Sanitize room object for external use (remove internal Sets)
 * @param {object} room
 * @returns {object}
 */
function sanitize(room) {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    createdBy: room.createdBy,
    isDefault: room.isDefault,
    memberCount: room.members.size,
    createdAt: room.createdAt,
    messageCount: room.messageCount
  };
}

/**
 * Clear all rooms (useful for testing)
 */
function clear() {
  rooms.clear();
  init();
}

module.exports = {
  init,
  create,
  get,
  getAll,
  join,
  leave,
  getMembers,
  removeUserFromAll,
  exists,
  incrementMessageCount,
  remove,
  getUserRooms,
  clear,
  // Expose for testing
  rooms
};
