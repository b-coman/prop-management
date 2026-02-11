// src/app/admin/properties/_components/property-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import React from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { DEFAULT_THEME_ID } from "@/lib/themes/theme-definitions";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    propertyType: z.enum(['entire_place', 'chalet', 'cabin', 'villa', 'apartment', 'house', 'cottage', 'studio', 'bungalow']).optional(),
    bedConfiguration: z.array(z.object({
      roomName: z.string().min(1, "Room name is required."),
      beds: z.array(z.object({
        type: z.enum(['king', 'queen', 'double', 'single', 'sofa_bed', 'bunk', 'crib']),
        count: z.coerce.number().int().positive("Count must be at least 1."),
      })).min(1, "Each room must have at least one bed."),
    })).optional(),

    // Rules & Policies
    checkInTime: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    checkOutTime: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    // House rules might need a different input (e.g., tags input or multi-line textarea)
    // houseRules: z.array(z.string()).optional(),
    cancellationPolicy: z.string().optional().transform(val => val ? sanitizeText(val) : ''),

    // Status & Sync
    status: z.enum(['active', 'inactive', 'draft']).default('draft'),
    ownerId: z.string().optional(), // This might be set automatically based on logged-in user
    ownerEmail: z.string().email("Invalid email address").optional().or(z.literal('')).transform(val => val || null), // Email for notifications
    contactPhone: z.string().optional().transform(val => val ? sanitizeText(val) : ''), // Public contact phone (structured data & footer)
    contactEmail: z.string().email("Invalid email address").optional().or(z.literal('')).transform(val => val || null), // Public contact email (structured data & footer)
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

    // Google Places
    googlePlaceId: z.string().optional().transform(val => val ? sanitizeText(val) : ''),

    // Weekend Pricing
    weekendAdjustmentPercent: z.coerce.number().min(0, "Cannot be negative.").optional().default(0),
    weekendDays: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional().default(['friday', 'saturday']),

    // Booking Options
     holdFeeAmount: z.coerce.number().nonnegative("Hold fee cannot be negative.").optional().default(0),
     enableHoldOption: z.boolean().default(false),
     enableContactOption: z.boolean().default(true),

}).refine(data => data.maxGuests >= data.baseOccupancy, {
    message: "Max guests must be greater than or equal to base occupancy.",
    path: ["maxGuests"], // Point error to maxGuests field
});


type PropertyFormValues = z.infer<typeof propertyFormSchema>;

const BED_TYPE_LABELS: Record<string, string> = {
  king: 'King',
  queen: 'Queen',
  double: 'Double',
  single: 'Single',
  sofa_bed: 'Sofa Bed',
  bunk: 'Bunk',
  crib: 'Crib',
};

const BED_TYPES = Object.keys(BED_TYPE_LABELS) as Array<keyof typeof BED_TYPE_LABELS>;

type BedEntry = { type: 'king' | 'queen' | 'double' | 'single' | 'sofa_bed' | 'bunk' | 'crib'; count: number };
type RoomConfig = { roomName: string; beds: BedEntry[] };

function BedConfigurationEditor({ value, onChange }: { value: RoomConfig[]; onChange: (val: RoomConfig[]) => void }) {
  const addRoom = () => {
    onChange([...value, { roomName: '', beds: [{ type: 'double', count: 1 }] }]);
  };

  const removeRoom = (roomIndex: number) => {
    onChange(value.filter((_, i) => i !== roomIndex));
  };

  const updateRoom = (roomIndex: number, field: keyof RoomConfig, val: unknown) => {
    const updated = value.map((room, i) => {
      if (i !== roomIndex) return room;
      return { ...room, [field]: val };
    });
    onChange(updated);
  };

  const addBed = (roomIndex: number) => {
    const updated = value.map((room, i) => {
      if (i !== roomIndex) return room;
      return { ...room, beds: [...room.beds, { type: 'single' as const, count: 1 }] };
    });
    onChange(updated);
  };

  const removeBed = (roomIndex: number, bedIndex: number) => {
    const updated = value.map((room, i) => {
      if (i !== roomIndex) return room;
      return { ...room, beds: room.beds.filter((_, bi) => bi !== bedIndex) };
    });
    onChange(updated);
  };

  const updateBed = (roomIndex: number, bedIndex: number, field: keyof BedEntry, val: unknown) => {
    const updated = value.map((room, i) => {
      if (i !== roomIndex) return room;
      return {
        ...room,
        beds: room.beds.map((bed, bi) => {
          if (bi !== bedIndex) return bed;
          return { ...bed, [field]: val };
        }),
      };
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {value.map((room, roomIndex) => (
        <div key={roomIndex} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Room name (e.g., Master Bedroom)"
              value={room.roomName}
              onChange={(e) => updateRoom(roomIndex, 'roomName', e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeRoom(roomIndex)} title="Remove room">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          {room.beds.map((bed, bedIndex) => (
            <div key={bedIndex} className="flex items-center gap-2 ml-4">
              <Select value={bed.type} onValueChange={(v) => updateBed(roomIndex, bedIndex, 'type', v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BED_TYPES.map(t => <SelectItem key={t} value={t}>{BED_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="1"
                value={bed.count}
                onChange={(e) => updateBed(roomIndex, bedIndex, 'count', parseInt(e.target.value) || 1)}
                className="w-[70px]"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeBed(roomIndex, bedIndex)} disabled={room.beds.length <= 1} title="Remove bed">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => addBed(roomIndex)} className="ml-4">
            <Plus className="h-3 w-3 mr-1" /> Add Bed
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addRoom}>
        <Plus className="h-4 w-4 mr-1" /> Add Room
      </Button>
    </div>
  );
}

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
        propertyType: initialData?.propertyType ?? undefined,
        bedConfiguration: initialData?.bedConfiguration ?? [],
        checkInTime: initialData?.checkInTime ?? '',
        checkOutTime: initialData?.checkOutTime ?? '',
        cancellationPolicy: typeof initialData?.cancellationPolicy === 'string' ? initialData.cancellationPolicy : initialData?.cancellationPolicy?.en ?? '',
        status: initialData?.status ?? 'draft',
        ownerId: initialData?.ownerId ?? '', // Handle owner ID logic
        ownerEmail: initialData?.ownerEmail ?? '', // Email for notifications
        contactPhone: initialData?.contactPhone ?? '',
        contactEmail: initialData?.contactEmail ?? '',
        customDomain: initialData?.customDomain ?? null,
        useCustomDomain: initialData?.useCustomDomain ?? false,
        analytics: {
            enabled: initialData?.analytics?.enabled ?? false,
            googleAnalyticsId: initialData?.analytics?.googleAnalyticsId ?? '',
        },
        googlePlaceId: initialData?.googlePlaceId ?? '',
        weekendAdjustmentPercent: initialData?.pricingConfig?.weekendAdjustment
          ? Math.round((initialData.pricingConfig.weekendAdjustment - 1) * 10000) / 100
          : 0,
        weekendDays: initialData?.pricingConfig?.weekendDays ?? ['friday', 'saturday'],
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

    // Convert weekend percentage to multiplier for server action
    const { weekendAdjustmentPercent, weekendDays, ...rest } = values;
    const weekendAdjustment = weekendAdjustmentPercent
      ? 1 + weekendAdjustmentPercent / 100
      : 1;
    const actionValues = {
      ...rest,
      pricingConfig: {
        weekendAdjustment,
        weekendDays: weekendDays ?? ['friday', 'saturday'],
      },
    };

    try {
        let result;
        if (mode === 'create') {
            console.log("Creating property with values:", actionValues);
            result = await createPropertyAction(actionValues);
        } else if (initialData?.slug) { // Ensure slug exists for update
            console.log(`Updating property ${initialData.slug} with values:`, actionValues);
            // Pass the original slug to identify the document
            result = await updatePropertyAction(initialData.slug, actionValues);
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

        <FormField control={form.control} name="propertyType" render={({ field }) => (
          <FormItem>
            <FormLabel>Property Type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select property type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="entire_place">Entire Place</SelectItem>
                <SelectItem value="chalet">Chalet</SelectItem>
                <SelectItem value="cabin">Cabin</SelectItem>
                <SelectItem value="villa">Villa</SelectItem>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="cottage">Cottage</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="bungalow">Bungalow</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>Used in Google structured data for rich results.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Detailed description of the property..." {...field} rows={5} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="shortDescription" render={({ field }) => ( <FormItem><FormLabel>Short Description</FormLabel><FormControl><Input placeholder="A brief summary..." {...field} /></FormControl><FormMessage /></FormItem> )} />
         <FormField control={form.control} name="templateId" render={({ field }) => ( <FormItem><FormLabel>Website Template *</FormLabel><FormControl>
            {/* Replace with actual template selection if needed */}
            <Input {...field} disabled />
            </FormControl><FormDescription>Currently fixed template.</FormDescription><FormMessage /></FormItem> )} />
            
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          Theme, domain, and analytics settings are managed in{' '}
          <a href="/admin/website/settings" className="text-primary underline underline-offset-4 hover:text-primary/80">
            Website &gt; Settings
          </a>.
        </p>

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

        {/* --- Weekend Pricing --- */}
        <div className="rounded-lg border p-4 space-y-4">
          <h4 className="font-medium">Weekend Pricing</h4>
          <p className="text-sm text-muted-foreground">
            Increase nightly rates on selected days. The percentage is applied on top of the base price.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="weekendAdjustmentPercent" render={({ field }) => (
              <FormItem>
                <FormLabel>Weekend Markup (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" placeholder="e.g., 31.55" {...field} />
                </FormControl>
                <FormDescription>
                  {(() => {
                    const pct = Number(form.watch('weekendAdjustmentPercent')) || 0;
                    const base = Number(form.watch('pricePerNight')) || 0;
                    const currency = form.watch('baseCurrency') || 'RON';
                    if (pct > 0 && base > 0) {
                      const weekendPrice = Math.round(base * (1 + pct / 100));
                      return `${base} ${currency} base → ${weekendPrice} ${currency} on weekend days`;
                    }
                    return 'No weekend markup applied';
                  })()}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormItem>
              <FormLabel>Weekend Days</FormLabel>
              <Controller
                control={form.control}
                name="weekendDays"
                render={({ field }) => {
                  const days = [
                    { value: 'monday', label: 'Mon' },
                    { value: 'tuesday', label: 'Tue' },
                    { value: 'wednesday', label: 'Wed' },
                    { value: 'thursday', label: 'Thu' },
                    { value: 'friday', label: 'Fri' },
                    { value: 'saturday', label: 'Sat' },
                    { value: 'sunday', label: 'Sun' },
                  ] as const;
                  const selected = field.value ?? [];
                  return (
                    <div className="flex flex-wrap gap-3 pt-1">
                      {days.map(day => (
                        <label key={day.value} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={selected.includes(day.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...selected, day.value]);
                              } else {
                                field.onChange(selected.filter((d: string) => d !== day.value));
                              }
                            }}
                          />
                          <span className="text-sm">{day.label}</span>
                        </label>
                      ))}
                    </div>
                  );
                }}
              />
              <FormDescription>Days that receive the weekend markup.</FormDescription>
            </FormItem>
          </div>
        </div>

        {/* --- Section: Bed Configuration --- */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Bed Configuration</h3>
        <FormDescription className="mb-4">Optional: specify bed types per room for Google rich results. The total beds count above is used as fallback.</FormDescription>
        <BedConfigurationEditor
          value={form.watch('bedConfiguration') || []}
          onChange={(val) => form.setValue('bedConfiguration', val, { shouldDirty: true })}
        />

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

         {/* --- Section: Booking Options --- */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Booking Options</h3>
         <FormField control={form.control} name="enableHoldOption" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Enable "Hold Dates" Option</FormLabel><FormDescription>Allow guests to pay a fee to hold dates.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />
         <FormField control={form.control} name="holdFeeAmount" render={({ field }) => ( <FormItem><FormLabel>Hold Fee Amount</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 25" {...field} /></FormControl><FormMessage /></FormItem> )} />
         <FormField control={form.control} name="enableContactOption" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Enable "Contact Host" Option</FormLabel><FormDescription>Allow guests to send inquiries.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem> )} />
         <FormField control={form.control} name="ownerEmail" render={({ field }) => ( <FormItem><FormLabel>Owner/Notification Email</FormLabel><FormControl><Input type="email" placeholder="owner@example.com" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Email address to receive inquiry and booking notifications.</FormDescription><FormMessage /></FormItem> )} />

         {/* --- Section: Public Contact Info --- */}
        <Separator className="my-6" />
        <h3 className="text-lg font-medium border-b pb-2">Public Contact Info</h3>
        <p className="text-sm text-muted-foreground">Displayed on the website footer and in Google structured data. If empty, falls back to template defaults.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <FormField control={form.control} name="contactPhone" render={({ field }) => ( <FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input type="tel" placeholder="e.g., +40 722 123 456" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Public phone number for this property.</FormDescription><FormMessage /></FormItem> )} />
         <FormField control={form.control} name="contactEmail" render={({ field }) => ( <FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" placeholder="e.g., bookings@yourproperty.com" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Public email for this property.</FormDescription><FormMessage /></FormItem> )} />
        </div>

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
