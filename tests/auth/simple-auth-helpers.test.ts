/**
 * @fileoverview Unit tests for simple authentication helpers
 * @module tests/auth/simple-auth-helpers.test
 */

import { checkAuthentication, requireAuthentication } from '@/lib/simple-auth-helpers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Mock Next.js functions
jest.mock('next/headers');
jest.mock('next/navigation');

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('Simple Auth Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAuthentication', () => {
    it('should return unauthenticated when no session cookie exists', async () => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
      } as any);

      const result = await checkAuthentication();

      expect(result.authenticated).toBe(false);
      expect(result.user).toBeUndefined();
    });

    it('should return authenticated when valid session cookie exists', async () => {
      const sessionData = {
        uid: 'test-user-123',
        email: 'test@example.com',
        timestamp: Date.now(),
        environment: 'test'
      };

      const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: sessionToken }),
      } as any);

      const result = await checkAuthentication();

      expect(result.authenticated).toBe(true);
      expect(result.user).toEqual({
        uid: 'test-user-123',
        email: 'test@example.com'
      });
      expect(result.environment).toBe('test');
    });

    it('should return unauthenticated when session is expired', async () => {
      const sessionData = {
        uid: 'test-user-123',
        email: 'test@example.com',
        timestamp: Date.now() - (60 * 60 * 24 * 8 * 1000), // 8 days ago (expired)
        environment: 'test'
      };

      const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: sessionToken }),
      } as any);

      const result = await checkAuthentication();

      expect(result.authenticated).toBe(false);
    });

    it('should return unauthenticated when session cookie is invalid', async () => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: 'invalid-token' }),
      } as any);

      const result = await checkAuthentication();

      expect(result.authenticated).toBe(false);
    });
  });

  describe('requireAuthentication', () => {
    it('should return user when authenticated', async () => {
      const sessionData = {
        uid: 'test-user-123',
        email: 'test@example.com',
        timestamp: Date.now(),
        environment: 'test'
      };

      const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: sessionToken }),
      } as any);

      const user = await requireAuthentication();

      expect(user).toEqual({
        uid: 'test-user-123',
        email: 'test@example.com'
      });
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should redirect to login when not authenticated', async () => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
      } as any);

      // Mock redirect to throw (simulating redirect behavior)
      mockRedirect.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(requireAuthentication()).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });
  });
});