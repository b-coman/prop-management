'use client';

import {
  Clock,
  CalendarRange,
  Sun,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ExtendedMetrics, YearKPIs, YTDComparison } from '../_actions';

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
  changeLabel,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  changePercent?: number | null;
  changeLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-sm font-semibold">{value}</span>
          {subtext && <span className="text-xs text-muted-foreground">({subtext})</span>}
        </div>
        {changePercent !== undefined && changePercent !== null && (
          <span className={`text-[11px] flex items-center gap-0.5 ${changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {changePercent >= 0
              ? <TrendingUp className="h-2.5 w-2.5" />
              : <TrendingDown className="h-2.5 w-2.5" />
            }
            {changePercent >= 0 ? '+' : ''}{changePercent}% {changeLabel || 'vs last year'}
          </span>
        )}
      </div>
    </div>
  );
}

interface SecondaryMetricsProps {
  metrics: ExtendedMetrics;
  kpis: YearKPIs;
  currency: string;
  ytdComparison?: YTDComparison | null;
}

export function SecondaryMetrics({ metrics, kpis, currency, ytdComparison }: SecondaryMetricsProps) {
  const ytd = ytdComparison;
  const changeLabel = ytd ? `vs ${ytd.periodLabel} ${new Date().getFullYear() - 1}` : 'vs last year';

  const losChange = metrics.prevAvgLengthOfStay > 0
    ? Math.round(((metrics.avgLengthOfStay - metrics.prevAvgLengthOfStay) / metrics.prevAvgLengthOfStay) * 100)
    : null;

  const hasLeadTimeData = metrics.avgLeadTimeDays >= 0;
  const hasPrevLeadTimeData = metrics.prevAvgLeadTimeDays >= 0;
  const leadChange = hasLeadTimeData && hasPrevLeadTimeData && metrics.prevAvgLeadTimeDays > 0
    ? Math.round(((metrics.avgLeadTimeDays - metrics.prevAvgLeadTimeDays) / metrics.prevAvgLeadTimeDays) * 100)
    : null;

  const revparChange = ytd
    ? (ytd.prevYtdRevpar > 0 ? Math.round(((ytd.ytdRevpar - ytd.prevYtdRevpar) / ytd.prevYtdRevpar) * 100) : null)
    : (kpis.prevYearRevpar > 0 ? Math.round(((kpis.revpar - kpis.prevYearRevpar) / kpis.prevYearRevpar) * 100) : null);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <SmallMetric
        label="RevPAR"
        value={formatCurrency(kpis.revpar, currency)}
        icon={TrendingUp}
        changePercent={revparChange}
        changeLabel={changeLabel}
      />
      <SmallMetric
        label="Avg Stay"
        value={`${metrics.avgLengthOfStay} nights`}
        icon={Clock}
        changePercent={losChange}
        changeLabel={changeLabel}
      />
      <SmallMetric
        label="Lead Time"
        value={hasLeadTimeData ? `${metrics.avgLeadTimeDays} days` : 'N/A'}
        icon={CalendarRange}
        changePercent={hasLeadTimeData ? leadChange : null}
        changeLabel={changeLabel}
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
