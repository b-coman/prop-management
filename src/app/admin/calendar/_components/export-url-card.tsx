'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Copy, Check, RefreshCw, Link as LinkIcon } from 'lucide-react';
import { generateExportToken, toggleExportEnabled } from '../actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ExportUrlCardProps {
  propertyId: string;
  exportToken?: string;
  exportEnabled?: boolean;
}

export function ExportUrlCard({ propertyId, exportToken, exportEnabled }: ExportUrlCardProps) {
  const [token, setToken] = useState(exportToken);
  const [enabled, setEnabled] = useState(exportEnabled ?? false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const exportUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/ical/${propertyId}/calendar.ics?token=${token}`
    : null;

  const handleGenerateToken = () => {
    startTransition(async () => {
      const result = await generateExportToken(propertyId);
      if (result.token) {
        setToken(result.token);
        setEnabled(true);
      }
    });
  };

  const handleToggleEnabled = (checked: boolean) => {
    setEnabled(checked);
    startTransition(async () => {
      const result = await toggleExportEnabled(propertyId, checked);
      if (result.error) {
        setEnabled(!checked); // Revert on error
      }
    });
  };

  const handleCopy = async () => {
    if (!exportUrl) return;
    await navigator.clipboard.writeText(exportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          iCal Export
        </CardTitle>
        <CardDescription>
          Share this URL with Booking.com, Airbnb, or any platform that supports iCal import.
          They will periodically fetch your blocked dates from this feed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {token ? (
          <>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Export enabled</label>
              <Switch
                checked={enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Export URL</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded-md text-xs break-all">
                  {exportUrl}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title="Copy URL"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isPending}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Token
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Regenerate export token?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will invalidate the current export URL. You will need to update the URL
                    in all external platforms (Booking.com, Airbnb, etc.) that currently use it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGenerateToken}>
                    Regenerate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Generate a token to create your iCal export URL.
            </p>
            <Button onClick={handleGenerateToken} disabled={isPending}>
              {isPending ? 'Generating...' : 'Generate Export URL'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
