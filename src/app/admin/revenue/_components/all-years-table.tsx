'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AllYearsMonthRow, AllYearsYearSummary } from '../_actions';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface AllYearsTableProps {
  monthlyGrid: AllYearsMonthRow[];
  yearlySummaries: AllYearsYearSummary[];
  years: number[];
  currency: string;
}

export function AllYearsTable({ monthlyGrid, yearlySummaries, years, currency }: AllYearsTableProps) {
  // Filter to months that have at least some data
  const relevantMonths = monthlyGrid.filter(row =>
    years.some(y => (row.years[y]?.revenue ?? 0) > 0)
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background">Month</TableHead>
            {years.map(y => (
              <TableHead key={y} className="text-right min-w-[100px]">{y}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {relevantMonths.map(row => (
            <TableRow key={row.month}>
              <TableCell className="font-medium sticky left-0 bg-background">
                {row.monthLabel}
              </TableCell>
              {years.map(y => {
                const rev = row.years[y]?.revenue ?? 0;
                return (
                  <TableCell key={y} className="text-right tabular-nums">
                    {rev > 0 ? formatCurrency(rev, currency) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}

          {/* Totals row */}
          <TableRow className="border-t-2 font-bold">
            <TableCell className="sticky left-0 bg-background">Total</TableCell>
            {years.map(y => {
              const summary = yearlySummaries.find(s => s.year === y);
              return (
                <TableCell key={y} className="text-right tabular-nums">
                  {summary && summary.revenue > 0
                    ? formatCurrency(summary.revenue, currency)
                    : <span className="text-muted-foreground">-</span>
                  }
                </TableCell>
              );
            })}
          </TableRow>

          {/* Nights row */}
          <TableRow className="text-muted-foreground text-sm">
            <TableCell className="sticky left-0 bg-background">Nights</TableCell>
            {years.map(y => {
              const summary = yearlySummaries.find(s => s.year === y);
              return (
                <TableCell key={y} className="text-right tabular-nums">
                  {summary && summary.nights > 0 ? summary.nights : '-'}
                </TableCell>
              );
            })}
          </TableRow>

          {/* ADR row */}
          <TableRow className="text-muted-foreground text-sm">
            <TableCell className="sticky left-0 bg-background">ADR</TableCell>
            {years.map(y => {
              const summary = yearlySummaries.find(s => s.year === y);
              return (
                <TableCell key={y} className="text-right tabular-nums">
                  {summary && summary.adr > 0
                    ? formatCurrency(summary.adr, currency)
                    : '-'
                  }
                </TableCell>
              );
            })}
          </TableRow>

          {/* Occupancy row */}
          <TableRow className="text-muted-foreground text-sm">
            <TableCell className="sticky left-0 bg-background">Occupancy</TableCell>
            {years.map(y => {
              const summary = yearlySummaries.find(s => s.year === y);
              return (
                <TableCell key={y} className="text-right tabular-nums">
                  {summary && summary.occupancy > 0 ? `${summary.occupancy}%` : '-'}
                </TableCell>
              );
            })}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
