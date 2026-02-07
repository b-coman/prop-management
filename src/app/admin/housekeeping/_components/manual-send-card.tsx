'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarCheck, CalendarDays, Loader2 } from 'lucide-react';
import { triggerManualMonthlySchedule, triggerManualDailyNotification } from '../actions';

interface ManualSendCardProps {
  propertyId: string;
  contactCount: number;
}

export function ManualSendCard({ propertyId, contactCount }: ManualSendCardProps) {
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; message: string } | null>(null);
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleMonthly = () => {
    setAction('monthly');
    setResult(null);
    startTransition(async () => {
      const res = await triggerManualMonthlySchedule(propertyId);
      if (res.error) {
        setResult({ type: 'error', message: res.error });
      } else {
        setResult({
          type: 'success',
          message: `Monthly schedule sent to ${res.sent} contact(s)${res.failed > 0 ? `, ${res.failed} failed` : ''}`,
        });
      }
      setAction(null);
    });
  };

  const handleDaily = () => {
    setAction('daily');
    setResult(null);
    startTransition(async () => {
      const res = await triggerManualDailyNotification(propertyId, dailyDate);
      if (res.error) {
        setResult({ type: 'error', message: res.error });
      } else if (res.skipped) {
        setResult({ type: 'info', message: 'No check-ins or check-outs on this date.' });
      } else {
        setResult({
          type: 'success',
          message: `Daily notification sent to ${res.sent} contact(s)${res.failed > 0 ? `, ${res.failed} failed` : ''}`,
        });
      }
      setAction(null);
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Monthly Schedule
          </CardTitle>
          <CardDescription>
            Send this month&apos;s booking schedule to all contacts with monthly notifications enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleMonthly}
            disabled={isPending || contactCount === 0}
            className="w-full"
          >
            {isPending && action === 'monthly' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send Monthly Schedule
          </Button>
          {contactCount === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              No enabled contacts. Add a contact first.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Daily Notification
          </CardTitle>
          <CardDescription>
            Send check-in/check-out alerts for a specific date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="dailyDate">Date</Label>
            <Input
              id="dailyDate"
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
            />
          </div>
          <Button
            onClick={handleDaily}
            disabled={isPending || contactCount === 0}
            className="w-full"
          >
            {isPending && action === 'daily' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send Daily Notification
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="md:col-span-2">
          <p className={`text-sm ${
            result.type === 'error' ? 'text-red-600' :
            result.type === 'info' ? 'text-amber-600' :
            'text-green-600'
          }`}>
            {result.message}
          </p>
        </div>
      )}
    </div>
  );
}
