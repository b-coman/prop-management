'use client';

import {
  DollarSign,
  Moon,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { YearKPIs, YTDComparison } from '../_actions';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function MetricCard({
  title,
  value,
  changePercent,
  changeLabel,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  changePercent: number | null;
  changeLabel?: string;
  icon: LucideIcon;
}) {
  let changeDisplay: React.ReactNode = null;

  if (changePercent !== null) {
    const isUp = changePercent >= 0;
    changeDisplay = (
      <span className={`text-xs flex items-center gap-0.5 ${isUp ? 'text-green-600' : 'text-red-600'}`}>
        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isUp ? '+' : ''}{changePercent}% {changeLabel || 'vs last year'}
      </span>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {changeDisplay && <div className="mt-1">{changeDisplay}</div>}
      </CardContent>
    </Card>
  );
}

interface RevenueKPICardsProps {
  kpis: YearKPIs;
  ytdComparison?: YTDComparison | null;
}

export function RevenueKPICards({ kpis, ytdComparison }: RevenueKPICardsProps) {
  const ytd = ytdComparison;
  const prevYearLabel = ytd ? `vs ${ytd.periodLabel} ${new Date().getFullYear() - 1}` : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Revenue"
        value={formatCurrency(kpis.totalRevenue, kpis.currency)}
        changePercent={ytd ? ytd.revenueChangePercent : kpis.revenueChangePercent}
        changeLabel={prevYearLabel}
        icon={DollarSign}
      />
      <MetricCard
        title="Nights Booked"
        value={kpis.totalNights}
        changePercent={ytd ? ytd.nightsChangePercent : kpis.nightsChangePercent}
        changeLabel={prevYearLabel}
        icon={Moon}
      />
      <MetricCard
        title="Avg Daily Rate"
        value={formatCurrency(kpis.adr, kpis.currency)}
        changePercent={ytd ? ytd.adrChangePercent : kpis.adrChangePercent}
        changeLabel={prevYearLabel}
        icon={TrendingUp}
      />
      <MetricCard
        title="Occupancy Rate"
        value={`${kpis.occupancyRate}%`}
        changePercent={ytd ? ytd.occupancyChangePercent : kpis.occupancyChangePercent}
        changeLabel={prevYearLabel}
        icon={BarChart3}
      />
    </div>
  );
}
