'use client';

import {
  Clock,
  CalendarRange,
  XCircle,
  Sun,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ExtendedMetrics, YearKPIs } from '../_actions';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function SmallMetric({
  label,
  value,
  subtext,
  icon: Icon,
  changePercent,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  changePercent?: number | null;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
            {changePercent !== undefined && changePercent !== null && (
              <span className={`text-xs flex items-center gap-0.5 mt-0.5 ${changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {changePercent >= 0
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />
                }
                {changePercent >= 0 ? '+' : ''}{changePercent}% vs last year
              </span>
            )}
          </div>
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

interface SecondaryMetricsProps {
  metrics: ExtendedMetrics;
  kpis: YearKPIs;
  currency: string;
}

export function SecondaryMetrics({ metrics, kpis, currency }: SecondaryMetricsProps) {
  const losChange = metrics.prevAvgLengthOfStay > 0
    ? Math.round(((metrics.avgLengthOfStay - metrics.prevAvgLengthOfStay) / metrics.prevAvgLengthOfStay) * 100)
    : null;

  const leadChange = metrics.prevAvgLeadTimeDays > 0
    ? Math.round(((metrics.avgLeadTimeDays - metrics.prevAvgLeadTimeDays) / metrics.prevAvgLeadTimeDays) * 100)
    : null;

  const revparChange = kpis.prevYearRevpar > 0
    ? Math.round(((kpis.revpar - kpis.prevYearRevpar) / kpis.prevYearRevpar) * 100)
    : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <SmallMetric
        label="RevPAR"
        value={formatCurrency(kpis.revpar, currency)}
        icon={TrendingUp}
        changePercent={revparChange}
      />
      <SmallMetric
        label="Occupancy"
        value={`${kpis.occupancyRate}%`}
        icon={CalendarRange}
        changePercent={kpis.occupancyChangePercent}
      />
      <SmallMetric
        label="Avg Stay"
        value={`${metrics.avgLengthOfStay} nights`}
        icon={Clock}
        changePercent={losChange}
      />
      <SmallMetric
        label="Lead Time"
        value={`${metrics.avgLeadTimeDays} days`}
        icon={CalendarRange}
        changePercent={leadChange}
      />
      <SmallMetric
        label="Wknd / Wkday"
        value={`${metrics.weekendRevenuePercent}% / ${metrics.weekdayRevenuePercent}%`}
        subtext={metrics.cancellationRate > 0 ? `${metrics.cancellationRate}% cancelled` : undefined}
        icon={Sun}
      />
    </div>
  );
}
