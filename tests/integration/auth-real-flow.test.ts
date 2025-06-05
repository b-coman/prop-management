/**
 * @fileoverview Real authentication flow integration test
 * @module tests/integration/auth-real-flow
 * 
 * @description
 * Tests the actual authentication flow with the running dev server
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

describe('Real Authentication Flow Integration Test', () => {
  const baseUrl = 'http://localhost:9002';
  
  beforeAll(() => {
    // Ensure we're in development mode
    process.env.NODE_ENV = 'development';
  });

  describe('Page Accessibility', () => {
    it('should serve login page successfully', async () => {
      const response = await fetch(`${baseUrl}/login`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    }, 10000);

    it('should redirect admin page when not authenticated', async () => {
      const response = await fetch(`${baseUrl}/admin`, {
        redirect: 'manual'
      });
      
      expect([301, 302, 307, 308]).toContain(response.status);
    }, 10000);
  });

  describe('Development Session API', () => {
    it('should create development session successfully', async () => {
      const mockUser = {
        uid: 'test-user-123',
        email: 'test@example.com'
      };

      const response = await fetch(`${baseUrl}/api/auth/dev-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: mockUser }),
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.uid).toBe(mockUser.uid);
      expect(data.user.email).toBe(mockUser.email);
      expect(data.mode).toBe('development');

      // Check if session cookie was set
      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toContain('dev-session=');
    }, 10000);

    it('should reject dev session API in production mode', async () => {
      // Temporarily set to production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await fetch(`${baseUrl}/api/auth/dev-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: { uid: 'test', email: 'test@test.com' } }),
      });

      expect(response.status).toBe(403);
      
      const data = await response.json();
      expect(data.error).toContain('only available in development');

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    }, 10000);

    it('should delete development session successfully', async () => {
      const response = await fetch(`${baseUrl}/api/auth/dev-session`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    }, 10000);
  });

  describe('Authentication State Persistence', () => {
    it('should maintain authentication across requests', async () => {
      // Step 1: Create a dev session
      const mockUser = {
        uid: 'persistent-user-123',
        email: 'persistent@example.com'
      };

      const sessionResponse = await fetch(`${baseUrl}/api/auth/dev-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: mockUser }),
      });

      expect(sessionResponse.status).toBe(200);
      
      // Extract session cookie
      const setCookieHeader = sessionResponse.headers.get('set-cookie');
      const sessionCookie = setCookieHeader?.split(';')[0];
      
      expect(sessionCookie).toBeTruthy();

      // Step 2: Access admin page with session cookie
      const adminResponse = await fetch(`${baseUrl}/admin`, {
        headers: {
          'Cookie': sessionCookie!
        },
        redirect: 'manual'
      });

      // In development with AdminAuthCheck bypass, should get 200
      expect(adminResponse.status).toBe(200);
    }, 15000);
  });

  describe('API Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/auth/dev-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invalid: 'data' }),
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('User data required');
    }, 10000);

    it('should handle missing user data', async () => {
      const response = await fetch(`${baseUrl}/api/auth/dev-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: {} }),
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('User data required');
    }, 10000);
  });
});

// Helper to wait for server to be ready
async function waitForServer(url: string, maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.status < 500) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

// Run server readiness check before tests
beforeAll(async () => {
  const serverReady = await waitForServer('http://localhost:9002/api/test-env');
  if (!serverReady) {
    throw new Error('Development server is not responding. Please start it with: npm run dev');
  }
}, 30000);