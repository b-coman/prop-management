
"use client";
import * as React from 'react'; // Import React

import type { Coupon, SerializableTimestamp } from "@/types";
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
import { Button } from "@/components/ui/button"; // Import Button
import { format, parseISO } from "date-fns";
import { CouponStatusToggle } from "./coupon-status-toggle";
import { CouponExpiryEdit } from "./coupon-expiry-edit";
import { CouponBookingValidityEdit } from "./coupon-booking-validity-edit"; // Import new component
import { CouponExclusionsEdit } from "./coupon-exclusions-edit"; // Import new component
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react"; // Icons for expansion

interface CouponTableProps {
  coupons: Coupon[];
}

export function CouponTable({ coupons }: CouponTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const toggleRowExpansion = (couponId: string) => {
    setExpandedRowId(expandedRowId === couponId ? null : couponId);
  };

  // Function to convert Firestore Timestamp or serialized date to Date object
  const deserializeTimestamp = (timestamp: SerializableTimestamp | null | undefined): Date | null => {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp;
     // @ts-ignore Assuming it's a Firestore Timestamp-like object
     if (typeof timestamp === 'object' && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
       // @ts-ignore Assuming it's a Firestore Timestamp-like object
       return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
     }
    if (typeof timestamp === 'string') {
      try { return parseISO(timestamp); } catch { return null; }
    }
    if (typeof timestamp === 'number') return new Date(timestamp);
    return null;
  };

  // Function to deserialize exclusion periods
  const deserializeExclusionPeriods = (periods: Array<{ start: SerializableTimestamp; end: SerializableTimestamp }> | null | undefined): Array<{ start: Date; end: Date }> => {
      if (!periods) return [];
      return periods
          .map(p => ({ start: deserializeTimestamp(p.start), end: deserializeTimestamp(p.end) }))
          .filter(p => p.start && p.end) as Array<{ start: Date; end: Date }>; // Filter out invalid dates
  };

  return (
    <Table>
      <TableCaption>A list of your coupons.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]"></TableHead> {/* Column for expand button */}
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
          const isExpired = validUntilDate ? validUntilDate < new Date(new Date().setHours(0,0,0,0)) : false; // Check against start of today
          const effectiveStatus = isExpired ? "Expired" : coupon.isActive ? "Active" : "Inactive";
          const isExpanded = expandedRowId === coupon.id;

          // Deserialize dates for editing components
          const bookingValidFromDate = deserializeTimestamp(coupon.bookingValidFrom);
          const bookingValidUntilDate = deserializeTimestamp(coupon.bookingValidUntil);
          const exclusionPeriodsDates = deserializeExclusionPeriods(coupon.exclusionPeriods);

          return (
            <React.Fragment key={coupon.id}>
              <TableRow>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleRowExpansion(coupon.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`details-${coupon.id}`}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span className="sr-only">{isExpanded ? 'Collapse' : 'Expand'} details</span>
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{coupon.code}</TableCell>
                  <TableCell>{coupon.discount}%</TableCell>
                  <TableCell>{coupon.description || "-"}</TableCell>
                  <TableCell>
                    {validUntilDate ? (
                      <CouponExpiryEdit couponId={coupon.id} currentExpiryDate={validUntilDate} />
                    ) : (
                      "No Expiry"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ effectiveStatus === "Active" ? "default" : effectiveStatus === "Inactive" ? "secondary" : "destructive" }>
                      {effectiveStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <CouponStatusToggle couponId={coupon.id} isActive={coupon.isActive} isDisabled={isExpired} />
                  </TableCell>
                </TableRow>
                {/* Expanded Row for Additional Details */}
                {isExpanded && (
                  <TableRow id={`details-${coupon.id}`} className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={7} className="p-4"> {/* Use colSpan to span all columns */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">Booking Validity</h4>
                          <CouponBookingValidityEdit
                              couponId={coupon.id}
                              currentBookingValidFrom={bookingValidFromDate}
                              currentBookingValidUntil={bookingValidUntilDate}
                          />
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Exclusion Periods</h4>
                            <CouponExclusionsEdit
                              couponId={coupon.id}
                              currentExclusionPeriods={exclusionPeriodsDates}
                            />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
