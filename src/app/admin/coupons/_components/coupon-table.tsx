
"use client";

import type { Coupon } from "@/types";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CouponStatusToggle } from "./coupon-status-toggle"; // Import the status toggle component
import { CouponExpiryEdit } from "./coupon-expiry-edit"; // Import the expiry edit component

interface CouponTableProps {
  coupons: Coupon[];
}

export function CouponTable({ coupons }: CouponTableProps) {
  // Function to convert Firestore Timestamp to Date object
  const timestampToDate = (timestamp: any): Date | null => {
    if (!timestamp || typeof timestamp.seconds !== 'number' || typeof timestamp.nanoseconds !== 'number') {
      return null;
    }
    return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
  };

  return (
    <Table>
      <TableCaption>A list of your coupons.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[150px]">Code</TableHead>
          <TableHead>Discount (%)</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Expires On</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {coupons.map((coupon) => {
          const validUntilDate = timestampToDate(coupon.validUntil);
          const createdAtDate = timestampToDate(coupon.createdAt);
          const isExpired = validUntilDate ? validUntilDate < new Date() : false;
          const effectiveStatus = isExpired ? "Expired" : coupon.isActive ? "Active" : "Inactive";

          return (
            <TableRow key={coupon.id}>
              <TableCell className="font-medium">{coupon.code}</TableCell>
              <TableCell>{coupon.discount}%</TableCell>
              <TableCell>{coupon.description || "-"}</TableCell>
              <TableCell>
                {validUntilDate ? (
                   // Pass couponId and current date to the edit component
                   <CouponExpiryEdit couponId={coupon.id} currentExpiryDate={validUntilDate} />
                ) : (
                  "N/A"
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                     effectiveStatus === "Active" ? "default" : effectiveStatus === "Inactive" ? "secondary" : "destructive"
                  }
                >
                  {effectiveStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                 {/* Pass couponId and current status to the toggle component */}
                 {/* Disable toggle if expired */}
                 <CouponStatusToggle couponId={coupon.id} isActive={coupon.isActive} isDisabled={isExpired} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
