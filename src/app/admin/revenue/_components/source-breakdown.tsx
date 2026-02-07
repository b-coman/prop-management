'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import type { SourceBreakdown as SourceBreakdownType } from '../_actions';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

interface SourceBreakdownProps {
  data: SourceBreakdownType[];
  currency: string;
}

export function SourceBreakdown({ data, currency }: SourceBreakdownProps) {
  if (data.length === 0) return null;

  const chartData = data.map(d => ({
    name: d.source,
    revenue: d.revenue,
    bookings: d.bookings,
    percentage: d.percentage,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart */}
      <ChartContainer config={chartConfig} className="h-[200px] w-full">
        <BarChart data={chartData} layout="vertical" barSize={20}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-xl">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground">
                    {formatCurrency(item.revenue, currency)} ({item.percentage}%)
                  </p>
                  <p className="text-muted-foreground">{item.bookings} bookings</p>
                </div>
              );
            }}
          />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>

      {/* Summary list */}
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">{d.source}</span>
              <span className="text-xs text-muted-foreground">{d.bookings} bookings</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-medium tabular-nums">
                {formatCurrency(d.revenue, currency)}
              </span>
              <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
                {d.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
