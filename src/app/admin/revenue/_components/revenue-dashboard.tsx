'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Lightbulb, PieChart, Table2, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    <div className="space-y-4">
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
  const hasChart = data.chartData.some(d => d.revenue > 0);
  const hasSource = data.sourceBreakdown.length > 0;
  const hasInsights = data.insights.length > 0;

  return (
    <div className="space-y-4">
      {/* Primary KPI Cards — always visible */}
      <RevenueKPICards kpis={data.kpis} ytdComparison={data.ytdComparison} />

      {/* Tabbed content */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5">
            <Table2 className="h-3.5 w-3.5" />
            Monthly Data
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab: Chart + Sources + Insights */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Left: Monthly Revenue Chart (3/5) */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Monthly Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                {hasChart ? (
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

            {/* Right: Sources only (2/5) — height matches chart */}
            {hasSource && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieChart className="h-4 w-4" />
                    Sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SourceBreakdown data={data.sourceBreakdown} currency={data.currency} />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Insights strip below the two-column area */}
          {hasInsights && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueInsights insights={data.insights} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Monthly Data Tab: Full-width table */}
        <TabsContent value="monthly" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyBreakdownTable
                data={data.monthlyData}
                currency={data.currency}
                selectedYear={data.selectedYear}
                propertyCount={data.propertyCount}
                ytdComparison={data.ytdComparison}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// All Years View
// ============================================================================

function AllYearsView({ data }: { data: AllYearsData }) {
  const hasInsights = data.insights.length > 0;

  return (
    <div className="space-y-4">
      {/* Yearly summary cards — always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

      {/* Tabbed content */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="yoy" className="gap-1.5">
            <Table2 className="h-3.5 w-3.5" />
            Year-over-Year Data
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab: Chart + Insights */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <AllYearsChart
                monthlyGrid={data.monthlyGrid}
                years={data.availableYears}
                currency={data.currency}
              />
            </CardContent>
          </Card>

          {hasInsights && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueInsights insights={data.insights} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Year-over-Year Data Tab */}
        <TabsContent value="yoy" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Year-over-Year Breakdown</CardTitle>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
