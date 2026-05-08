/**
 * Room Management Tests
 * Jest test suite for room CRUD and membership operations
 */

'use strict';

const rooms = require('../src/rooms');

describe('Room Management', () => {

  beforeEach(() => {
    rooms.clear();
  });

  afterAll(() => {
    rooms.clear();
  });

  describe('init', () => {
    test('creates default rooms on init', () => {
      const allRooms = rooms.getAll();
      expect(allRooms.length).toBeGreaterThanOrEqual(4);
    });

    test('default rooms have correct structure', () => {
      const room = rooms.get('general');
      expect(room).toBeDefined();
      expect(room.id).toBe('general');
      expect(room.name).toBe('General Chat');
      expect(room.isDefault).toBe(true);
    });
  });

  describe('create', () => {
    test('creates a new room', () => {
      const room = rooms.create('test-room', 'Test Room', 'A test room');
      expect(room.id).toBe('test-room');
      expect(room.name).toBe('Test Room');
      expect(room.description).toBe('A test room');
      expect(room.isDefault).toBe(false);
    });

    test('sanitizes room id', () => {
      const room = rooms.create('Test Room 1', 'Test Room', '');
      expect(room.id).toBe('test-room-1');
    });

    test('throws error for duplicate room', () => {
      rooms.create('unique-room', 'Unique', '');
      expect(() => {
        rooms.create('unique-room', 'Duplicate', '');
      }).toThrow(/already exists/);
    });

    test('throws error for missing id', () => {
      expect(() => {
        rooms.create('', 'Name', '');
      }).toThrow(/id must be/);
    });

    test('throws error for missing name', () => {
      expect(() => {
        rooms.create('id', '', '');
      }).toThrow(/name must be/);
    });

    test('createdBy defaults to system', () => {
      const room = rooms.create('by-test', 'Test', '');
      expect(room.createdBy).toBe('system');
    });
  });

  describe('get', () => {
    test('returns room by id', () => {
      const room = rooms.get('general');
      expect(room).toBeDefined();
      expect(room.id).toBe('general');
    });

    test('returns null for non-existent room', () => {
      const room = rooms.get('non-existent');
      expect(room).toBeNull();
    });

    test('returns null for empty id', () => {
      expect(rooms.get('')).toBeNull();
      expect(rooms.get(null)).toBeNull();
    });
  });

  describe('getAll', () => {
    test('returns all rooms', () => {
      const all = rooms.getAll();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThanOrEqual(4);
    });

    test('returned rooms are sanitized', () => {
      const all = rooms.getAll();
      const room = all[0];
      expect(room).toHaveProperty('id');
      expect(room).toHaveProperty('name');
      expect(room).toHaveProperty('memberCount');
      expect(room).not.toHaveProperty('members'); // Should be a Set internally
    });
  });

  describe('join', () => {
    test('adds user to room', () => {
      const result = rooms.join('general', 'alice');
      expect(result).toBe(true);
      expect(rooms.getMembers('general')).toContain('alice');
    });

    test('returns false for non-existent room', () => {
      const result = rooms.join('fake-room', 'alice');
      expect(result).toBe(false);
    });

    test('returns false for missing params', () => {
      expect(rooms.join('', 'user')).toBe(false);
      expect(rooms.join('general', '')).toBe(false);
      expect(rooms.join()).toBe(false);
    });
  });

  describe('leave', () => {
    test('removes user from room', () => {
      rooms.join('general', 'alice');
      const result = rooms.leave('general', 'alice');
      expect(result).toBe(true);
      expect(rooms.getMembers('general')).not.toContain('alice');
    });

    test('returns false for non-existent room', () => {
      const result = rooms.leave('fake-room', 'alice');
      expect(result).toBe(false);
    });

    test('returns false for missing params', () => {
      expect(rooms.leave('', 'user')).toBe(false);
      expect(rooms.leave('general', '')).toBe(false);
    });
  });

  describe('getMembers', () => {
    test('returns array of members', () => {
      rooms.join('general', 'alice');
      rooms.join('general', 'bob');
      const members = rooms.getMembers('general');
      expect(Array.isArray(members)).toBe(true);
      expect(members).toContain('alice');
      expect(members).toContain('bob');
    });

    test('returns empty array for non-existent room', () => {
      expect(rooms.getMembers('fake')).toEqual([]);
    });
  });

  describe('removeUserFromAll', () => {
    test('removes user from all rooms', () => {
      rooms.join('general', 'alice');
      rooms.join('tech', 'alice');
      rooms.removeUserFromAll('alice');
      expect(rooms.getMembers('general')).not.toContain('alice');
      expect(rooms.getMembers('tech')).not.toContain('alice');
    });

    test('handles missing username', () => {
      expect(() => rooms.removeUserFromAll()).not.toThrow();
    });
  });

  describe('exists', () => {
    test('returns true for existing room', () => {
      expect(rooms.exists('general')).toBe(true);
    });

    test('returns false for non-existing room', () => {
      expect(rooms.exists('fake')).toBe(false);
    });

    test('returns false for empty input', () => {
      expect(rooms.exists('')).toBe(false);
      expect(rooms.exists(null)).toBe(false);
    });
  });

  describe('incrementMessageCount', () => {
    test('increments message count', () => {
      const before = rooms.get('general');
      const initialCount = before.messageCount;
      rooms.incrementMessageCount('general');
      const after = rooms.get('general');
      expect(after.messageCount).toBe(initialCount + 1);
    });

    test('handles non-existent room gracefully', () => {
      expect(() => rooms.incrementMessageCount('fake')).not.toThrow();
    });
  });

  describe('remove', () => {
    test('deletes non-default room', () => {
      rooms.create('temp-room', 'Temp', '');
      const result = rooms.remove('temp-room');
      expect(result).toBe(true);
      expect(rooms.exists('temp-room')).toBe(false);
    });

    test('does not delete default room', () => {
      const result = rooms.remove('general');
      expect(result).toBe(false);
      expect(rooms.exists('general')).toBe(true);
    });

    test('returns false for non-existent room', () => {
      expect(rooms.remove('fake')).toBe(false);
    });
  });

  describe('getUserRooms', () => {
    test('returns rooms user is in', () => {
      rooms.join('general', 'alice');
      rooms.join('tech', 'alice');
      const userRooms = rooms.getUserRooms('alice');
      expect(userRooms).toContain('general');
      expect(userRooms).toContain('tech');
      expect(userRooms.length).toBe(2);
    });

    test('returns empty array for user in no rooms', () => {
      const userRooms = rooms.getUserRooms('nobody');
      expect(Array.isArray(userRooms)).toBe(true);
      expect(userRooms.length).toBe(0);
    });
  });

  describe('sanitize', () => {
    test('returns sanitized room object', () => {
      const room = rooms.get('general');
      expect(room).toHaveProperty('id');
      expect(room).toHaveProperty('name');
      expect(room).toHaveProperty('description');
      expect(room).toHaveProperty('createdBy');
      expect(room).toHaveProperty('isDefault');
      expect(room).toHaveProperty('memberCount');
      expect(room).toHaveProperty('createdAt');
      expect(room).toHaveProperty('messageCount');
    });

    test('memberCount is a number', () => {
      const room = rooms.get('general');
      expect(typeof room.memberCount).toBe('number');
    });
  });
});
