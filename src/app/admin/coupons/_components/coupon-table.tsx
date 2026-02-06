
"use client";
import * as React from 'react';

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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { format, parseISO, startOfDay } from "date-fns";
import { CouponStatusToggle } from "./coupon-status-toggle";
import { CouponExpiryEdit } from "./coupon-expiry-edit";
import { CouponBookingValidityEdit } from "./coupon-booking-validity-edit";
import { CouponExclusionsEdit } from "./coupon-exclusions-edit";
import { useState } from "react";
import { ChevronDown, ChevronUp, Power, Trash2 } from "lucide-react";
import { useRowSelection } from '@/hooks/use-row-selection';
import { BulkActionBar } from '@/components/admin/BulkActionBar';
import type { BulkAction } from '@/components/admin/BulkActionBar';
import { bulkDeactivateCoupons, bulkDeleteCoupons } from '../actions';

interface CouponTableProps {
  coupons: Coupon[];
}

export function CouponTable({ coupons }: CouponTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const rowIds = React.useMemo(() => coupons.map(c => c.id), [coupons]);
  const { selectedIds, selectedCount, isSelected, toggle, toggleAll, clearSelection, allState } = useRowSelection(rowIds);

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
          .filter(p => p.start && p.end) as Array<{ start: Date; end: Date }>;
  };

  const bulkActions: BulkAction[] = React.useMemo(() => [
    {
      label: 'Deactivate Selected',
      icon: Power,
      variant: 'default' as const,
      confirm: {
        title: 'Deactivate selected coupons?',
        description: `This will deactivate ${selectedCount} coupon(s). They can be reactivated later.`,
      },
      onExecute: bulkDeactivateCoupons,
    },
    {
      label: 'Delete Selected',
      icon: Trash2,
      variant: 'destructive' as const,
      confirm: {
        title: 'Delete selected coupons?',
        description: `This will permanently delete ${selectedCount} coupon(s). This action cannot be undone.`,
      },
      onExecute: bulkDeleteCoupons,
    },
  ], [selectedCount]);

  return (
    <>
      <BulkActionBar
        selectedIds={selectedIds}
        entityName="coupon(s)"
        actions={bulkActions}
        onClearSelection={clearSelection}
      />
      <Table>
        <TableCaption>A list of your coupons.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allState === 'all' ? true : allState === 'some' ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Select all coupons"
              />
            </TableHead>
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
            const isExpired = validUntilDate ? validUntilDate < startOfDay(new Date()) : false;
            const effectiveStatus = isExpired ? "Expired" : coupon.isActive ? "Active" : "Inactive";
            const isExpanded = expandedRowId === coupon.id;

            // Deserialize dates for editing components
            const bookingValidFromDate = deserializeTimestamp(coupon.bookingValidFrom);
            const bookingValidUntilDate = deserializeTimestamp(coupon.bookingValidUntil);
            const exclusionPeriodsDates = deserializeExclusionPeriods(coupon.exclusionPeriods);

            return (
              <React.Fragment key={coupon.id}>
                  <TableRow data-state={isSelected(coupon.id) ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected(coupon.id)}
                          onCheckedChange={() => toggle(coupon.id)}
                          aria-label={`Select coupon ${coupon.code}`}
                        />
                      </TableCell>
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
                      <TableCell colSpan={8} className="p-4">
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
    </>
  );
}
