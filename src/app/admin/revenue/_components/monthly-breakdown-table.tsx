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
import { getDaysInMonth } from 'date-fns';
import type { MonthlyData, YTDComparison } from '../_actions';

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
  propertyCount: number;
  ytdComparison?: YTDComparison | null;
}

export function MonthlyBreakdownTable({ data, currency, selectedYear, propertyCount, ytdComparison }: MonthlyBreakdownTableProps) {
  const now = new Date();
  const currentCalendarYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isCurrentYear = selectedYear === currentCalendarYear;

  // For current year: show all 12 months. For past years: only months with data.
  const relevantMonths = isCurrentYear
    ? data
    : data.filter(m => m.revenue > 0 || m.prevYearRevenue > 0);

  if (relevantMonths.length === 0) return null;

  // Totals
  const totalRevenue = relevantMonths.reduce((s, m) => s + m.revenue, 0);
  const totalNights = relevantMonths.reduce((s, m) => s + m.nights, 0);
  const totalAccomRevenue = relevantMonths.reduce((s, m) => s + m.accommodationRevenue, 0);
  const avgAdr = totalNights > 0 ? Math.round(totalAccomRevenue / totalNights) : 0;
  // Occupancy = total nights / total available days in the year (matching KPI calculation)
  const totalAvailableDays = Array.from({ length: 12 }, (_, i) =>
    getDaysInMonth(new Date(selectedYear, i))
  ).reduce((s, d) => s + d, 0) * (propertyCount || 1);
  const totalOccupancy = totalAvailableDays > 0 ? Math.round((totalNights / totalAvailableDays) * 100) : 0;

  // For current year: total comparison uses same-period (YTD)
  const totalChangePercent = isCurrentYear && ytdComparison
    ? ytdComparison.revenueChangePercent
    : (() => {
        const prev = relevantMonths.reduce((s, m) => s + m.prevYearRevenue, 0);
        return prev > 0 ? Math.round(((totalRevenue - prev) / prev) * 100) : null;
      })();

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
          // Future months without data: don't show -100%, show "-"
          const showComparison = !isFuture || m.revenue > 0;
          return (
            <TableRow key={m.month} className={isFuture ? 'opacity-50' : undefined}>
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
                {showComparison
                  ? <ChangeIndicator percent={m.revenueChangePercent} />
                  : <span className="text-muted-foreground text-xs">-</span>
                }
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
            {totalOccupancy > 0 ? `${totalOccupancy}%` : '-'}
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
