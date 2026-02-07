'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import type { AllYearsMonthRow } from '../_actions';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Color palette: progressively darker/more saturated for newer years
const YEAR_COLORS = [
  'hsl(215, 40%, 75%)',  // lightest — oldest year
  'hsl(215, 50%, 60%)',
  'hsl(215, 60%, 48%)',
  'hsl(215, 70%, 38%)',  // darkest — newest year
  'hsl(215, 80%, 30%)',
];

interface AllYearsChartProps {
  monthlyGrid: AllYearsMonthRow[];
  years: number[];
  currency: string;
}

export function AllYearsChart({ monthlyGrid, years, currency }: AllYearsChartProps) {
  const chartData = monthlyGrid.map(row => {
    const point: Record<string, string | number> = { month: row.monthLabel };
    for (const y of years) {
      point[`y${y}`] = row.years[y]?.revenue ?? 0;
    }
    return point;
  });

  const chartConfig: ChartConfig = {};
  years.forEach((y, i) => {
    chartConfig[`y${y}`] = {
      label: `${y}`,
      color: YEAR_COLORS[Math.min(i, YEAR_COLORS.length - 1)],
    };
  });

  return (
    <ChartContainer config={chartConfig} className="h-[350px] w-full">
      <LineChart data={chartData}>
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
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-xl">
                <p className="font-medium mb-1.5">{label}</p>
                <div className="space-y-1">
                  {[...payload].reverse().map((entry, i) => {
                    const yearKey = entry.dataKey as string;
                    const yearNum = yearKey.replace('y', '');
                    return (
                      <div key={i} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: entry.color }}
                          />
                          {yearNum}
                        </span>
                        <span className="font-mono font-medium">
                          {formatCurrency(Number(entry.value ?? 0), currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }}
        />
        {years.map((y, i) => (
          <Line
            key={y}
            type="monotone"
            dataKey={`y${y}`}
            stroke={`var(--color-y${y})`}
            strokeWidth={i === years.length - 1 ? 2.5 : 1.5}
            dot={false}
            strokeOpacity={i === years.length - 1 ? 1 : 0.6}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
