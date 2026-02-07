'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function HousekeepingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[housekeeping error boundary]', error);
  }, [error]);

  return (
    <Card className="border-destructive">
      <CardContent className="pt-6 space-y-4">
        <h2 className="text-lg font-semibold text-destructive">Housekeeping Error</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Message:</strong> {error.message}</p>
          {error.digest && <p><strong>Digest:</strong> {error.digest}</p>}
          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
            {error.stack || 'No stack trace available'}
          </pre>
        </div>
        <Button onClick={reset} variant="outline" size="sm">
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}
