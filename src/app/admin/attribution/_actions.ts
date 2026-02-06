"use server";

import { getAdminDb } from "@/lib/firebaseAdminSafe";
import { requireSuperAdmin } from "@/lib/authorization";
import { loggers } from "@/lib/logger";

const logger = loggers.admin;

export interface ChannelData {
  source: string;
  medium: string;
  bookings: number;
  revenue: number;
}

export interface AttributionData {
  channels: ChannelData[];
  totals: { bookings: number; revenue: number };
  period: { from: string; to: string };
}

export async function fetchAttributionData(
  propertyId?: string,
  dateRange?: { from: string; to: string }
): Promise<AttributionData> {
  await requireSuperAdmin();

  const db = await getAdminDb();
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = dateRange?.from ? new Date(dateRange.from) : defaultFrom;
  const to = dateRange?.to ? new Date(dateRange.to) : now;

  try {
    let query: FirebaseFirestore.Query = db.collection("bookings")
      .where("createdAt", ">=", from)
      .where("createdAt", "<=", to);

    if (propertyId) {
      query = query.where("propertyId", "==", propertyId);
    }

    const snapshot = await query.get();

    const channelMap = new Map<string, { bookings: number; revenue: number }>();
    let totalBookings = 0;
    let totalRevenue = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Only count confirmed/on-hold bookings (not cancelled/failed)
      if (data.status === "cancelled" || data.status === "payment_failed") return;

      const revenue = data.pricing?.total ?? 0;
      totalBookings++;
      totalRevenue += revenue;

      const source = data.attribution?.lastTouch?.source || "direct";
      const medium = data.attribution?.lastTouch?.medium || "(none)";
      const key = `${source}|${medium}`;

      const existing = channelMap.get(key) || { bookings: 0, revenue: 0 };
      existing.bookings++;
      existing.revenue += revenue;
      channelMap.set(key, existing);
    });

    const channels: ChannelData[] = Array.from(channelMap.entries())
      .map(([key, data]) => {
        const [source, medium] = key.split("|");
        return { source, medium, ...data };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return {
      channels,
      totals: { bookings: totalBookings, revenue: totalRevenue },
      period: { from: from.toISOString(), to: to.toISOString() },
    };
  } catch (error) {
    logger.error("Failed to fetch attribution data", error as Error);
    return {
      channels: [],
      totals: { bookings: 0, revenue: 0 },
      period: { from: from.toISOString(), to: to.toISOString() },
    };
  }
}
