'use client';

import { useState, useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw } from 'lucide-react';
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
import { toggleFeedEnabled, deleteICalFeed, triggerManualSync } from '../actions';
import type { ICalFeed } from '@/types';

interface ICalFeedsTableProps {
  feeds: ICalFeed[];
}

function StatusBadge({ status }: { status?: string }) {
  switch (status) {
    case 'success':
      return <Badge variant="default" className="bg-green-600">Synced</Badge>;
    case 'error':
      return <Badge variant="destructive">Error</Badge>;
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    default:
      return <Badge variant="outline">Never synced</Badge>;
  }
}

function formatSyncTime(syncAt?: string | null): string {
  if (!syncAt) return 'Never';
  try {
    const date = new Date(syncAt);
    return date.toLocaleString();
  } catch {
    return 'Unknown';
  }
}

function truncateUrl(url: string, maxLen = 50): string {
  if (url.length <= maxLen) return url;
  return url.substring(0, maxLen) + '...';
}

export function ICalFeedsTable({ feeds }: ICalFeedsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingFeedId, setPendingFeedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleToggle = (feedId: string, enabled: boolean) => {
    setPendingFeedId(feedId);
    setPendingAction('toggle');
    startTransition(async () => {
      await toggleFeedEnabled(feedId, enabled);
      setPendingFeedId(null);
      setPendingAction(null);
    });
  };

  const handleDelete = (feedId: string) => {
    setPendingFeedId(feedId);
    setPendingAction('delete');
    startTransition(async () => {
      await deleteICalFeed(feedId);
      setPendingFeedId(null);
      setPendingAction(null);
    });
  };

  const handleSync = (feedId: string) => {
    setPendingFeedId(feedId);
    setPendingAction('sync');
    setSyncMessage(null);
    startTransition(async () => {
      const result = await triggerManualSync(feedId);
      setPendingFeedId(null);
      setPendingAction(null);
      if (result.error) {
        setSyncMessage(`Error: ${result.error}`);
      } else {
        setSyncMessage(`Synced: ${result.eventsFound} events found, ${result.datesBlocked} dates blocked, ${result.datesReleased} released`);
      }
      setTimeout(() => setSyncMessage(null), 8000);
    });
  };

  if (feeds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No external calendar feeds configured.</p>
        <p className="text-sm mt-1">Add a feed to start syncing availability from external platforms.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
    {syncMessage && (
      <div className={`text-sm px-3 py-2 rounded-md ${syncMessage.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
        {syncMessage}
      </div>
    )}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>URL</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Sync</TableHead>
          <TableHead>Events</TableHead>
          <TableHead className="w-[120px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {feeds.map((feed) => (
          <TableRow key={feed.id}>
            <TableCell className="font-medium">{feed.name}</TableCell>
            <TableCell>
              <span className="text-xs text-muted-foreground" title={feed.url}>
                {truncateUrl(feed.url)}
              </span>
            </TableCell>
            <TableCell>
              <Switch
                checked={feed.enabled}
                onCheckedChange={(checked) => handleToggle(feed.id, checked)}
                disabled={isPending && pendingFeedId === feed.id}
              />
            </TableCell>
            <TableCell>
              <StatusBadge status={feed.lastSyncStatus} />
              {feed.lastSyncError && (
                <p className="text-xs text-destructive mt-1" title={feed.lastSyncError}>
                  {truncateUrl(feed.lastSyncError, 30)}
                </p>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatSyncTime(feed.lastSyncAt)}
            </TableCell>
            <TableCell className="text-sm">
              {feed.lastSyncEventsCount ?? '-'}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Sync now"
                  onClick={() => handleSync(feed.id)}
                  disabled={isPending && pendingFeedId === feed.id}
                >
                  <RefreshCw className={`h-4 w-4 ${isPending && pendingFeedId === feed.id && pendingAction === 'sync' ? 'animate-spin' : ''}`} />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete feed"
                      disabled={isPending && pendingFeedId === feed.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete feed &quot;{feed.name}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the feed and release all dates that were blocked by it
                        (unless they are also blocked by your own bookings).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(feed.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
