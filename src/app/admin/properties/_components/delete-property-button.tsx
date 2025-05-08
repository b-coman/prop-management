// src/app/admin/properties/_components/delete-property-button.tsx
"use client";

import { useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deletePropertyAction } from '../actions'; // Import delete action
import { useRouter } from 'next/navigation';

interface DeletePropertyButtonProps {
  propertySlug: string;
  propertyName: string;
}

export function DeletePropertyButton({ propertySlug, propertyName }: DeletePropertyButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    startTransition(async () => {
      const result = await deletePropertyAction(propertySlug);
      if (result.success) {
        toast({
          title: "Property Deleted",
          description: `Property "${propertyName}" (${propertySlug}) was successfully deleted.`,
        });
        router.refresh(); // Refresh the list
      } else {
        toast({
          title: "Deletion Failed",
          description: result.error || "Could not delete property.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="icon" title="Delete Property" disabled={isPending}>
           {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the property
             "{propertyName}" ({propertySlug}) and all associated data (overrides, availability, etc. - ensure cleanup logic exists!).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
             {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Yes, delete property
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
