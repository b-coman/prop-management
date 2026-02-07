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
import type { ChartDataPoint } from '../_actions';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface RevenueChartProps {
  data: ChartDataPoint[];
  selectedYear: number;
  currency: string;
}

export function RevenueChart({ data, selectedYear, currency }: RevenueChartProps) {
  const chartConfig = {
    revenue: {
      label: `${selectedYear}`,
      color: 'hsl(var(--primary))',
    },
    prevRevenue: {
      label: `${selectedYear - 1}`,
      color: 'hsl(var(--muted-foreground))',
    },
  } satisfies ChartConfig;

  const hasAnyPrevData = data.some(d => d.prevRevenue > 0);

  // For current year: don't draw bars for future months with no data
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const isCurrentYear = selectedYear === now.getFullYear();

  const chartData = data.map((d, i) => {
    if (isCurrentYear && i > currentMonth && d.revenue === 0) {
      return { ...d, revenue: undefined as unknown as number };
    }
    return d;
  });

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={chartData} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`}
        />
        <ChartTooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const current = payload.find(p => p.dataKey === 'revenue');
            const prev = payload.find(p => p.dataKey === 'prevRevenue');
            const nights = current?.payload?.nights ?? 0;
            const adr = current?.payload?.adr ?? 0;

            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-xl">
                <p className="font-medium mb-1.5">{label}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                      {selectedYear}
                    </span>
                    <span className="font-mono font-medium">
                      {formatCurrency(Number(current?.value ?? 0), currency)}
                    </span>
                  </div>
                  {hasAnyPrevData && (
                    <div className="flex items-center justify-between gap-4 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm opacity-40" style={{ backgroundColor: 'hsl(var(--muted-foreground))' }} />
                        {selectedYear - 1}
                      </span>
                      <span className="font-mono font-medium">
                        {formatCurrency(Number(prev?.value ?? 0), currency)}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-1 mt-1 text-muted-foreground flex justify-between gap-4">
                    <span>{nights} nights</span>
                    <span>ADR: {formatCurrency(adr, currency)}</span>
                  </div>
                </div>
              </div>
            );
          }}
        />
        {hasAnyPrevData && (
          <Bar
            dataKey="prevRevenue"
            fill="var(--color-prevRevenue)"
            radius={[4, 4, 0, 0]}
            opacity={0.3}
          />
        )}
        <Bar
          dataKey="revenue"
          fill="var(--color-revenue)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
