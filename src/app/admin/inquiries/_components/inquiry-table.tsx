// src/app/admin/inquiries/_components/inquiry-table.tsx
"use client";

import * as React from 'react';
import Link from 'next/link';
import type { Inquiry, SerializableTimestamp } from "@/types";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Eye, XCircle, MessageSquare } from "lucide-react";
import { formatDistanceToNow, parseISO } from 'date-fns';
import { InquiryStatusUpdate } from './inquiry-status-update';
import { useRowSelection } from '@/hooks/use-row-selection';
import { BulkActionBar } from '@/components/admin/BulkActionBar';
import type { BulkAction } from '@/components/admin/BulkActionBar';
import { bulkCloseInquiries, bulkMarkInquiriesResponded } from '../bulk-actions';

interface InquiryTableProps {
  inquiries: Inquiry[];
}

export function InquiryTable({ inquiries }: InquiryTableProps) {
  const rowIds = React.useMemo(() => inquiries.map(i => i.id), [inquiries]);
  const { selectedIds, selectedCount, isSelected, toggle, toggleAll, clearSelection, allState } = useRowSelection(rowIds);

  // Helper to safely parse date strings
  const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    try { return parseISO(String(dateStr)); } catch { return null; }
  };

  const bulkActions: BulkAction[] = React.useMemo(() => [
    {
      label: 'Close Selected',
      icon: XCircle,
      variant: 'default' as const,
      confirm: {
        title: 'Close selected inquiries?',
        description: `This will close ${selectedCount} inquiry(ies). Already closed inquiries will be skipped.`,
      },
      onExecute: bulkCloseInquiries,
    },
    {
      label: 'Mark Responded',
      icon: MessageSquare,
      variant: 'default' as const,
      onExecute: bulkMarkInquiriesResponded,
    },
  ], [selectedCount]);

  return (
    <>
      <BulkActionBar
        selectedIds={selectedIds}
        entityName="inquiry(ies)"
        actions={bulkActions}
        onClearSelection={clearSelection}
      />
      <Table>
        <TableCaption>A list of guest inquiries.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allState === 'all' ? true : allState === 'some' ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Select all inquiries"
              />
            </TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inquiries.map((inquiry) => {
            const createdAtDate = parseDateSafe(inquiry.createdAt);
            const checkInDate = parseDateSafe(inquiry.checkIn);
            const checkOutDate = parseDateSafe(inquiry.checkOut);

            return (
              <TableRow key={inquiry.id} data-state={isSelected(inquiry.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    checked={isSelected(inquiry.id)}
                    onCheckedChange={() => toggle(inquiry.id)}
                    aria-label={`Select inquiry from ${inquiry.guestInfo.firstName}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                   <span title={inquiry.propertySlug}>{inquiry.propertySlug}</span>
                </TableCell>
                <TableCell>
                  <p>{inquiry.guestInfo.firstName} {inquiry.guestInfo.lastName || ''}</p>
                  <p className="text-xs text-muted-foreground">{inquiry.guestInfo.email}</p>
                </TableCell>
                <TableCell>
                  {checkInDate ? formatDistanceToNow(checkInDate, { addSuffix: true }) : '-'}
                  {' to '}
                  {checkOutDate ? formatDistanceToNow(checkOutDate, { addSuffix: true }) : '-'}
                </TableCell>
                <TableCell>
                  {createdAtDate ? formatDistanceToNow(createdAtDate, { addSuffix: true }) : 'Unknown'}
                </TableCell>
                <TableCell>
                   <InquiryStatusUpdate inquiryId={inquiry.id} currentStatus={inquiry.status} />
                </TableCell>
                <TableCell className="text-right space-x-2">
                   <Link href={`/admin/inquiries/${inquiry.id}`} passHref>
                     <Button variant="outline" size="icon" title="View Details & Respond">
                       <Eye className="h-4 w-4" />
                     </Button>
                   </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
