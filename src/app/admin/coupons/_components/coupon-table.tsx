"use client";

import type { Coupon, SerializableTimestamp } from "@/types"; // Import SerializableTimestamp
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
import { format, parseISO } from "date-fns"; // Import parseISO
import { CouponStatusToggle } from "./coupon-status-toggle"; // Import the status toggle component
import { CouponExpiryEdit } from "./coupon-expiry-edit"; // Import the expiry edit component

interface CouponTableProps {
  coupons: Coupon[];
}

export function CouponTable({ coupons }: CouponTableProps) {
  // Function to convert Firestore Timestamp or serialized date to Date object
  const deserializeTimestamp = (timestamp: SerializableTimestamp | null | undefined): Date | null => {
    if (!timestamp) return null;

    // Check if it's already a Date object (less likely after serialization)
    if (timestamp instanceof Date) {
        return timestamp;
    }
    // Check if it's a Firestore Timestamp object (less likely after serialization)
     if (typeof timestamp === 'object' && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
       // @ts-ignore Assuming it's a Firestore Timestamp-like object
       return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
     }
    // Check if it's an ISO string
    if (typeof timestamp === 'string') {
      try {
        return parseISO(timestamp);
      } catch (e) {
        console.error("Failed to parse ISO string:", timestamp, e);
        return null;
      }
    }
    // Check if it's a number (milliseconds since epoch)
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }

    console.warn("Unknown timestamp format received:", timestamp);
    return null;
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
          const validUntilDate = deserializeTimestamp(coupon.validUntil);
          const createdAtDate = deserializeTimestamp(coupon.createdAt); // Deserialize createdAt too if needed elsewhere
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
                  "N/A" // Or "No Expiry"
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