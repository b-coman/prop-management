// src/app/admin/bookings/_components/external-booking-form.tsx
"use client";

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getCountryOptions, normalizeCountryCode } from '@/lib/country-utils';
import { createExternalBookingAction, editBookingAction } from '../actions';
import type { Booking } from '@/types';

const SOURCES = [
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'booking.com', label: 'Booking.com' },
  { value: 'vrbo', label: 'Vrbo' },
  { value: 'direct', label: 'Direct' },
  { value: 'other', label: 'Other' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ro', label: 'Romanian' },
];

const COUNTRIES = getCountryOptions();

/** Strip spaces, parens, dashes from phone; keep + and digits */
function cleanPhone(raw: string): string {
  // Strip invisible Unicode: zero-width chars, bidi controls (WhatsApp injects these), BOM
  return raw
    .replace(/\uFF0B/g, '+')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/[\s()\-./]/g, '');
}

const formSchema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
  source: z.string().min(1, 'Source is required'),
  externalId: z.string().optional(),
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  bookedAt: z.string().optional(),
  numberOfGuests: z.coerce.number().int().min(1).default(1),
  numberOfAdults: z.coerce.number().int().min(1).optional(),
  numberOfChildren: z.coerce.number().int().min(0).optional(),
  netPayout: z.coerce.number().min(0, 'Net payout must be 0 or more'),
  currency: z.string().min(1),
  language: z.string().min(1).default('en'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().transform(v => v ? cleanPhone(v) : v).refine(
    v => !v || /^\+\d{7,15}$/.test(v),
    { message: 'Phone must start with + and country code (e.g. +40723...)' }
  ),
  country: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ExternalBookingFormProps {
  mode: 'create' | 'edit';
  booking?: Booking;
  properties: Array<{ id: string; name: string; currency: string }>;
  onSuccess?: () => void;
  compact?: boolean;
}

function parseDateStr(val: string | null | undefined): Date | undefined {
  if (!val) return undefined;
  try {
    const d = parseISO(val);
    return isNaN(d.getTime()) ? undefined : d;
  } catch {
    return undefined;
  }
}

export function ExternalBookingForm({ mode, booking, properties, onSuccess, compact }: ExternalBookingFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const defaultProperty = properties[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: mode === 'edit' && booking ? {
      propertyId: booking.propertyId,
      source: booking.source || '',
      externalId: booking.externalId || '',
      checkInDate: booking.checkInDate ? String(booking.checkInDate).split('T')[0] : '',
      checkOutDate: booking.checkOutDate ? String(booking.checkOutDate).split('T')[0] : '',
      bookedAt: booking.bookedAt ? String(booking.bookedAt).split('T')[0] : '',
      numberOfGuests: booking.numberOfGuests || 1,
      numberOfAdults: booking.numberOfAdults || undefined,
      numberOfChildren: booking.numberOfChildren || undefined,
      netPayout: booking.pricing?.total || 0,
      currency: booking.pricing?.currency || defaultProperty?.currency || 'RON',
      language: booking.language || 'en',
      firstName: booking.guestInfo?.firstName || '',
      lastName: booking.guestInfo?.lastName || '',
      email: booking.guestInfo?.email || '',
      phone: booking.guestInfo?.phone || '',
      country: booking.guestInfo?.country || '',
      notes: booking.notes || '',
    } : {
      propertyId: defaultProperty?.id || '',
      source: '',
      externalId: '',
      checkInDate: '',
      checkOutDate: '',
      bookedAt: format(new Date(), 'yyyy-MM-dd'),
      numberOfGuests: 1,
      netPayout: 0,
      currency: defaultProperty?.currency || 'RON',
      language: 'en',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      country: '',
      notes: '',
    },
  });

  const watchCheckIn = form.watch('checkInDate');
  const watchCheckOut = form.watch('checkOutDate');
  const watchPropertyId = form.watch('propertyId');

  const nights = React.useMemo(() => {
    const ci = parseDateStr(watchCheckIn);
    const co = parseDateStr(watchCheckOut);
    if (ci && co && co > ci) return differenceInCalendarDays(co, ci);
    return 0;
  }, [watchCheckIn, watchCheckOut]);

  // Update currency when property changes
  React.useEffect(() => {
    const prop = properties.find(p => p.id === watchPropertyId);
    if (prop) {
      form.setValue('currency', prop.currency);
    }
  }, [watchPropertyId, properties, form]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      if (mode === 'create') {
        const result = await createExternalBookingAction(values);
        if (result.success) {
          toast({ title: 'Booking Created', description: `Booking ${result.bookingId?.substring(0, 8)}... created successfully.` });
          onSuccess?.();
          if (!compact) router.push('/admin/bookings');
        } else {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
      } else if (booking) {
        const result = await editBookingAction({ ...values, bookingId: booking.id });
        if (result.success) {
          toast({ title: 'Booking Updated', description: 'Booking updated successfully.' });
          onSuccess?.();
          router.refresh();
        } else {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
      }
    });
  };

  if (compact) {
    return <CompactForm form={form} mode={mode} properties={properties} nights={nights} isPending={isPending} onSubmit={onSubmit} onCancel={onSuccess} />;
  }

  return <FullForm form={form} mode={mode} properties={properties} nights={nights} isPending={isPending} onSubmit={onSubmit} onCancel={onSuccess || (() => router.back())} />;
}

// ============================================================
// Compact layout — fits in a dialog without scrolling
// ============================================================

const compactInput = "h-9 border border-gray-300";

function CompactForm({ form, mode, properties, nights, isPending, onSubmit, onCancel }: FormLayoutProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Row 1: Property, Source, Confirmation Code */}
        <div className="grid grid-cols-3 gap-3">
          <FormField control={form.control} name="propertyId" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Property</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={mode === 'edit'}>
                <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                <SelectContent>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="source" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Source</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="externalId" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Confirmation Code</FormLabel>
              <FormControl><Input className={compactInput} placeholder="e.g. HM5ABC123" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <Separator />

        {/* Row 2: Check-in, Check-out, Guests, Booking Date */}
        <div className="grid grid-cols-4 gap-3">
          <FormField control={form.control} name="checkInDate" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-xs">Check-in</FormLabel>
              <DatePickerField value={field.value} onChange={field.onChange} compact />
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="checkOutDate" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-xs">
                Check-out {nights > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{nights}n</Badge>}
              </FormLabel>
              <DatePickerField value={field.value} onChange={field.onChange} compact />
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="numberOfGuests" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-xs">Guests</FormLabel>
              <FormControl><Input className={compactInput} type="number" min={1} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="bookedAt" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-xs">Booked on</FormLabel>
              <DatePickerField value={field.value || ''} onChange={field.onChange} compact />
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <Separator />

        {/* Row 3: Guest Info */}
        <div className="grid grid-cols-4 gap-3">
          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">First Name *</FormLabel>
              <FormControl><Input className={compactInput} placeholder="Guest first name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Last Name</FormLabel>
              <FormControl><Input className={compactInput} placeholder="Guest last name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Email</FormLabel>
              <FormControl><Input className={compactInput} type="email" placeholder="guest@email.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Phone</FormLabel>
              <FormControl>
                <Input className={compactInput} type="tel" placeholder="+40723..."
                  {...field}
                  onBlur={(e) => { field.onBlur(); form.setValue('phone', cleanPhone(e.target.value)); }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <Separator />

        {/* Row 4: Pricing + Misc */}
        <div className="grid grid-cols-5 gap-3">
          <FormField control={form.control} name="netPayout" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Net Payout</FormLabel>
              <FormControl><Input className={compactInput} type="number" step="0.01" min={0} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="currency" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Currency</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="RON">RON</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="language" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Language</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <CountryField form={form} compact />
        </div>

        {/* Notes — full width */}
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Notes</FormLabel>
            <FormControl><Input className={compactInput} placeholder="Optional notes about this booking" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create Booking' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ============================================================
// Full layout — used on the standalone page and edit dialog
// ============================================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormDescription } from '@/components/ui/form';

interface FormLayoutProps {
  form: ReturnType<typeof useForm<FormValues>>;
  mode: 'create' | 'edit';
  properties: Array<{ id: string; name: string; currency: string }>;
  nights: number;
  isPending: boolean;
  onSubmit: (values: FormValues) => void;
  onCancel?: () => void;
}

function FullForm({ form, mode, properties, nights, isPending, onSubmit, onCancel }: FormLayoutProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Property & Source */}
        <Card>
          <CardHeader><CardTitle className="text-base">Property & Source</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField control={form.control} name="propertyId" render={({ field }) => (
              <FormItem>
                <FormLabel>Property</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={mode === 'edit'}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="source" render={({ field }) => (
              <FormItem>
                <FormLabel>Source</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {SOURCES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="externalId" render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmation Code</FormLabel>
                <FormControl><Input placeholder="e.g. HM5ABC123" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Dates & Guests */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Dates & Guests</CardTitle>
              {nights > 0 && <Badge variant="secondary">{nights} night{nights !== 1 ? 's' : ''}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormField control={form.control} name="checkInDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Check-in</FormLabel>
                <DatePickerField value={field.value} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="checkOutDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Check-out</FormLabel>
                <DatePickerField value={field.value} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="numberOfGuests" render={({ field }) => (
              <FormItem>
                <FormLabel>Total Guests</FormLabel>
                <FormControl><Input type="number" min={1} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="bookedAt" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Booking Date</FormLabel>
                <DatePickerField value={field.value || ''} onChange={field.onChange} />
                <FormDescription>When reservation was made</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Pricing & Language */}
        <Card>
          <CardHeader><CardTitle className="text-base">Pricing & Communication</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField control={form.control} name="netPayout" render={({ field }) => (
              <FormItem>
                <FormLabel>Net Payout</FormLabel>
                <FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl>
                <FormDescription>Revenue after platform commission</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="currency" render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="RON">RON</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="language" render={({ field }) => (
              <FormItem>
                <FormLabel>Language</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormDescription>For guest communications</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Guest Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Guest Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField control={form.control} name="firstName" render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="lastName" render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="+40723..."
                    {...field}
                    onBlur={(e) => { field.onBlur(); form.setValue('phone', cleanPhone(e.target.value)); }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <CountryField form={form} />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormControl><Textarea placeholder="Optional notes..." rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create Booking' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * Country field — Select with common countries + "Other" shows a text input.
 */
function CountryField({ form, compact }: { form: ReturnType<typeof useForm<FormValues>>; compact?: boolean }) {
  const value = form.watch('country');
  const isOther = !!value && !COUNTRIES.some(c => c.code === value);
  const [showCustom, setShowCustom] = React.useState(isOther);

  if (showCustom) {
    return (
      <FormField control={form.control} name="country" render={({ field }) => (
        <FormItem>
          <FormLabel className={compact ? 'text-xs' : undefined}>Country</FormLabel>
          <div className="flex gap-1">
            <FormControl>
              <Input className={compact ? compactInput : undefined} placeholder="Type country"
                {...field}
                onBlur={(e) => {
                  field.onBlur();
                  const normalized = normalizeCountryCode(e.target.value);
                  if (normalized) form.setValue('country', normalized);
                }}
              />
            </FormControl>
            <Button type="button" variant="ghost" size="sm" className={compact ? 'h-9 px-2 text-xs' : 'px-2'}
              onClick={() => { form.setValue('country', ''); setShowCustom(false); }}>
              List
            </Button>
          </div>
          <FormMessage />
        </FormItem>
      )} />
    );
  }

  return (
    <FormField control={form.control} name="country" render={({ field }) => (
      <FormItem>
        <FormLabel className={compact ? 'text-xs' : undefined}>Country</FormLabel>
        <Select onValueChange={(v) => {
          if (v === '__other__') { setShowCustom(true); form.setValue('country', ''); }
          else field.onChange(v);
        }} value={field.value || ''}>
          <FormControl><SelectTrigger className={compact ? 'h-9' : undefined}><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
          <SelectContent>
            {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            <SelectItem value="__other__">Other...</SelectItem>
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}

/**
 * Date picker field using Calendar + Popover.
 */
function DatePickerField({ value, onChange, compact }: { value: string; onChange: (val: string) => void; compact?: boolean }) {
  const date = parseDateStr(value);

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn(
          'w-full justify-start text-left font-normal',
          compact && 'h-9 text-xs',
          !date && 'text-muted-foreground'
        )}>
          <CalendarIcon className={cn('mr-2', compact ? 'h-3 w-3' : 'h-4 w-4')} />
          {date ? format(date, compact ? 'dd MMM yyyy' : 'PPP') : 'Pick a date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[60]" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { if (d) onChange(format(d, 'yyyy-MM-dd')); }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
