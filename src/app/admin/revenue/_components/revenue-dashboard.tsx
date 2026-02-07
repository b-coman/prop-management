'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Lightbulb, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import {
  fetchRevenueData,
  fetchAllYearsData,
  type RevenueData,
  type AllYearsData,
} from '../_actions';
import { RevenueKPICards } from './revenue-kpi-cards';
import { RevenueChart } from './revenue-chart';
import { RevenueInsights } from './revenue-insights';
import { MonthlyBreakdownTable } from './monthly-breakdown-table';
import { SecondaryMetrics } from './secondary-metrics';
import { SourceBreakdown } from './source-breakdown';
import { AllYearsChart } from './all-years-chart';
import { AllYearsTable } from './all-years-table';

type ViewMode = 'year' | 'all';

export function RevenueDashboard() {
  const { selectedPropertyId } = usePropertySelector();
  const [yearData, setYearData] = useState<RevenueData | null>(null);
  const [allYearsData, setAllYearsData] = useState<AllYearsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<ViewMode>('year');

  const loadYearData = useCallback(async (year: number) => {
    setLoading(true);
    const result = await fetchRevenueData(year, selectedPropertyId || undefined);
    setYearData(result);
    setLoading(false);
  }, [selectedPropertyId]);

  const loadAllYearsData = useCallback(async () => {
    setLoading(true);
    const result = await fetchAllYearsData(selectedPropertyId || undefined);
    setAllYearsData(result);
    setLoading(false);
  }, [selectedPropertyId]);

  useEffect(() => {
    if (viewMode === 'year') {
      loadYearData(selectedYear);
    } else {
      loadAllYearsData();
    }
  }, [viewMode, selectedYear, loadYearData, loadAllYearsData]);

  // Reload when property changes
  useEffect(() => {
    if (viewMode === 'year') {
      loadYearData(selectedYear);
    } else {
      loadAllYearsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId]);

  const availableYears = viewMode === 'year'
    ? yearData?.availableYears ?? [new Date().getFullYear()]
    : allYearsData?.availableYears ?? [];

  return (
    <div className="space-y-6">
      {/* Year selector + All Years toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={viewMode === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('all')}
          disabled={loading}
        >
          All Years
        </Button>
        <div className="w-px h-6 bg-border" />
        {(viewMode === 'year' ? availableYears : allYearsData?.availableYears ?? []).map(year => (
          <Button
            key={year}
            variant={viewMode === 'year' && selectedYear === year ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setViewMode('year');
              setSelectedYear(year);
            }}
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
      ) : viewMode === 'year' && yearData ? (
        <SingleYearView data={yearData} />
      ) : viewMode === 'all' && allYearsData ? (
        <AllYearsView data={allYearsData} />
      ) : null}
    </div>
  );
}

// ============================================================================
// Single Year View
// ============================================================================

function SingleYearView({ data }: { data: RevenueData }) {
  return (
    <>
      {/* Primary KPI Cards */}
      <RevenueKPICards kpis={data.kpis} ytdComparison={data.ytdComparison} />

      {/* Secondary Metrics */}
      <SecondaryMetrics
        metrics={data.extendedMetrics}
        kpis={data.kpis}
        currency={data.currency}
        ytdComparison={data.ytdComparison}
      />

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

      {/* Revenue by Source */}
      {data.sourceBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Revenue by Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SourceBreakdown data={data.sourceBreakdown} currency={data.currency} />
          </CardContent>
        </Card>
      )}

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
            propertyCount={data.propertyCount}
          />
        </CardContent>
      </Card>
    </>
  );
}

// ============================================================================
// All Years View
// ============================================================================

function AllYearsView({ data }: { data: AllYearsData }) {
  return (
    <>
      {/* Yearly summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.yearlySummaries.map(summary => (
          <Card key={summary.year}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground mb-1">{summary.year}</p>
              <p className="text-lg font-semibold">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: data.currency.toUpperCase(),
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(summary.revenue)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {summary.nights} nights &middot; {summary.occupancy}% occ
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Multi-year line chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <AllYearsChart
            monthlyGrid={data.monthlyGrid}
            years={data.availableYears}
            currency={data.currency}
          />
        </CardContent>
      </Card>

      {/* Insights */}
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

      {/* All-years grid table */}
      <Card>
        <CardHeader>
          <CardTitle>Year-over-Year Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <AllYearsTable
            monthlyGrid={data.monthlyGrid}
            yearlySummaries={data.yearlySummaries}
            years={data.availableYears}
            currency={data.currency}
          />
        </CardContent>
      </Card>
    </>
  );
}
