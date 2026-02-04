/**
 * @fileoverview Core authorization service for admin access control
 * @module lib/authorization
 *
 * @description
 * Provides role-based access control for the admin panel.
 * Supports two roles:
 * - super_admin: Full access to everything (all properties, all operations)
 * - property_owner: Access only to assigned properties
 *
 * Features:
 * - Per-request caching (1 min TTL) to minimize Firestore reads
 * - Auto-provisioning of super admins from SUPER_ADMIN_EMAILS env var
 * - Filtering functions for properties, bookings, and inquiries
 *
 * @architecture
 * Location: Infrastructure layer
 * Pattern: Service module with caching
 *
 * @dependencies
 * - Internal: firebase.ts, simple-auth-helpers.ts, logger.ts
 * - External: firebase/firestore
 */

import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { loggers } from '@/lib/logger';

const logger = loggers.authorization;

// ============================================================================
// Types
// ============================================================================

export type AdminRole = 'super_admin' | 'property_owner';

export interface AdminUser {
  uid: string;
  email: string;
  role: AdminRole;
  managedProperties: string[]; // property slugs (empty for super_admin)
  displayName?: string;
  autoProvisioned?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
}

export interface AuthorizationResult {
  authorized: boolean;
  user?: AdminUser;
  error?: string;
}

export type AuthorizationErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NOT_AUTHORIZED'
  | 'NOT_SUPER_ADMIN'
  | 'NO_PROPERTY_ACCESS';

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: AuthorizationErrorCode
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// ============================================================================
// Cache Implementation
// Per-request caching with 1 minute TTL to minimize Firestore reads
// ============================================================================

interface CacheEntry {
  user: AdminUser | null;
  timestamp: number;
}

const userCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

function getCachedUser(uid: string): AdminUser | null | undefined {
  const entry = userCache.get(uid);
  if (!entry) {
    return undefined; // Not in cache
  }

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    userCache.delete(uid);
    return undefined; // Expired
  }

  return entry.user;
}

function setCachedUser(uid: string, user: AdminUser | null): void {
  userCache.set(uid, { user, timestamp: Date.now() });
}

/**
 * Clear the user cache (useful for testing or after role changes)
 */
export function clearUserCache(uid?: string): void {
  if (uid) {
    userCache.delete(uid);
  } else {
    userCache.clear();
  }
}

// ============================================================================
// Environment Helpers
// ============================================================================

/**
 * Check if email is in SUPER_ADMIN_EMAILS environment variable
 */
export function isEnvSuperAdmin(email: string): boolean {
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS
    ?.split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0) || [];

  return superAdminEmails.includes(email.toLowerCase());
}

/**
 * Get list of super admin emails from environment
 */
export function getSuperAdminEmails(): string[] {
  return process.env.SUPER_ADMIN_EMAILS
    ?.split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0) || [];
}

// ============================================================================
// Authentication Helper (to avoid circular dependency)
// ============================================================================

interface AuthUser {
  uid: string;
  email: string;
}

interface AuthResult {
  authenticated: boolean;
  user?: AuthUser;
}

/**
 * Check authentication from session cookie
 * This is a simplified version to avoid circular dependency with simple-auth-helpers
 */
async function checkAuthenticationInternal(): Promise<AuthResult> {
  try {
    // Dynamic import to work in server context
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth-session');

    if (!sessionCookie?.value) {
      return { authenticated: false };
    }

    // Try to parse as simple session
    try {
      const sessionData = JSON.parse(
        Buffer.from(sessionCookie.value, 'base64').toString()
      );

      // Check if session is expired (7 days)
      const isExpired = Date.now() - sessionData.timestamp > (60 * 60 * 24 * 7 * 1000);

      if (isExpired) {
        return { authenticated: false };
      }

      return {
        authenticated: true,
        user: {
          uid: sessionData.uid,
          email: sessionData.email
        }
      };
    } catch (parseError) {
      // If parsing fails, it might be a Firebase session cookie
      if (process.env.NODE_ENV === 'production') {
        try {
          const { verifySessionCookie } = await import('@/lib/firebaseAdminNode');
          const decodedClaims = await verifySessionCookie(sessionCookie.value);

          if (decodedClaims) {
            return {
              authenticated: true,
              user: {
                uid: decodedClaims.uid,
                email: decodedClaims.email || 'unknown@example.com'
              }
            };
          }
        } catch (verifyError) {
          logger.error('Session verification error', verifyError as Error);
        }
      }

      return { authenticated: false };
    }
  } catch (error) {
    logger.error('Authentication check error', error as Error);
    return { authenticated: false };
  }
}

// ============================================================================
// User Document Operations
// ============================================================================

/**
 * Fetch admin user from Firestore
 * Returns null if user doesn't exist or doesn't have an admin role
 */
async function fetchAdminUser(uid: string, email: string): Promise<AdminUser | null> {
  // Check cache first
  const cached = getCachedUser(uid);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();

      // Check if user has a valid admin role
      if (data.role !== 'super_admin' && data.role !== 'property_owner') {
        logger.debug('User exists but has no admin role', { uid, role: data.role });
        setCachedUser(uid, null);
        return null;
      }

      const user: AdminUser = {
        uid,
        email: data.email || email,
        role: data.role as AdminRole,
        managedProperties: data.managedProperties || [],
        displayName: data.displayName,
        autoProvisioned: data.autoProvisioned,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
        lastLogin: data.lastLogin instanceof Timestamp ? data.lastLogin.toDate() : undefined,
      };

      setCachedUser(uid, user);
      return user;
    }

    // User doc doesn't exist - check if should auto-provision
    if (isEnvSuperAdmin(email)) {
      logger.info('Auto-provisioning super admin from env var', { email });
      const newUser = await createAdminUser(uid, email, 'super_admin', [], true);
      setCachedUser(uid, newUser);
      return newUser;
    }

    logger.debug('User doc does not exist and email not in SUPER_ADMIN_EMAILS', { uid, email });
    setCachedUser(uid, null);
    return null;
  } catch (error) {
    logger.error('Error fetching admin user', error as Error, { uid });
    throw error;
  }
}

/**
 * Create a new admin user document
 */
async function createAdminUser(
  uid: string,
  email: string,
  role: AdminRole,
  managedProperties: string[] = [],
  autoProvisioned: boolean = false
): Promise<AdminUser> {
  const userRef = doc(db, 'users', uid);
  const now = serverTimestamp();

  const userData = {
    email,
    role,
    managedProperties,
    autoProvisioned,
    createdAt: now,
    updatedAt: now,
    lastLogin: now,
  };

  await setDoc(userRef, userData);
  logger.info('Created admin user', { uid, email, role, autoProvisioned });

  return {
    uid,
    email,
    role,
    managedProperties,
    autoProvisioned,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: new Date(),
  };
}

/**
 * Update user's lastLogin timestamp
 */
export async function updateLastLogin(uid: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      { lastLogin: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true }
    );

    // Invalidate cache
    userCache.delete(uid);
    logger.debug('Updated lastLogin', { uid });
  } catch (error) {
    logger.error('Error updating lastLogin', error as Error, { uid });
  }
}

// ============================================================================
// Authorization Check Functions
// ============================================================================

/**
 * Check if current user has admin access
 * Returns authorization result with user info if authorized
 */
export async function checkAdminAccess(): Promise<AuthorizationResult> {
  try {
    const authResult = await checkAuthenticationInternal();

    if (!authResult.authenticated || !authResult.user) {
      return { authorized: false, error: 'Not authenticated' };
    }

    const { uid, email } = authResult.user;
    const adminUser = await fetchAdminUser(uid, email);

    if (!adminUser) {
      logger.warn('User not authorized for admin access', { uid, email });
      return { authorized: false, error: 'Not authorized for admin access' };
    }

    return { authorized: true, user: adminUser };
  } catch (error) {
    logger.error('Error checking admin access', error as Error);
    return { authorized: false, error: 'Authorization check failed' };
  }
}

/**
 * Require admin access - throws AuthorizationError if not authorized
 */
export async function requireAdmin(): Promise<AdminUser> {
  const result = await checkAdminAccess();

  if (!result.authorized || !result.user) {
    throw new AuthorizationError(
      result.error || 'Not authorized',
      result.error === 'Not authenticated' ? 'NOT_AUTHENTICATED' : 'NOT_AUTHORIZED'
    );
  }

  return result.user;
}

/**
 * Require super admin access - throws AuthorizationError if not super admin
 */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const user = await requireAdmin();

  if (user.role !== 'super_admin') {
    logger.warn('Super admin required but user is not super admin', {
      uid: user.uid,
      role: user.role
    });
    throw new AuthorizationError('Super admin access required', 'NOT_SUPER_ADMIN');
  }

  return user;
}

// ============================================================================
// Property Access Functions
// ============================================================================

/**
 * Check if user can manage a specific property
 */
export function canManageProperty(user: AdminUser, propertySlug: string): boolean {
  // Super admins can manage any property
  if (user.role === 'super_admin') {
    return true;
  }

  // Property owners can only manage their assigned properties
  return user.managedProperties.includes(propertySlug);
}

/**
 * Require access to a specific property - throws AuthorizationError if not authorized
 */
export async function requirePropertyAccess(propertySlug: string): Promise<AdminUser> {
  const user = await requireAdmin();

  if (!canManageProperty(user, propertySlug)) {
    logger.warn('Property access denied', {
      uid: user.uid,
      propertySlug,
      managedProperties: user.managedProperties
    });
    throw new AuthorizationError(
      `No access to property: ${propertySlug}`,
      'NO_PROPERTY_ACCESS'
    );
  }

  return user;
}

// ============================================================================
// Filtering Functions
// ============================================================================

/**
 * Filter properties list based on user access
 */
export function filterPropertiesForUser<T extends { id?: string; slug?: string }>(
  properties: T[],
  user: AdminUser
): T[] {
  // Super admins see all properties
  if (user.role === 'super_admin') {
    return properties;
  }

  // Property owners only see their assigned properties
  return properties.filter(p => {
    const slug = p.slug || p.id;
    return slug && user.managedProperties.includes(slug);
  });
}

/**
 * Filter bookings list based on user's property access
 */
export function filterBookingsForUser<T extends { propertyId: string }>(
  bookings: T[],
  user: AdminUser
): T[] {
  // Super admins see all bookings
  if (user.role === 'super_admin') {
    return bookings;
  }

  // Property owners only see bookings for their properties
  return bookings.filter(b => user.managedProperties.includes(b.propertyId));
}

/**
 * Filter inquiries list based on user's property access
 */
export function filterInquiriesForUser<T extends { propertySlug: string }>(
  inquiries: T[],
  user: AdminUser
): T[] {
  // Super admins see all inquiries
  if (user.role === 'super_admin') {
    return inquiries;
  }

  // Property owners only see inquiries for their properties
  return inquiries.filter(i => user.managedProperties.includes(i.propertySlug));
}

// ============================================================================
// Error Handling Helper
// ============================================================================

/**
 * Handle authorization errors in server actions
 * Returns a standardized error response for use in server actions
 */
export function handleAuthError(error: unknown): { success: false; error: string } {
  if (error instanceof AuthorizationError) {
    switch (error.code) {
      case 'NOT_AUTHENTICATED':
        return { success: false, error: 'Please log in to continue' };
      case 'NOT_AUTHORIZED':
        return { success: false, error: 'You do not have admin access' };
      case 'NOT_SUPER_ADMIN':
        return { success: false, error: 'This action requires super admin privileges' };
      case 'NO_PROPERTY_ACCESS':
        return { success: false, error: 'You do not have access to this property' };
    }
  }

  logger.error('Unexpected authorization error', error as Error);
  return { success: false, error: 'Authorization failed' };
}
