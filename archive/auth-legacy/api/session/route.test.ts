/**
 * @fileoverview Tests for session management API endpoint
 * @module api/auth/session/route.test
 * 
 * @description
 * Tests for AC1: Session Cookie Creation from Issue #14
 * Verifies that the session API endpoint properly creates and manages session cookies
 */

import { NextRequest } from 'next/server';
import { POST, DELETE } from './route';

// Mock the dependencies
jest.mock('@/lib/firebaseAdminNode', () => ({
  verifyIdToken: jest.fn(),
  createSessionCookie: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe('AC1: Session Cookie Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn(); // Mock console.log
    console.error = jest.fn(); // Mock console.error
  });

  describe('POST /api/auth/session', () => {
    it('should return 400 if no ID token is provided', async () => {
      const request = new NextRequest('http://localhost/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ID token is required');
    });

    it('should return 401 if ID token verification fails', async () => {
      const { verifyIdToken } = require('@/lib/firebaseAdminNode');
      verifyIdToken.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({ idToken: 'invalid-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid ID token');
      expect(verifyIdToken).toHaveBeenCalledWith('invalid-token');
    });

    it('should return 500 if session cookie creation fails', async () => {
      const { verifyIdToken, createSessionCookie } = require('@/lib/firebaseAdminNode');
      verifyIdToken.mockResolvedValue({
        uid: 'test-uid',
        email: 'test@example.com',
      });
      createSessionCookie.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({ idToken: 'valid-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create session cookie');
    });

    it('should successfully create session cookie with valid ID token', async () => {
      const { verifyIdToken, createSessionCookie } = require('@/lib/firebaseAdminNode');
      const { cookies } = require('next/headers');
      const mockSet = jest.fn();
      cookies.mockReturnValue({ set: mockSet });

      verifyIdToken.mockResolvedValue({
        uid: 'test-uid',
        email: 'test@example.com',
      });
      createSessionCookie.mockResolvedValue('session-cookie-value');

      const request = new NextRequest('http://localhost/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({ idToken: 'valid-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toEqual({
        uid: 'test-uid',
        email: 'test@example.com',
      });

      // Verify session cookie was set with correct options
      expect(mockSet).toHaveBeenCalledWith('session', 'session-cookie-value', {
        httpOnly: true,
        secure: false, // NODE_ENV is test
        sameSite: 'lax',
        maxAge: 432000, // 5 days in seconds
        path: '/',
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      const { verifyIdToken } = require('@/lib/firebaseAdminNode');
      verifyIdToken.mockRejectedValue(new Error('Firebase error'));

      const request = new NextRequest('http://localhost/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({ idToken: 'valid-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('Firebase error');
    });
  });

  describe('DELETE /api/auth/session', () => {
    it('should successfully delete session cookie', async () => {
      const { cookies } = require('next/headers');
      const mockDelete = jest.fn();
      cookies.mockReturnValue({ delete: mockDelete });

      const request = new NextRequest('http://localhost/api/auth/session', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith('session');
    });
  });
});

// Run the tests
if (require.main === module) {
  console.log('Running session API tests...');
  require('jest').run();
}