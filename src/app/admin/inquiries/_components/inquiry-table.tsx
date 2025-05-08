// src/app/admin/inquiries/_components/inquiry-table.tsx
"use client";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, MessageSquare, XCircle } from "lucide-react"; // Icons
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { InquiryStatusUpdate } from './inquiry-status-update'; // Import status update component

interface InquiryTableProps {
  inquiries: Inquiry[];
}

// Helper function to get status color (similar to coupon table)
const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'responded': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'converted': return 'bg-green-100 text-green-800 border-green-300';
    case 'closed': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export function InquiryTable({ inquiries }: InquiryTableProps) {
  // Helper to safely parse date strings
  const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    try { return parseISO(String(dateStr)); } catch { return null; }
  };

  return (
    <Table>
      <TableCaption>A list of guest inquiries.</TableCaption>
      <TableHeader>
        <TableRow>
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
            <TableRow key={inquiry.id}>
              <TableCell className="font-medium">
                 {/* Link to property page if needed, or just display name */}
                 <span title={inquiry.propertySlug}>{inquiry.propertySlug}</span> {/* Display slug for now */}
                 {/* TODO: Fetch property name based on slug if needed */}
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
                 {/* Maybe add a quick "Mark as Closed" button here later */}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
