/**
 * @fileoverview Simple in-memory rate limiter for API routes
 * @module lib/rate-limiter
 *
 * @description
 * Provides IP-based rate limiting for public API endpoints.
 * Uses in-memory storage which resets on server restart.
 * For distributed rate limiting across multiple instances, consider Redis.
 *
 * @architecture
 * Part of: API security layer
 * Layer: Infrastructure/Security
 * Pattern: Sliding window rate limiting
 */

import { NextRequest } from 'next/server';
import { loggers } from '@/lib/logger';

const logger = loggers.auth;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limit data
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  // Check common headers for proxied requests
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback - in production this should always have a forwarded header
  return 'unknown';
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional prefix for the rate limit key (e.g., endpoint name) */
  keyPrefix?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the limit resets */
  resetAt: number;
  /** Current request count */
  current: number;
}

/**
 * Check and update rate limit for a request
 *
 * @example
 * ```typescript
 * const result = checkRateLimit(request, { maxRequests: 60, windowSeconds: 60 });
 * if (!result.allowed) {
 *   return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 * }
 * ```
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): RateLimitResult {
  // Ensure cleanup is running
  startCleanup();

  const { maxRequests, windowSeconds, keyPrefix = '' } = config;
  const ip = getClientIP(request);
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // Get or create entry
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // Create new window
    entry = {
      count: 1,
      resetAt: now + windowMs
    };
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: entry.resetAt,
      current: 1
    };
  }

  // Increment count
  entry.count++;

  const allowed = entry.count <= maxRequests;

  if (!allowed) {
    logger.warn('Rate limit exceeded', {
      ip,
      keyPrefix,
      count: entry.count,
      maxRequests
    });
  }

  return {
    allowed,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
    current: entry.count
  };
}

/**
 * Create rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.current.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString()
  };
}
