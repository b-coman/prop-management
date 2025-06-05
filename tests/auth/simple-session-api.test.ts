/**
 * @fileoverview Integration tests for simple session API
 * @module tests/auth/simple-session-api.test
 */

import { POST, GET, DELETE } from '@/app/api/auth/simple-session/route';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

// Mock Next.js functions
jest.mock('next/headers');

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

describe('Simple Session API', () => {
  let mockCookieStore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieStore = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    };
    mockCookies.mockReturnValue(mockCookieStore);
  });

  describe('POST /api/auth/simple-session', () => {
    it('should create session in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const request = new NextRequest('http://localhost/api/auth/simple-session', {
        method: 'POST',
        body: JSON.stringify({ idToken: 'test-token' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.environment).toBe('development');
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'auth-session',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/'
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should return error when no idToken provided', async () => {
      const request = new NextRequest('http://localhost/api/auth/simple-session', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ID token required');
    });
  });

  describe('GET /api/auth/simple-session', () => {
    it('should return authenticated when valid session exists', async () => {
      const sessionData = {
        uid: 'test-user-123',
        email: 'test@example.com',
        timestamp: Date.now(),
        environment: 'test'
      };

      const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

      mockCookieStore.get.mockReturnValue({ value: sessionToken });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(true);
      expect(data.user).toEqual({
        uid: 'test-user-123',
        email: 'test@example.com'
      });
      expect(data.environment).toBe('test');
    });

    it('should return unauthenticated when no session exists', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.error).toBe('No session found');
    });

    it('should return unauthenticated when session is expired', async () => {
      const sessionData = {
        uid: 'test-user-123',
        email: 'test@example.com',
        timestamp: Date.now() - (60 * 60 * 24 * 8 * 1000), // 8 days ago
        environment: 'test'
      };

      const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

      mockCookieStore.get.mockReturnValue({ value: sessionToken });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.error).toBe('Session expired');
    });
  });

  describe('DELETE /api/auth/simple-session', () => {
    it('should clear session cookie', async () => {
      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockCookieStore.delete).toHaveBeenCalledWith('auth-session');
    });
  });
});