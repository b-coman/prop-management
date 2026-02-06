"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePropertySelector } from "@/contexts/PropertySelectorContext";
import { fetchAttributionData, type AttributionData } from "../_actions";
import { ChannelChart } from "./channel-chart";
import { AttributionTable } from "./attribution-table";
import { Loader2, TrendingUp, DollarSign, Users, Globe } from "lucide-react";

type DateRangePreset = "7d" | "30d" | "90d";

export function AttributionDashboard() {
  const { selectedPropertyId } = usePropertySelector();
  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<DateRangePreset>("30d");

  const loadData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const from = new Date(now);
    const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
    from.setDate(from.getDate() - days);

    const result = await fetchAttributionData(
      selectedPropertyId || undefined,
      { from: from.toISOString(), to: now.toISOString() }
    );
    setData(result);
    setLoading(false);
  }, [selectedPropertyId, preset]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const topChannel =
    data?.channels?.[0]?.source || "N/A";

  const directBookings =
    data?.channels?.find((c) => c.source === "direct")?.bookings ?? 0;
  const paidBookings = (data?.totals?.bookings ?? 0) - directBookings;
  const directRatio =
    data?.totals?.bookings
      ? Math.round((directBookings / data.totals.bookings) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex items-center gap-2">
        {(["7d", "30d", "90d"] as const).map((p) => (
          <Button
            key={p}
            variant={preset === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset(p)}
          >
            {p === "7d" ? "Last 7 days" : p === "30d" ? "Last 30 days" : "Last 90 days"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Bookings
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.totals?.bookings ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(data?.totals?.revenue ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Top Channel
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{topChannel}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Direct vs Paid
                </CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {directRatio}% / {100 - directRatio}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {directBookings} direct, {paidBookings} paid
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {data && data.channels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <ChannelChart channels={data.channels} />
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {data && data.channels.length > 0 ? (
                <AttributionTable channels={data.channels} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No attribution data for this period. Bookings with UTM
                  parameters or referrer data will appear here.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
