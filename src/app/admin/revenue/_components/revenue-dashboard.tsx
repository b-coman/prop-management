'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import { fetchRevenueData, type RevenueData } from '../_actions';
import { RevenueKPICards } from './revenue-kpi-cards';
import { RevenueChart } from './revenue-chart';
import { RevenueInsights } from './revenue-insights';
import { MonthlyBreakdownTable } from './monthly-breakdown-table';

export function RevenueDashboard() {
  const { selectedPropertyId } = usePropertySelector();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadData = useCallback(async (year: number) => {
    setLoading(true);
    const result = await fetchRevenueData(
      year,
      selectedPropertyId || undefined
    );
    setData(result);
    setLoading(false);
  }, [selectedPropertyId]);

  useEffect(() => {
    loadData(selectedYear);
  }, [loadData, selectedYear]);

  // When property changes, reload with current year
  useEffect(() => {
    loadData(selectedYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  const availableYears = data?.availableYears ?? [new Date().getFullYear()];

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-2">
        {availableYears.map(year => (
          <Button
            key={year}
            variant={selectedYear === year ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleYearChange(year)}
            disabled={loading}
          >
            {year}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <RevenueKPICards kpis={data.kpis} />

          {/* Monthly Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {data.chartData.some(d => d.revenue > 0) ? (
                <RevenueChart
                  data={data.chartData}
                  selectedYear={data.selectedYear}
                  currency={data.currency}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No revenue data for {data.selectedYear}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Smart Insights */}
          {data.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueInsights insights={data.insights} />
              </CardContent>
            </Card>
          )}

          {/* Monthly Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyBreakdownTable
                data={data.monthlyData}
                currency={data.currency}
                selectedYear={data.selectedYear}
              />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
