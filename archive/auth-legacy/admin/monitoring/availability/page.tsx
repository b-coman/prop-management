/**
 * Availability System Monitoring Dashboard
 * 
 * Provides real-time visibility into the health of the availability deduplication system
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Database, GitBranch, XCircle } from 'lucide-react';
import { MonitoringClient } from './monitoring-client';

export const dynamic = 'force-dynamic';

export default async function AvailabilityMonitoringPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Availability System Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Real-time health metrics for the availability deduplication system
          </p>
        </div>
      </div>

      {/* Feature Flag Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Feature Flag Configuration
          </CardTitle>
          <CardDescription>
            Current mode and rollback status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonitoringClient />
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Monitoring Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 space-y-2">
          <p>• <strong>Healthy</strong>: All systems operational, no discrepancies</p>
          <p>• <strong>Warning</strong>: Discrepancies detected or expired holds found</p>
          <p>• <strong>Critical</strong>: Collection access issues or system failures</p>
          <p className="mt-4">
            The system auto-refreshes every 30 seconds. Click "Check Now" for immediate update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}