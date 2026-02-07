// src/app/admin/bookings/_components/edit-booking-dialog.tsx
"use client";

import * as React from 'react';
import { useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ExternalBookingForm } from './external-booking-form';
import type { Booking } from '@/types';

interface EditBookingDialogProps {
  booking: Booking;
  properties: Array<{ id: string; name: string; currency: string }>;
}

export function EditBookingDialog({ booking, properties }: EditBookingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
        </DialogHeader>
        <ExternalBookingForm mode="edit" booking={booking} properties={properties} onSuccess={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
