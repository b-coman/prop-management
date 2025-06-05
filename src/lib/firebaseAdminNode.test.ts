/**
 * @fileoverview Tests for Firebase Admin Node.js functions
 * @module lib/firebaseAdminNode.test
 * 
 * @description
 * Tests for AC2 & AC3: Admin role verification and session verification
 * from Issue #14
 */

import { verifyIdToken, createSessionCookie, verifySessionCookie, isUserAdmin } from './firebaseAdminNode';

// Mock Firebase Admin
jest.mock('./firebaseAdminSafe', () => ({
  initializeFirebaseAdminSafe: jest.fn().mockResolvedValue({}),
  getAuthSafe: jest.fn(),
}));

describe('Firebase Admin Node Functions', () => {
  let mockAuth: any;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();

    // Setup mock auth object
    mockAuth = {
      verifyIdToken: jest.fn(),
      createSessionCookie: jest.fn(),
      verifySessionCookie: jest.fn(),
      getUser: jest.fn(),
    };

    const { getAuthSafe } = require('./firebaseAdminSafe');
    getAuthSafe.mockReturnValue(mockAuth);
  });

  describe('AC3: Session Verification', () => {
    describe('verifyIdToken', () => {
      it('should return decoded token for valid ID token', async () => {
        const mockDecodedToken = {
          uid: 'test-uid',
          email: 'test@example.com',
        };
        mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

        const result = await verifyIdToken('valid-id-token');

        expect(result).toEqual(mockDecodedToken);
        expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-id-token');
      });

      it('should return null for invalid ID token', async () => {
        mockAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

        const result = await verifyIdToken('invalid-id-token');

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith(
          '[FirebaseAdminNode] Error verifying ID token:',
          expect.any(Error)
        );
      });

      it('should return null if auth is not initialized', async () => {
        const { getAuthSafe } = require('./firebaseAdminSafe');
        getAuthSafe.mockReturnValue(null);

        const result = await verifyIdToken('any-token');

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith('[FirebaseAdminNode] Auth not initialized');
      });
    });

    describe('createSessionCookie', () => {
      it('should create session cookie with valid ID token', async () => {
        mockAuth.createSessionCookie.mockResolvedValue('session-cookie-value');

        const result = await createSessionCookie('valid-id-token', { expiresIn: 432000000 });

        expect(result).toBe('session-cookie-value');
        expect(mockAuth.createSessionCookie).toHaveBeenCalledWith('valid-id-token', { expiresIn: 432000000 });
      });

      it('should return null on error', async () => {
        mockAuth.createSessionCookie.mockRejectedValue(new Error('Cookie creation failed'));

        const result = await createSessionCookie('valid-id-token', { expiresIn: 432000000 });

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith(
          '[FirebaseAdminNode] Error creating session cookie:',
          expect.any(Error)
        );
      });
    });

    describe('verifySessionCookie', () => {
      it('should return decoded claims for valid session cookie', async () => {
        const mockDecodedClaims = {
          uid: 'test-uid',
          email: 'test@example.com',
        };
        mockAuth.verifySessionCookie.mockResolvedValue(mockDecodedClaims);

        const result = await verifySessionCookie('valid-session-cookie');

        expect(result).toEqual(mockDecodedClaims);
        expect(mockAuth.verifySessionCookie).toHaveBeenCalledWith('valid-session-cookie', true);
      });

      it('should return null for invalid session cookie', async () => {
        mockAuth.verifySessionCookie.mockRejectedValue(new Error('Invalid session'));

        const result = await verifySessionCookie('invalid-session-cookie');

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith(
          '[FirebaseAdminNode] Error verifying session cookie:',
          expect.any(Error)
        );
      });
    });
  });

  describe('AC2: Admin Role Verification', () => {
    describe('isUserAdmin', () => {
      it('should return true for admin users in whitelist', async () => {
        process.env.ADMIN_EMAILS = 'admin@example.com,manager@example.com';
        mockAuth.getUser.mockResolvedValue({
          uid: 'admin-uid',
          email: 'admin@example.com',
        });

        const result = await isUserAdmin('admin-uid');

        expect(result).toBe(true);
        expect(mockAuth.getUser).toHaveBeenCalledWith('admin-uid');
      });

      it('should return false for non-admin users', async () => {
        process.env.ADMIN_EMAILS = 'admin@example.com,manager@example.com';
        mockAuth.getUser.mockResolvedValue({
          uid: 'user-uid',
          email: 'user@example.com',
        });

        const result = await isUserAdmin('user-uid');

        expect(result).toBe(false);
      });

      it('should return true for any authenticated user in development with no whitelist', async () => {
        const originalNodeEnv = process.env.NODE_ENV;
        const originalAdminEmails = process.env.ADMIN_EMAILS;
        
        process.env.NODE_ENV = 'development';
        delete process.env.ADMIN_EMAILS;
        
        mockAuth.getUser.mockResolvedValue({
          uid: 'any-uid',
          email: 'any@example.com',
        });

        const result = await isUserAdmin('any-uid');

        expect(result).toBe(true);
        expect(console.log).toHaveBeenCalledWith(
          '[FirebaseAdminNode] Development mode - allowing any authenticated user as admin'
        );
        
        // Restore original environment
        process.env.NODE_ENV = originalNodeEnv;
        if (originalAdminEmails !== undefined) {
          process.env.ADMIN_EMAILS = originalAdminEmails;
        }
      });

      it('should return false if user has no email', async () => {
        process.env.ADMIN_EMAILS = 'admin@example.com';
        mockAuth.getUser.mockResolvedValue({
          uid: 'no-email-uid',
          email: null,
        });

        const result = await isUserAdmin('no-email-uid');

        expect(result).toBe(false);
      });

      it('should return false on error', async () => {
        mockAuth.getUser.mockRejectedValue(new Error('User not found'));

        const result = await isUserAdmin('unknown-uid');

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
          '[FirebaseAdminNode] Error checking admin status:',
          expect.any(Error)
        );
      });
    });
  });
});