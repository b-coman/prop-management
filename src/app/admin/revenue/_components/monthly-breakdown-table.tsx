'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { MonthlyData } from '../_actions';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface MonthlyBreakdownTableProps {
  data: MonthlyData[];
  currency: string;
  selectedYear: number;
}

export function MonthlyBreakdownTable({ data, currency, selectedYear }: MonthlyBreakdownTableProps) {
  const now = new Date();
  const currentCalendarYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isCurrentYear = selectedYear === currentCalendarYear;

  // Filter to months that have data or are in the past
  const relevantMonths = data.filter(m => {
    if (!isCurrentYear) return m.revenue > 0 || m.prevYearRevenue > 0;
    return m.month <= currentMonth || m.revenue > 0;
  });

  if (relevantMonths.length === 0) return null;

  // Totals
  const totalRevenue = relevantMonths.reduce((s, m) => s + m.revenue, 0);
  const totalNights = relevantMonths.reduce((s, m) => s + m.nights, 0);
  const totalAccomRevenue = relevantMonths.reduce((s, m) => s + m.accommodationRevenue, 0);
  const avgAdr = totalNights > 0 ? Math.round(totalAccomRevenue / totalNights) : 0;
  const avgOccupancy = relevantMonths.length > 0
    ? Math.round(relevantMonths.reduce((s, m) => s + m.occupancy, 0) / relevantMonths.length)
    : 0;
  const totalPrevRevenue = relevantMonths.reduce((s, m) => s + m.prevYearRevenue, 0);
  const totalChangePercent = totalPrevRevenue > 0
    ? Math.round(((totalRevenue - totalPrevRevenue) / totalPrevRevenue) * 100)
    : null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Nights</TableHead>
          <TableHead className="text-right">ADR</TableHead>
          <TableHead className="text-right">Occupancy</TableHead>
          <TableHead className="text-right">vs {selectedYear - 1}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {relevantMonths.map(m => {
          const isFuture = isCurrentYear && m.month > currentMonth;
          return (
            <TableRow key={m.month} className={isFuture ? 'opacity-60' : undefined}>
              <TableCell className="font-medium">{m.monthLabel}</TableCell>
              <TableCell className="text-right tabular-nums">
                {m.revenue > 0 ? formatCurrency(m.revenue, currency) : '-'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {m.nights > 0 ? m.nights : '-'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {m.adr > 0 ? formatCurrency(m.adr, currency) : '-'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {m.occupancy > 0 ? `${m.occupancy}%` : '-'}
              </TableCell>
              <TableCell className="text-right">
                <ChangeIndicator percent={m.revenueChangePercent} />
              </TableCell>
            </TableRow>
          );
        })}

        {/* Totals row */}
        <TableRow className="border-t-2 font-bold">
          <TableCell>Total</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatCurrency(totalRevenue, currency)}
          </TableCell>
          <TableCell className="text-right tabular-nums">{totalNights}</TableCell>
          <TableCell className="text-right tabular-nums">
            {avgAdr > 0 ? formatCurrency(avgAdr, currency) : '-'}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {avgOccupancy > 0 ? `${avgOccupancy}%` : '-'}
          </TableCell>
          <TableCell className="text-right">
            <ChangeIndicator percent={totalChangePercent} />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function ChangeIndicator({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-muted-foreground text-xs">-</span>;

  const isUp = percent >= 0;
  return (
    <Badge
      variant="outline"
      className={`text-xs tabular-nums ${
        isUp
          ? 'text-green-700 border-green-200 dark:text-green-400 dark:border-green-800'
          : 'text-red-700 border-red-200 dark:text-red-400 dark:border-red-800'
      }`}
    >
      {isUp ? '+' : ''}{percent}%
    </Badge>
  );
}
