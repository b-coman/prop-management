/**
 * Monitoring endpoint for availability system health
 * 
 * This endpoint provides metrics and health checks for the availability system
 * which now uses the availability collection as the single source of truth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { format, addDays } from 'date-fns';
import { loggers } from '@/lib/logger';

const logger = loggers.availability;

interface HealthMetrics {
  timestamp: string;
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    availabilityCollectionAccessible: boolean;
    holdCleanupRunning: boolean;
  };
  performanceMetrics: {
    lastCheckDuration?: number;
    averageResponseTime?: number;
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK not available' },
        { status: 500 }
      );
    }

    // Initialize metrics
    const metrics: HealthMetrics = {
      timestamp: new Date().toISOString(),
      systemHealth: {
        status: 'healthy',
        availabilityCollectionAccessible: false,
        holdCleanupRunning: false
      },
      performanceMetrics: {}
    };

    // Test availability collection access
    try {
      const testDoc = await db.collection('availability').limit(1).get();
      metrics.systemHealth.availabilityCollectionAccessible = true;
    } catch (error) {
      logger.error('Availability collection not accessible', error as Error);
      metrics.systemHealth.status = 'critical';
    }

    // Check for recent expired holds (indicator of hold cleanup health)
    try {
      const now = new Date();
      const expiredHoldsQuery = db.collection('bookings')
        .where('status', '==', 'on-hold')
        .where('holdUntil', '<=', now)
        .limit(5);
      
      const expiredHolds = await expiredHoldsQuery.get();
      
      if (expiredHolds.empty) {
        metrics.systemHealth.holdCleanupRunning = true;
      } else {
        metrics.systemHealth.status = 'warning';
        logger.warn('Found expired holds not cleaned up', { count: expiredHolds.size });
      }
    } catch (error) {
      logger.error('Error checking expired holds', error as Error);
    }

    // Calculate performance metrics
    const endTime = Date.now();
    metrics.performanceMetrics.lastCheckDuration = endTime - startTime;

    logger.debug('Health check completed', {
      status: metrics.systemHealth.status,
      duration: metrics.performanceMetrics.lastCheckDuration
    });

    return NextResponse.json(metrics);

  } catch (error) {
    logger.error('Error in availability monitoring', error as Error);
    return NextResponse.json(
      { 
        error: 'Monitoring check failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Health check endpoint for simpler monitoring
export async function POST(request: NextRequest) {
  try {
    const db = await getFirestoreForPricing();
    if (!db) {
      return NextResponse.json({ healthy: false }, { status: 503 });
    }
    
    // Quick health check
    await db.collection('availability').limit(1).get();
    
    return NextResponse.json({ healthy: true });
  } catch (error) {
    return NextResponse.json({ healthy: false }, { status: 503 });
  }
}