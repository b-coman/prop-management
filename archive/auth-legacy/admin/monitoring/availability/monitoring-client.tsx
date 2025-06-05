'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';

interface HealthMetrics {
  timestamp: string;
  featureFlags: {
    mode: string;
    singleSource: boolean;
    dualCheck: boolean;
    legacyFallback: boolean;
  };
  recentDiscrepancies: {
    count: number;
    samples: any[];
  };
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    availabilityCollectionAccessible: boolean;
    priceCalendarsAccessible: boolean;
    holdCleanupRunning: boolean;
  };
  performanceMetrics: {
    lastCheckDuration?: number;
  };
}

export function MonitoringClient() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/monitoring/availability');
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring data');
      }
      
      const data = await response.json();
      setMetrics(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'legacy':
        return 'default';
      case 'dual_check':
        return 'secondary';
      case 'single_source':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading && !metrics) {
    return <div className="text-center py-4">Loading monitoring data...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchMetrics}
            className="ml-4"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Current Mode */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Current Mode</p>
          <div className="flex items-center gap-2">
            <Badge variant={getModeColor(metrics.featureFlags.mode)} className="uppercase">
              {metrics.featureFlags.mode}
            </Badge>
            {metrics.featureFlags.legacyFallback && (
              <Badge variant="outline">Fallback Enabled</Badge>
            )}
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={fetchMetrics}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Now
            </>
          )}
        </Button>
      </div>

      {/* System Health */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Overall Health</p>
                <div className="flex items-center gap-2">
                  {getStatusIcon(metrics.systemHealth.status)}
                  <span className="font-semibold capitalize">
                    {metrics.systemHealth.status}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Collection Status</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {metrics.systemHealth.availabilityCollectionAccessible ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span>Availability Collection</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {metrics.systemHealth.priceCalendarsAccessible ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span>Price Calendars</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Hold Cleanup</p>
              <div className="flex items-center gap-2">
                {metrics.systemHealth.holdCleanupRunning ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Running</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm">Expired holds found</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discrepancies (if in DUAL_CHECK mode) */}
      {metrics.featureFlags.dualCheck && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Recent Discrepancies</h3>
                <Badge variant={metrics.recentDiscrepancies.count > 0 ? "destructive" : "success"}>
                  {metrics.recentDiscrepancies.count} found
                </Badge>
              </div>
              
              {metrics.recentDiscrepancies.samples.length > 0 && (
                <div className="space-y-2">
                  {metrics.recentDiscrepancies.samples.map((sample, idx) => (
                    <Alert key={idx} variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{sample.date}</strong> - {sample.propertyId}:
                        Availability shows {sample.availabilityStatus ? 'available' : 'unavailable'},
                        Price Calendar shows {sample.priceCalendarStatus ? 'available' : 'unavailable'}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance */}
      <div className="text-sm text-muted-foreground">
        Last check took {metrics.performanceMetrics.lastCheckDuration}ms • 
        Last updated: {lastUpdate.toLocaleTimeString()}
      </div>
    </div>
  );
}