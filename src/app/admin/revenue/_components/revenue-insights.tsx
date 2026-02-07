'use client';

import {
  TrendingUp,
  TrendingDown,
  Info,
  CalendarClock,
} from 'lucide-react';
import type { Insight } from '../_actions';

const insightStyles: Record<Insight['type'], { icon: typeof TrendingUp; bgColor: string; iconColor: string }> = {
  positive: { icon: TrendingUp, bgColor: 'bg-green-50 dark:bg-green-950/30', iconColor: 'text-green-600 dark:text-green-400' },
  negative: { icon: TrendingDown, bgColor: 'bg-red-50 dark:bg-red-950/30', iconColor: 'text-red-600 dark:text-red-400' },
  neutral: { icon: Info, bgColor: 'bg-blue-50 dark:bg-blue-950/30', iconColor: 'text-blue-600 dark:text-blue-400' },
  forward: { icon: CalendarClock, bgColor: 'bg-amber-50 dark:bg-amber-950/30', iconColor: 'text-amber-600 dark:text-amber-400' },
};

interface RevenueInsightsProps {
  insights: Insight[];
}

export function RevenueInsights({ insights }: RevenueInsightsProps) {
  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {insights.map((insight, i) => {
        const style = insightStyles[insight.type];
        const Icon = style.icon;
        return (
          <div
            key={i}
            className={`flex items-start gap-2.5 p-2.5 rounded-lg ${style.bgColor}`}
          >
            <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${style.iconColor}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{insight.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{insight.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
