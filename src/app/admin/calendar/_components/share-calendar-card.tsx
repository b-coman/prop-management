'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, RefreshCw, Smartphone } from 'lucide-react';
import { generateShareCalendarToken } from '../actions';
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

interface ShareCalendarCardProps {
  propertyId: string;
  shareToken?: string;
}

export function ShareCalendarCard({ propertyId, shareToken }: ShareCalendarCardProps) {
  const [token, setToken] = useState(shareToken);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const shareUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/calendar/${token}`
    : null;

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateShareCalendarToken(propertyId);
      if (result.token) setToken(result.token);
    });
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Public Share Link
        </CardTitle>
        <CardDescription>
          A read-only mobile-friendly calendar view. Share with housekeeping, co-hosts, or anyone
          who needs visibility without admin access. Shows guest names, dates, and notes — hides
          payment, contact info, and source.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {token ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Share URL</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded-md text-xs break-all">
                  {shareUrl}
                </code>
                <Button variant="outline" size="icon" onClick={handleCopy} title="Copy URL">
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
                  <AlertDialogTitle>Regenerate share token?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will invalidate the current share URL. You will need to re-distribute the
                    new URL to anyone who currently has it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGenerate}>Regenerate</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Generate a token to create your share URL.
            </p>
            <Button onClick={handleGenerate} disabled={isPending}>
              {isPending ? 'Generating...' : 'Generate Share Link'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
