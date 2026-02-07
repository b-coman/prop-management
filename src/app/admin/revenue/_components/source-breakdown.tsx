'use client';

import type { SourceBreakdown as SourceBreakdownType } from '../_actions';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface SourceBreakdownProps {
  data: SourceBreakdownType[];
  currency: string;
}

export function SourceBreakdown({ data, currency }: SourceBreakdownProps) {
  if (data.length === 0) return null;

  const maxRevenue = Math.max(...data.map(d => d.revenue));

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm font-medium">{d.source}</span>
            <span className="text-sm tabular-nums">
              {formatCurrency(d.revenue, currency)}
              <span className="text-muted-foreground ml-1 text-xs">{d.percentage}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {d.bookings} booking{d.bookings !== 1 ? 's' : ''} · {d.nights} nights
          </p>
        </div>
      ))}
    </div>
  );
}
