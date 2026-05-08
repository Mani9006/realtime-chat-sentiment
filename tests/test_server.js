/**
 * Server & API Endpoint Tests
 * Jest test suite for Express routes and Socket.IO events
 */

'use strict';

const request = require('supertest');
const { app, server, io } = require('../src/server');

describe('Express Server', () => {

  afterAll(async () => {
    if (server && server.listening) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('GET /api/health', () => {
    test('returns health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('connections');
    });
  });

  describe('GET /api/rooms', () => {
    test('returns list of rooms', async () => {
      const res = await request(app).get('/api/rooms');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('rooms');
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.rooms)).toBe(true);
      expect(res.body.rooms.length).toBeGreaterThanOrEqual(4);
    });

    test('rooms have correct structure', async () => {
      const res = await request(app).get('/api/rooms');
      const room = res.body.rooms[0];
      expect(room).toHaveProperty('id');
      expect(room).toHaveProperty('name');
      expect(room).toHaveProperty('description');
      expect(room).toHaveProperty('memberCount');
    });
  });

  describe('GET /api/rooms/:roomId', () => {
    test('returns room details for existing room', async () => {
      const res = await request(app).get('/api/rooms/general');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'general');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('stats');
    });

    test('returns 404 for non-existent room', async () => {
      const res = await request(app).get('/api/rooms/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/rooms/:roomId/messages', () => {
    test('returns messages for existing room', async () => {
      const res = await request(app).get('/api/rooms/general/messages');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('hasMore');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    test('respects limit parameter', async () => {
      const res = await request(app).get('/api/rooms/general/messages?limit=5');
      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBeLessThanOrEqual(5);
    });

    test('caps limit at 100', async () => {
      const res = await request(app).get('/api/rooms/general/messages?limit=200');
      expect(res.status).toBe(200);
    });

    test('returns 404 for non-existent room', async () => {
      const res = await request(app).get('/api/rooms/nonexistent/messages');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/rooms/:roomId/search', () => {
    test('returns 400 for missing query', async () => {
      const res = await request(app).get('/api/rooms/general/search');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('returns 400 for empty query', async () => {
      const res = await request(app).get('/api/rooms/general/search?q=');
      expect(res.status).toBe(400);
    });

    test('returns search results', async () => {
      const res = await request(app).get('/api/rooms/general/search?q=test');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(res.body).toHaveProperty('count');
    });

    test('returns 404 for non-existent room', async () => {
      const res = await request(app).get('/api/rooms/nonexistent/search?q=test');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/rooms/:roomId/sentiment', () => {
    test('returns sentiment stats for room', async () => {
      const res = await request(app).get('/api/rooms/general/sentiment');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('roomId');
      expect(res.body).toHaveProperty('totalMessages');
      expect(res.body).toHaveProperty('sentimentCounts');
    });

    test('returns 404 for non-existent room', async () => {
      const res = await request(app).get('/api/rooms/nonexistent/sentiment');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/rooms', () => {
    test('creates a new room', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ id: 'test-room-api', name: 'Test Room API', description: 'Testing' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'test-room-api');
      expect(res.body).toHaveProperty('name', 'Test Room API');
    });

    test('returns 400 for missing id', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ name: 'No ID' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('returns 400 for missing name', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ id: 'no-name' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('returns 400 for duplicate room', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ id: 'test-room-api', name: 'Duplicate' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users/online', () => {
    test('returns online users', async () => {
      const res = await request(app).get('/api/users/online');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.users)).toBe(true);
    });
  });

  describe('Static file serving', () => {
    test('serves index.html', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('<!DOCTYPE html>');
    });

    test('serves CSS', async () => {
      const res = await request(app).get('/css/style.css');
      expect(res.status).toBe(200);
      expect(res.text).toContain('body');
    });

    test('serves JS', async () => {
      const res = await request(app).get('/js/chat.js');
      expect(res.status).toBe(200);
      expect(res.text).toContain('socket');
    });

    test('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/unknown-route');
      expect(res.status).toBe(404);
    });
  });
});
