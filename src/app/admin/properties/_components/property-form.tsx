// src/app/admin/properties/_components/property-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { ThemeSelector } from "@/components/ui/theme-selector";
import { DEFAULT_THEME_ID } from "@/lib/themes/theme-definitions";

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
import { Textarea } from "@/components/ui/textarea"; // Assuming you have Textarea
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Assuming Select
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Property, CurrencyCode } from '@/types';
import { SUPPORTED_CURRENCIES } from '@/types';
import { createPropertyAction, updatePropertyAction } from "../actions"; // Import server actions
import { sanitizeText } from "@/lib/sanitize"; // Assuming sanitizer

// Define a Zod schema for the property form
// Adapt this schema to match ALL fields in your Property type accurately
const propertyFormSchema = z.object({
    // Core Info
    name: z.string().min(3, "Name must be at least 3 characters.").transform(sanitizeText),
    slug: z.string()
        .min(3, "Slug must be at least 3 characters.")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens.")
        .transform(sanitizeText),
    description: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    shortDescription: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    templateId: z.string().min(1, "Template ID is required."), // Assuming this is selected or fixed
    themeId: z.string().optional(), // Theme ID for styling the property website

    // Location
    location: z.object({
        address: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
        city: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
        state: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
        country: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
        zipCode: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
        coordinates: z.object({
            latitude: z.coerce.number().optional(),
            longitude: z.coerce.number().optional(),
        }).optional(),
    }),

    // Pricing & Details
    pricePerNight: z.coerce.number().positive("Price per night must be positive."),
    baseCurrency: z.enum(SUPPORTED_CURRENCIES),
    cleaningFee: z.coerce.number().nonnegative("Cleaning fee cannot be negative.").optional().default(0),
    maxGuests: z.coerce.number().int().positive("Max guests must be a positive integer."),
    baseOccupancy: z.coerce.number().int().positive("Base occupancy must be a positive integer."),
    defaultMinimumStay: z.coerce.number().int().positive("Default minimum stay must be a positive integer."),
    extraGuestFee: z.coerce.number().nonnegative("Extra guest fee cannot be negative.").optional().default(0),
    bedrooms: z.coerce.number().int().nonnegative("Bedrooms cannot be negative.").optional(),
    beds: z.coerce.number().int().nonnegative("Beds cannot be negative.").optional(),
    bathrooms: z.coerce.number().int().nonnegative("Bathrooms cannot be negative.").optional(),
    squareFeet: z.coerce.number().nonnegative("Square feet cannot be negative.").optional(),

    // Rules & Policies
    checkInTime: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    checkOutTime: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    // House rules might need a different input (e.g., tags input or multi-line textarea)
    // houseRules: z.array(z.string()).optional(),
    cancellationPolicy: z.string().optional().transform(val => val ? sanitizeText(val) : ''),

    // Status & Sync
    status: z.enum(['active', 'inactive', 'draft']).default('draft'),
    ownerId: z.string().optional(), // This might be set automatically based on logged-in user
    // Channel IDs might need separate inputs
    // airbnbListingId: z.string().optional(),
    // bookingComListingId: z.string().optional(),

    // Multi-Domain
    customDomain: z.string().optional().nullable().transform(val => val ? sanitizeText(val) : null),
    useCustomDomain: z.boolean().default(false),

    // Analytics
     analytics: z.object({
        enabled: z.boolean().default(false),
        googleAnalyticsId: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
     }).optional(),

    // Booking Options
     holdFeeAmount: z.coerce.number().nonnegative("Hold fee cannot be negative.").optional().default(0),
     enableHoldOption: z.boolean().default(false),
     enableContactOption: z.boolean().default(true),

}).refine(data => data.maxGuests >= data.baseOccupancy, {
    message: "Max guests must be greater than or equal to base occupancy.",
    path: ["maxGuests"], // Point error to maxGuests field
});


type PropertyFormValues = z.infer<typeof propertyFormSchema>;

interface PropertyFormProps {
  mode: 'create' | 'edit';
  initialData?: Property; // Provide initial data for edit mode
}

export function PropertyForm({ mode, initialData }: PropertyFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ensure slug is always present and matches id for edit mode
  const defaultSlug = mode === 'edit' ? initialData?.slug ?? '' : '';

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
        name: typeof initialData?.name === 'string' ? initialData.name : initialData?.name?.en ?? '',
        slug: defaultSlug,
        description: typeof initialData?.description === 'string' ? initialData.description : initialData?.description?.en ?? '',
        shortDescription: typeof initialData?.shortDescription === 'string' ? initialData.shortDescription : initialData?.shortDescription?.en ?? '',
        templateId: initialData?.templateId ?? 'holiday-house', // Default or fetch options
        themeId: initialData?.themeId ?? DEFAULT_THEME_ID,
        location: {
            address: initialData?.location?.address ?? '',
            city: initialData?.location?.city ?? '',
            state: initialData?.location?.state ?? '',
            country: initialData?.location?.country ?? '',
            zipCode: initialData?.location?.zipCode ?? '',
            coordinates: {
                latitude: initialData?.location?.coordinates?.latitude ?? undefined,
                longitude: initialData?.location?.coordinates?.longitude ?? undefined,
            },
        },
        pricePerNight: initialData?.pricePerNight ?? 0,
        baseCurrency: initialData?.baseCurrency ?? 'USD',
        cleaningFee: initialData?.cleaningFee ?? 0,
        maxGuests: initialData?.maxGuests ?? 1,
        baseOccupancy: initialData?.baseOccupancy ?? 1,
        defaultMinimumStay: initialData?.defaultMinimumStay ?? 2,
        extraGuestFee: initialData?.extraGuestFee ?? 0,
        bedrooms: initialData?.bedrooms ?? undefined,
        beds: initialData?.beds ?? undefined,
        bathrooms: initialData?.bathrooms ?? undefined,
        squareFeet: initialData?.squareFeet ?? undefined,
        checkInTime: initialData?.checkInTime ?? '',
        checkOutTime: initialData?.checkOutTime ?? '',
        cancellationPolicy: typeof initialData?.cancellationPolicy === 'string' ? initialData.cancellationPolicy : initialData?.cancellationPolicy?.en ?? '',
        status: initialData?.status ?? 'draft',
        ownerId: initialData?.ownerId ?? '', // Handle owner ID logic
        customDomain: initialData?.customDomain ?? null,
        useCustomDomain: initialData?.useCustomDomain ?? false,
        analytics: {
            enabled: initialData?.analytics?.enabled ?? false,
            googleAnalyticsId: initialData?.analytics?.googleAnalyticsId ?? '',
        },
        holdFeeAmount: initialData?.holdFeeAmount ?? 0,
        enableHoldOption: initialData?.enableHoldOption ?? false,
        enableContactOption: initialData?.enableContactOption ?? true,
    },
  });

  // Derive slug from name if creating and slug is empty
    const watchName = form.watch("name");
    useEffect(() => {
        if (mode === 'create' && watchName && !form.getValues("slug")) {
            const generatedSlug = watchName
                .toLowerCase()
                .replace(/\s+/g, '-') // Replace spaces with hyphens
                .replace(/[^a-z0-9-]/g, ''); // Remove invalid characters
            form.setValue("slug", generatedSlug);
        }
    }, [watchName, mode, form]);

  async function onSubmit(values: PropertyFormValues) {
    setIsSubmitting(true);
    try {
        let result;
        if (mode === 'create') {
            console.log("Creating property with values:", values);
            result = await createPropertyAction(values);
        } else if (initialData?.slug) { // Ensure slug exists for update
            console.log(`Updating property ${initialData.slug} with values:`, values);
            // Pass the original slug to identify the document
            result = await updatePropertyAction(initialData.slug, values);
        } else {
            throw new Error("Missing property identifier for update.");
        }

      if (result.error) {
        toast({
          title: `Error ${mode === 'create' ? 'Creating' : 'Updating'} Property`,
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: `Property ${mode === 'create' ? 'Created' : 'Updated'}`,
          description: `Property "${result.name}" (${result.slug}) ${mode === 'create' ? 'created' : 'updated'} successfully.`,
        });
        // Redirect to the properties list or the edited property page
        router.push('/admin/properties');
        router.refresh(); // Refresh server data
      }
    } catch (error) {
      console.error("Error in onSubmit:", error);
      toast({
        title: `An Unexpected Error Occurred`,
        description: `Could not ${mode} property. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* --- Section: Core Information --- */}
        <h3 className="text-lg font-medium border-b pb-2">Core Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Property Name *</FormLabel><FormControl><Input placeholder="e.g., Cozy Mountain Retreat" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="slug" render={({ field }) => ( <FormItem><FormLabel>Slug *</FormLabel><FormControl><Input placeholder="e.g., cozy-mountain-retreat" {...field} disabled={mode === 'edit'} /></FormControl><FormDescription>URL-friendly identifier (auto-generated from name if empty, cannot be changed after creation).</FormDescription><FormMessage /></FormItem> )} />
        </div>
        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Detailed description of the property..." {...field} rows={5} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="shortDescription" render={({ field }) => ( <FormItem><FormLabel>Short Description</FormLabel><FormControl><Input placeholder="A brief summary..." {...field} /></FormControl><FormMessage /></FormItem> )} />
         <FormField control={form.control} name="templateId" render={({ field }) => ( <FormItem><FormLabel>Website Template *</FormLabel><FormControl>
            {/* Replace with actual template selection if needed */}
            <Input {...field} disabled />
            </FormControl><FormDescription>Currently fixed template.</FormDescription><FormMessage /></FormItem> )} />
            
        {/* Theme Selection */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Website Theme</h3>
        <FormField
          control={form.control}
          name="themeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Choose a design theme for your property website</FormLabel>
              <FormControl>
                <ThemeSelector
                  selectedThemeId={field.value || ''}
                  onThemeChange={field.onChange}
                />
              </FormControl>
              <FormDescription>
                The selected theme will determine the colors, typography, and styling of your property website.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* --- Section: Location --- */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FormField control={form.control} name="location.address" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input placeholder="e.g., 123 Mountain Rd" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="location.city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="e.g., Comarnic" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="location.state" render={({ field }) => ( <FormItem><FormLabel>State / County</FormLabel><FormControl><Input placeholder="e.g., Prahova" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="location.country" render={({ field }) => ( <FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="e.g., Romania" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="location.zipCode" render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="e.g., 105700" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </div>
         {/* Coordinates might be better handled via a map picker? */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="location.coordinates.latitude" render={({ field }) => ( <FormItem><FormLabel>Latitude</FormLabel><FormControl><Input type="number" step="any" placeholder="e.g., 45.2530" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="location.coordinates.longitude" render={({ field }) => ( <FormItem><FormLabel>Longitude</FormLabel><FormControl><Input type="number" step="any" placeholder="e.g., 25.6346" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </div>

         {/* --- Section: Pricing & Details --- */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Pricing & Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <FormField control={form.control} name="pricePerNight" render={({ field }) => ( <FormItem><FormLabel>Price Per Night *</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 150" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="baseCurrency" render={({ field }) => (
                <FormItem>
                    <FormLabel>Base Currency *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {SUPPORTED_CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
               )} />
             <FormField control={form.control} name="cleaningFee" render={({ field }) => ( <FormItem><FormLabel>Cleaning Fee</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 50" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </div>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <FormField control={form.control} name="maxGuests" render={({ field }) => ( <FormItem><FormLabel>Max Guests *</FormLabel><FormControl><Input type="number" min="1" placeholder="e.g., 6" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="baseOccupancy" render={({ field }) => ( <FormItem><FormLabel>Base Occupancy *</FormLabel><FormControl><Input type="number" min="1" placeholder="Guests included in base price" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="defaultMinimumStay" render={({ field }) => ( <FormItem><FormLabel>Minimum Stay *</FormLabel><FormControl><Input type="number" min="1" placeholder="e.g., 2" {...field} /></FormControl><FormDescription>Default minimum nights required</FormDescription><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="extraGuestFee" render={({ field }) => ( <FormItem><FormLabel>Extra Guest Fee / Night</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 25" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <FormField control={form.control} name="bedrooms" render={({ field }) => ( <FormItem><FormLabel>Bedrooms</FormLabel><FormControl><Input type="number" min="0" placeholder="e.g., 3" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="beds" render={({ field }) => ( <FormItem><FormLabel>Beds</FormLabel><FormControl><Input type="number" min="0" placeholder="e.g., 4" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="bathrooms" render={({ field }) => ( <FormItem><FormLabel>Bathrooms</FormLabel><FormControl><Input type="number" min="0" placeholder="e.g., 2" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="squareFeet" render={({ field }) => ( <FormItem><FormLabel>Square Feet</FormLabel><FormControl><Input type="number" min="0" placeholder="e.g., 1500" {...field} /></FormControl><FormMessage /></FormItem> )} />
        </div>

         {/* --- Section: Rules & Policies --- */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Rules & Policies</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FormField control={form.control} name="checkInTime" render={({ field }) => ( <FormItem><FormLabel>Check-in Time</FormLabel><FormControl><Input placeholder="e.g., 3:00 PM" {...field} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="checkOutTime" render={({ field }) => ( <FormItem><FormLabel>Check-out Time</FormLabel><FormControl><Input placeholder="e.g., 11:00 AM" {...field} /></FormControl><FormMessage /></FormItem> )} />
         </div>
         {/* TODO: Add better input for houseRules if needed */}
         <FormField control={form.control} name="cancellationPolicy" render={({ field }) => ( <FormItem><FormLabel>Cancellation Policy</FormLabel><FormControl><Textarea placeholder="Describe your cancellation policy..." {...field} /></FormControl><FormMessage /></FormItem> )} />

        {/* --- Section: Status & Configuration --- */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Status & Configuration</h3>
        <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
                <FormLabel>Property Status *</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                    <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                </FormControl>
                <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
                </Select>
                <FormDescription>Controls if the property is live.</FormDescription>
                <FormMessage />
            </FormItem>
         )} />

         {/* --- Section: Multi-Domain --- */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Domain Configuration</h3>
         <FormField control={form.control} name="customDomain" render={({ field }) => ( <FormItem><FormLabel>Custom Domain</FormLabel><FormControl><Input placeholder="e.g., your-property.com (without https://)" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Assign a custom domain (requires DNS setup).</FormDescription><FormMessage /></FormItem> )} />
         <FormField control={form.control} name="useCustomDomain" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Use Custom Domain</FormLabel><FormDescription>Enable routing via the custom domain.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />

          {/* --- Section: Analytics --- */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Analytics</h3>
        <FormField control={form.control} name="analytics.enabled" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Enable Google Analytics</FormLabel><FormDescription>Track visits using Google Analytics.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />
        <FormField control={form.control} name="analytics.googleAnalyticsId" render={({ field }) => ( <FormItem><FormLabel>Google Analytics ID</FormLabel><FormControl><Input placeholder="e.g., G-XXXXXXXXXX" {...field} /></FormControl><FormMessage /></FormItem> )} />

         {/* --- Section: Booking Options --- */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Booking Options</h3>
         <FormField control={form.control} name="enableHoldOption" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Enable "Hold Dates" Option</FormLabel><FormDescription>Allow guests to pay a fee to hold dates.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />
         <FormField control={form.control} name="holdFeeAmount" render={({ field }) => ( <FormItem><FormLabel>Hold Fee Amount</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 25" {...field} /></FormControl><FormMessage /></FormItem> )} />
         <FormField control={form.control} name="enableContactOption" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Enable "Contact Host" Option</FormLabel><FormDescription>Allow guests to send inquiries.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />


        {/* --- Submit Button --- */}
        <Separator className="my-6" />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
             mode === 'create' ? 'Create Property' : 'Save Changes'
          )}
        </Button>
      </form>
    </Form>
  );
}
