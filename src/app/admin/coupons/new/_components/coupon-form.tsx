
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createCouponAction } from "../actions"; // Import the server action

// Define the Zod schema for form validation
const formSchema = z.object({
  code: z.string().min(3, {
    message: "Coupon code must be at least 3 characters.",
  }).max(50, {
    message: "Coupon code cannot exceed 50 characters.",
  }).transform(val => val.toUpperCase()), // Normalize to uppercase
  discount: z.coerce.number().min(1, { // Coerce to number
    message: "Discount percentage must be at least 1.",
  }).max(100, {
    message: "Discount percentage cannot exceed 100.",
  }),
  validUntil: z.date({
    required_error: "Expiration date is required.",
  }),
  isActive: z.boolean().default(true),
  description: z.string().max(100, {
    message: "Description cannot exceed 100 characters.",
  }).optional(),
});

export function CouponForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      discount: 10, // Default discount
      validUntil: new Date(new Date().setMonth(new Date().getMonth() + 1)), // Default to 1 month from now
      isActive: true,
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const result = await createCouponAction(values);

      if (result.error) {
        toast({
          title: "Error Creating Coupon",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Coupon Created",
          description: `Coupon "${result.code}" created successfully with ID: ${result.id}`,
        });
        form.reset(); // Reset form after successful submission
      }
    } catch (error) {
      console.error("Error in onSubmit:", error);
      toast({
        title: "An Unexpected Error Occurred",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Coupon Code */}
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Coupon Code</FormLabel>
              <FormControl>
                <Input placeholder="e.g., SUMMER25" {...field} />
              </FormControl>
              <FormDescription>
                The unique code for the coupon (will be converted to uppercase).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Discount Percentage */}
        <FormField
          control={form.control}
          name="discount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Discount Percentage (%)</FormLabel>
              <FormControl>
                 {/* Use type="number" and apply zod coerce */}
                <Input type="number" min="1" max="100" placeholder="e.g., 15" {...field} />
              </FormControl>
              <FormDescription>
                The percentage discount (1-100).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Expiration Date */}
        <FormField
          control={form.control}
          name="validUntil"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Expiration Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP") // Pretty format e.g., May 3, 2025
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0)) // Disable past dates
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>
                The last day the coupon can be used.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Is Active Switch */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Active
                </FormLabel>
                <FormDescription>
                  Enable this coupon for use immediately.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Description (Optional) */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Special summer promotion" {...field} />
              </FormControl>
              <FormDescription>
                An optional internal note or description for the coupon.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
            </>
          ) : (
            "Create Coupon"
          )}
        </Button>
      </form>
    </Form>
  );
}
