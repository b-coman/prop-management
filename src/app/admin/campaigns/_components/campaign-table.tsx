'use client';

import { useTransition } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, Check } from 'lucide-react';
import type { Campaign } from '@/types';
import { approveCampaignAction, runCampaignAction } from '../actions';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  scheduled: 'secondary',
  sending: 'secondary',
  sent: 'default',
  failed: 'destructive',
  cancelled: 'outline',
};

export function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Template</TableHead>
          <TableHead className="text-right">Reached</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((c) => (
          <CampaignRow key={c.id} campaign={c} />
        ))}
      </TableBody>
    </Table>
  );
}

function CampaignRow({ campaign: c }: { campaign: Campaign }) {
  const { toast } = useToast();
  const [approving, startApprove] = useTransition();
  const [running, startRun] = useTransition();

  const approve = () =>
    startApprove(async () => {
      const res = await approveCampaignAction(c.id);
      toast(res.success ? { title: 'Approved' } : { title: 'Failed', description: res.error, variant: 'destructive' });
    });

  const run = () =>
    startRun(async () => {
      const res = await runCampaignAction(c.id);
      if (res.success && res.stats) {
        const s = res.stats;
        toast({
          title: `Run complete (${res.mode})`,
          description: `${s.audienceSize} in audience · ${s.dryRun} dry-run · ${s.sent} sent · ${s.suppressed} suppressed · ${s.skipped} skipped`,
        });
      } else {
        toast({ title: 'Run failed', description: res.error, variant: 'destructive' });
      }
    });

  const stats = c.stats;
  const reached = stats && stats.attempted > 0 ? `${stats.dryRun + stats.sent}/${stats.audienceSize}` : '—';

  return (
    <TableRow>
      <TableCell className="font-medium">{c.name}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[c.status] || 'outline'}>{c.status}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{c.templateName}</TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">{reached}</TableCell>
      <TableCell className="space-x-2 whitespace-nowrap text-right">
        {!c.approvedBy && (
          <Button size="sm" variant="outline" onClick={approve} disabled={approving}>
            {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            <span className="ml-1">Approve</span>
          </Button>
        )}
        <Button size="sm" onClick={run} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          <span className="ml-1">Run (dry-run)</span>
        </Button>
      </TableCell>
    </TableRow>
  );
}
