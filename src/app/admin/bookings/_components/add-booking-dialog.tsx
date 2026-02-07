// src/app/admin/bookings/_components/add-booking-dialog.tsx
"use client";

import * as React from 'react';
import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ExternalBookingForm } from './external-booking-form';

interface AddBookingDialogProps {
  properties: Array<{ id: string; name: string; currency: string }>;
}

export function AddBookingDialog({ properties }: AddBookingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Add Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add External Booking</DialogTitle>
        </DialogHeader>
        <ExternalBookingForm
          mode="create"
          properties={properties}
          compact
          onSuccess={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
