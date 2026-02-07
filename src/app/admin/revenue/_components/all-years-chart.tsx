'use client';

import { useState, useCallback } from 'react';
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

// Distinct colors — easy to tell apart at a glance
const YEAR_COLORS = [
  'hsl(220, 15%, 65%)',  // muted gray-blue (oldest)
  'hsl(170, 55%, 42%)',  // teal
  'hsl(215, 65%, 50%)',  // blue
  'hsl(265, 55%, 52%)',  // purple
  'hsl(25, 85%, 52%)',   // orange (newest / current year)
  'hsl(350, 65%, 50%)',  // red (future-proof)
];

interface AllYearsChartProps {
  monthlyGrid: AllYearsMonthRow[];
  years: number[];
  currency: string;
}

export function AllYearsChart({ monthlyGrid, years, currency }: AllYearsChartProps) {
  const [hiddenYears, setHiddenYears] = useState<Set<number>>(new Set());

  const toggleYear = useCallback((year: number) => {
    setHiddenYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }, []);

  const currentCalendarYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed

  // Build chart data, replacing future months of current year with undefined
  const chartData = monthlyGrid.map((row, monthIndex) => {
    const point: Record<string, string | number | undefined> = { month: row.monthLabel };
    for (const y of years) {
      const rev = row.years[y]?.revenue ?? 0;
      // For the current year: don't plot months beyond current month that have no data
      if (y === currentCalendarYear && monthIndex > currentMonth && rev === 0) {
        point[`y${y}`] = undefined;
      } else {
        point[`y${y}`] = rev;
      }
    }
    return point;
  });

  // Build chart config with distinct colors
  const chartConfig: ChartConfig = {};
  years.forEach((y, i) => {
    chartConfig[`y${y}`] = {
      label: `${y}`,
      color: YEAR_COLORS[Math.min(i, YEAR_COLORS.length - 1)],
    };
  });

  const visibleYears = years.filter(y => !hiddenYears.has(y));

  return (
    <div>
      {/* Legend — clickable to toggle years */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {years.map((y, i) => {
          const color = YEAR_COLORS[Math.min(i, YEAR_COLORS.length - 1)];
          const isHidden = hiddenYears.has(y);
          const isNewest = i === years.length - 1;
          return (
            <button
              key={y}
              onClick={() => toggleYear(y)}
              className={`flex items-center gap-1.5 text-sm transition-opacity ${
                isHidden ? 'opacity-30' : 'opacity-100'
              } hover:opacity-80`}
            >
              <span
                className="h-3 w-3 rounded-sm shrink-0"
                style={{
                  backgroundColor: color,
                  border: isHidden ? '1px dashed currentColor' : 'none',
                }}
              />
              <span className={isNewest && !isHidden ? 'font-semibold' : 'font-medium'}>
                {y}
              </span>
            </button>
          );
        })}
      </div>

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
              // Only show years that have data for this month
              const withData = [...payload]
                .reverse()
                .filter(entry => entry.value !== undefined && Number(entry.value) > 0);
              if (withData.length === 0) return null;
              return (
                <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-xl">
                  <p className="font-medium mb-1.5">{label}</p>
                  <div className="space-y-1">
                    {withData.map((entry, i) => {
                      const yearNum = (entry.dataKey as string).replace('y', '');
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
          {years.map((y, i) => {
            const isNewest = i === years.length - 1;
            const isHidden = hiddenYears.has(y);
            return (
              <Line
                key={y}
                type="linear"
                dataKey={`y${y}`}
                stroke={`var(--color-y${y})`}
                strokeWidth={isNewest ? 2.5 : 1.5}
                dot={false}
                connectNulls={false}
                strokeOpacity={isHidden ? 0 : (isNewest ? 1 : 0.75)}
                hide={isHidden}
              />
            );
          })}
        </LineChart>
      </ChartContainer>
    </div>
  );
}
