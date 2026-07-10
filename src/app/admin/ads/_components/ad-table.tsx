'use client';

import Link from 'next/link';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { AdCampaign } from '@/types';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  pending_approval: 'secondary',
  approved: 'secondary',
  active: 'default',
  paused: 'outline',
  failed: 'destructive',
};

/** Meta `effective_status` values that mean "this will not deliver" — flagged in a second, louder badge regardless of our own `status` field (OD4: on-demand drift detection). */
const PROBLEM_EFFECTIVE_STATUSES = new Set(['DISAPPROVED', 'REJECTED', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED']);

function formatMinor(minor: number | undefined): string {
  if (minor === undefined || minor === null) return '—';
  return `${(minor / 100).toFixed(2)} RON`;
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '—';
  }
}

export function AdTable({ campaigns }: { campaigns: AdCampaign[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ad</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Daily budget</TableHead>
          <TableHead className="text-right">Spend cap</TableHead>
          <TableHead className="text-right">ROAS</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((c) => (
          <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
            <TableCell className="font-medium">
              <Link href={`/admin/ads/${c.id}`} className="hover:underline">
                {c.id.slice(0, 10)}…
              </Link>
            </TableCell>
            <TableCell className="space-x-1.5">
              <Badge variant={STATUS_VARIANT[c.status] || 'outline'}>{c.status}</Badge>
              {c.effectiveStatus && PROBLEM_EFFECTIVE_STATUSES.has(c.effectiveStatus) && (
                <Badge variant="destructive">{c.effectiveStatus}</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">{formatMinor(c.dailyBudgetMinor)}</TableCell>
            <TableCell className="text-right">{formatMinor(c.spendCapMinor)}</TableCell>
            <TableCell className="text-right">{c.insights?.roas ? c.insights.roas.toFixed(2) : '—'}</TableCell>
            <TableCell className="text-muted-foreground text-sm">{formatDate(c.createdAt as string | undefined)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
