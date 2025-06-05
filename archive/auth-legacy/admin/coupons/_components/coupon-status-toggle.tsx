
"use client";

import { useState, useTransition } from 'react';
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { updateCouponStatusAction } from "../actions"; // Import the server action
import { Loader2 } from 'lucide-react';

interface CouponStatusToggleProps {
  couponId: string;
  isActive: boolean;
  isDisabled?: boolean; // To disable the switch (e.g., if expired)
}

export function CouponStatusToggle({ couponId, isActive, isDisabled = false }: CouponStatusToggleProps) {
  const [currentIsActive, setCurrentIsActive] = useState(isActive);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleToggle = async (checked: boolean) => {
    startTransition(async () => {
      const result = await updateCouponStatusAction({ couponId, isActive: checked });

      if (result.success) {
        setCurrentIsActive(checked); // Update local state on success
        toast({
          title: "Status Updated",
          description: `Coupon status changed to ${checked ? 'Active' : 'Inactive'}.`,
        });
      } else {
        toast({
          title: "Update Failed",
          description: result.error || "Could not update coupon status.",
          variant: "destructive",
        });
        // Revert local state on failure (optional, depends on desired UX)
        // setCurrentIsActive(!checked);
      }
    });
  };

  return (
    <div className="flex items-center space-x-2">
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      <Switch
        id={`status-toggle-${couponId}`}
        checked={currentIsActive}
        onCheckedChange={handleToggle}
        disabled={isPending || isDisabled} // Disable while pending or if explicitly disabled
        aria-label={`Toggle status for coupon ${couponId}`}
      />
    </div>
  );
}
