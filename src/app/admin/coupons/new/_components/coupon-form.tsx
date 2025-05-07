// src/app/admin/coupons/new/_components/coupon-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react"; // Import useEffect

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
import { createCouponAction } from "../actions";
import { Separator } from "@/components/ui/separator";
import { useSanitizedState } from "@/hooks/useSanitizedState"; // Import the hook
import { sanitizeText } from "@/lib/sanitize"; // Import specific sanitizer

const exclusionPeriodSchema = z.object({
  start: z.date(),
  end: z.date(),
}).refine(data => data.end > data.start, {
  message: "Exclusion end date must be after start date.",
  path: ["end"],
});

// Zod schema for form validation - sanitization transforms are now mostly in the action
const formSchema = z.object({
  code: z.string().min(3, {
    message: "Coupon code must be at least 3 characters.",
  }).max(50, {
    message: "Coupon code cannot exceed 50 characters.",
  }), // Sanitization will happen in the action
  discount: z.coerce.number().min(1, {
    message: "Discount percentage must be at least 1.",
  }).max(100, {
    message: "Discount percentage cannot exceed 100.",
  }),
  validUntil: z.date({
    required_error: "Coupon expiry date is required.",
  }),
  isActive: z.boolean().default(true),
  description: z.string().max(100, {
    message: "Description cannot exceed 100 characters.",
  }).optional(), // Sanitization will happen in the action
  bookingValidFrom: z.date().nullable().optional(),
  bookingValidUntil: z.date().nullable().optional(),
  exclusionPeriods: z.array(exclusionPeriodSchema).optional(),
})
.refine(data => {
    if (data.bookingValidFrom && data.bookingValidUntil) {
        return data.bookingValidUntil > data.bookingValidFrom;
    }
    return true;
}, {
    message: "Booking validity end date must be after start date.",
    path: ["bookingValidUntil"],
})
.refine(data => {
    if (data.validUntil && data.bookingValidUntil) {
        return data.validUntil >= data.bookingValidUntil;
    }
    return true;
}, {
    message: "Coupon expiry date must be on or after the booking validity end date.",
    path: ["validUntil"],
});

export function CouponForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Use react-hook-form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      discount: 10,
      validUntil: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      isActive: true,
      description: "",
      bookingValidFrom: null,
      bookingValidUntil: null,
      exclusionPeriods: [],
    },
  });

  // For fields managed by react-hook-form, direct sanitization within useForm's `onChange` or via Zod transform (in action) is better.
  // For standalone inputs not tied to react-hook-form, useSanitizedState is useful.
  // Here, we will rely on Zod transforms in the server action for 'code' and 'description'.

  const { fields: exclusionFields, append: appendExclusion, remove: removeExclusion } = useFieldArray({
    control: form.control,
    name: "exclusionPeriods",
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      // The server action `createCouponAction` now handles sanitization via Zod transforms.
      // We pass the raw (but Zod-validated) form values.
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
        form.reset();
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

  const DatePickerField = ({ name, label, description }: { name: "validUntil" | "bookingValidFrom" | "bookingValidUntil", label: string, description: string }) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>{label}</FormLabel>
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
                    format(field.value, "PPP")
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
                selected={field.value ?? undefined}
                onSelect={(date) => field.onChange(date ?? null)}
                disabled={(date) =>
                   name === "validUntil" ? date < new Date(new Date().setHours(0, 0, 0, 0)) : false
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField control={form.control} name="code" render={({ field }) => ( <FormItem><FormLabel>Coupon Code</FormLabel><FormControl><Input placeholder="e.g., SUMMER25" {...field} /></FormControl><FormDescription>Unique code (will be uppercase).</FormDescription><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="discount" render={({ field }) => ( <FormItem><FormLabel>Discount (%)</FormLabel><FormControl><Input type="number" min="1" max="100" placeholder="e.g., 15" {...field} /></FormControl><FormDescription>Percentage discount (1-100).</FormDescription><FormMessage /></FormItem> )} />
        <DatePickerField name="validUntil" label="Coupon Expiry Date" description="The last day the coupon code itself can be applied." />
        <FormField control={form.control} name="isActive" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Active</FormLabel><FormDescription>Enable this coupon.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />
        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Input placeholder="e.g., Special summer promotion" {...field} /></FormControl><FormDescription>Internal note.</FormDescription><FormMessage /></FormItem> )} />
        <Separator />
        <h3 className="text-lg font-medium">Booking Validity Period (Optional)</h3>
        <p className="text-sm text-muted-foreground">Define the check-in/check-out date range for which this coupon is valid. Leave blank if valid anytime.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DatePickerField name="bookingValidFrom" label="Valid for Bookings FROM" description="Check-in date must be on or after this date." />
          <DatePickerField name="bookingValidUntil" label="Valid for Bookings UNTIL" description="Check-out date must be on or before this date." />
        </div>
        <Separator />
        <h3 className="text-lg font-medium">Exclusion Periods (Optional)</h3>
        <p className="text-sm text-muted-foreground mb-4">Define date ranges where this coupon CANNOT be applied, even if within the validity period.</p>
        <div className="space-y-4">
          {exclusionFields.map((field, index) => (
            <div key={field.id} className="flex flex-col md:flex-row items-start md:items-end gap-4 border p-4 rounded-md relative">
              <FormField
                control={form.control}
                name={`exclusionPeriods.${index}.start`}
                render={({ field: dateField }) => (
                  <FormItem className="flex flex-col flex-grow">
                    <FormLabel>Exclusion Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full md:w-[200px] pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}>
                            {dateField.value ? format(dateField.value, "PPP") : <span>Pick start date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`exclusionPeriods.${index}.end`}
                render={({ field: dateField }) => (
                  <FormItem className="flex flex-col flex-grow">
                    <FormLabel>Exclusion End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full md:w-[200px] pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}>
                            {dateField.value ? format(dateField.value, "PPP") : <span>Pick end date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => removeExclusion(index)}
                className="mt-4 md:mt-0"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Remove exclusion period</span>
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => appendExclusion({ start: new Date(), end: new Date(new Date().setDate(new Date().getDate() + 1)) })}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Exclusion Period
        </Button>
        <Separator />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Coupon'
          )}
        </Button>
      </form>
    </Form>
  );
}
