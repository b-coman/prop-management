import { Suspense } from "react";
import { AdminPage } from "@/components/admin";
import { AttributionDashboard } from "./_components/attribution-dashboard";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AttributionPage() {
  return (
    <AdminPage
      title="Attribution"
      description="Track where your bookings come from and measure marketing channel performance"
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <AttributionDashboard />
      </Suspense>
    </AdminPage>
  );
}
