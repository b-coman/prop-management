# Pricing Cache Persistence Fix

> **Historical Note (Feb 2026)**: This document describes a fix implemented in May 2025. The `/api/check-pricing-availability` endpoint mentioned here was later removed as it only returned mock data. The current system uses `/api/check-pricing` exclusively with proper localStorage caching.

## Problem

The pricing availability API was experiencing infinite API calls in production, causing increased load and 500 errors. The issue occurred because:

1. The availability component was making excessive API calls
2. Cloud Run instances don't share memory, so in-memory caching was ineffective
3. Rate limiting was implemented but only worked within a single instance
4. When a user was routed to a different instance, the cache and rate limiting state was lost

## Symptoms

1. Browser console showing repeated API calls to `/api/check-pricing-availability` 
2. Cloud Run logs showing the same endpoint called multiple times in quick succession
3. Rate limiting working in local development but not in production
4. API calls restarting every minute even after fixes were deployed

## Root Causes

1. **Ephemeral Cloud Run Instances**: Each instance has its own memory space, so in-memory caching doesn't persist
2. **Session Persistence**: Users can be routed to different instances on page refresh or new visits
3. **Instance Scaling**: As traffic increases, new instances are created without the cached data
4. **Missing Client-Side Persistence**: No persistent storage was used for caching or rate limiting

## Solution Implemented

We've implemented a localStorage-based caching and rate limiting system:

1. **Persistent Storage**: All caching and rate limiting data is now stored in localStorage
2. **Helper Functions**: Created getFromStorage/saveToStorage abstractions for consistent storage access
3. **Memory + Persistence**: Used a hybrid approach with in-memory caching for performance plus localStorage for persistence
4. **Cache Reset API**: Added a new API endpoint to allow resetting the cache when needed
5. **Improved Error Handling**: Added better error caching to prevent frequent retries
6. **Cache Time Extension**: Extended cache time from 1 minute to 10 minutes for frequently used data

## Implementation Details

### Service Layer Cache

The cache works at multiple levels:

1. **API Response Cache**: Full API responses are cached with proper expiration times
2. **Rate Limiting State**: Call counts, timestamps, and error counts are tracked per property
3. **Pricing Data Cache**: Raw pricing data is stored for reuse across pages
4. **Error Response Cache**: Even error responses are cached to prevent immediate retries

### Key Cache Settings

- **Maximum API calls per minute**: 3
- **Maximum API calls per session**: 20
- **Maximum API errors before blocking**: 3
- **Cache expiration time**: 10 minutes (successful responses)
- **Error cache expiration**: 30 seconds
- **Rate limit reset time**: 60 seconds

## Verification

After implementing these changes:

1. The browser should respect the cache and not make redundant API calls
2. Rate limiting will work correctly even across page refreshes
3. Error handling will prevent infinite retry loops
4. The API call limits apply even if the user is routed to different Cloud Run instances

## Prevention Measures

To prevent similar issues in the future:

1. **Use localStorage for client-side caching** whenever you need to persist data across page refreshes or Cloud Run instances
2. **Implement proper fallback responses** to ensure the UI doesn't break when API calls fail
3. **Add cache debugging tools** to help troubleshoot issues (note: `/api/reset-price-cache` was removed in Feb 2026 as it was never fully implemented)
4. **Add logging** to track API call patterns and cache hits/misses

## Future Improvements

Consider these additional improvements:

1. **Service Worker Cache**: For even more robust caching, implement a service worker
2. **IndexedDB Storage**: For larger data sets that might exceed localStorage limits
3. **Server-Side Caching**: Implement Redis or Firestore for server-side rate limiting