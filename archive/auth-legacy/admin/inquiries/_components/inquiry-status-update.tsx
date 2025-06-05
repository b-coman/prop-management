// src/app/admin/inquiries/_components/inquiry-status-update.tsx
"use client";

import * as React from "react";
import { useState, useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Inquiry } from '@/types';
import { updateInquiryStatusAction } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2 } from "lucide-react";

interface InquiryStatusUpdateProps {
  inquiryId: string;
  currentStatus: Inquiry['status'];
}

// Helper function to get status color (copied from inquiry-table)
const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'responded': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'converted': return 'bg-green-100 text-green-800 border-green-300';
    case 'closed': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const statusOptions: Inquiry['status'][] = ["new", "responded", "converted", "closed"];

export function InquiryStatusUpdate({ inquiryId, currentStatus }: InquiryStatusUpdateProps) {
  const [status, setStatus] = useState<Inquiry['status']>(currentStatus);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleStatusChange = (newStatus: string) => {
    const validStatus = newStatus as Inquiry['status'];
    if (!validStatus || validStatus === status) return;

    startTransition(async () => {
      const result = await updateInquiryStatusAction({ inquiryId, status: validStatus });
      if (result.success) {
        setStatus(validStatus);
        toast({ title: "Status Updated", description: `Inquiry status changed to ${validStatus}.` });
      } else {
        toast({ title: "Update Failed", description: result.error || "Could not update status.", variant: "destructive" });
        // Revert local state on failure
        setStatus(currentStatus);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      <Select value={status} onValueChange={handleStatusChange} disabled={isPending}>
        <SelectTrigger className={cn("w-[130px] h-8 text-xs capitalize focus:ring-0 focus:ring-offset-0", getStatusColor(status))} disabled={isPending}>
          <SelectValue placeholder="Set status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option} value={option} className="capitalize text-xs">
               {option.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
       {/* Optionally display badge next to select - might be redundant */}
       {/* <Badge variant="outline" className={cn("capitalize", getStatusColor(status))}>{status.replace('_', ' ')}</Badge> */}
    </div>
  );
}
