// src/app/admin/bookings/[bookingId]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, parseISO, formatDistanceToNow, isPast } from 'date-fns';
import { ArrowLeft, Mail, Phone, ExternalLink } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AdminPage } from '@/components/admin';
import { BookingStatusUpdate } from '../_components/booking-status-update';
import { ExtendHoldDialog } from '../_components/extend-hold-dialog';
import { CancelHoldButton } from '../_components/cancel-hold-button';
import { ConvertHoldButton } from '../_components/convert-hold-button';
import { EditBookingDialog } from '../_components/edit-booking-dialog';
import { CancelBookingButton } from '../_components/cancel-booking-button';
import { fetchBookingById, fetchPropertiesForBookingForm } from '../actions';
import type { SerializableTimestamp } from '@/types';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  try { return parseISO(String(dateStr)); } catch { return null; }
};

const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'pending': return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'on-hold': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
    case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
    case 'payment_failed': return 'bg-red-200 text-red-900 border-red-400';
    case 'completed': return 'bg-blue-100 text-blue-800 border-blue-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getPaymentStatusColor = (status?: string): string => {
  switch (status) {
    case 'succeeded':
    case 'paid': return 'bg-green-100 text-green-800 border-green-300';
    case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'failed': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

interface PageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { bookingId } = await params;
  const [booking, properties] = await Promise.all([
    fetchBookingById(bookingId),
    fetchPropertiesForBookingForm(),
  ]);

  if (!booking) {
    notFound();
  }

  const status = booking.status || 'unknown';
  const checkInDate = parseDateSafe(booking.checkInDate);
  const checkOutDate = parseDateSafe(booking.checkOutDate);
  const holdUntilDate = parseDateSafe(booking.holdUntil);
  const createdAtDate = parseDateSafe(booking.createdAt);
  const bookedAtDate = parseDateSafe(booking.bookedAt);
  const cancelledAtDate = parseDateSafe(booking.cancelledAt);
  const paidAtDate = parseDateSafe(booking.paymentInfo?.paidAt);
  const isHoldExpired = holdUntilDate ? isPast(holdUntilDate) : false;
  const canEdit = ['confirmed', 'completed'].includes(status);
  const canCancel = ['confirmed', 'completed'].includes(status);
  const { guestInfo, pricing, paymentInfo } = booking;
  const currency = pricing?.currency || 'EUR';

  return (
    <AdminPage
      title="Booking Details"
      description={`${bookingId.substring(0, 8)}... · ${booking.propertyId} · Created ${createdAtDate ? format(createdAtDate, 'PPP') : 'N/A'}`}
      actions={
        <div className="flex items-center gap-2">
          {canEdit && <EditBookingDialog booking={booking} properties={properties} />}
          {canCancel && <CancelBookingButton bookingId={booking.id} />}
          <BookingStatusUpdate bookingId={booking.id} currentStatus={status} />
        </div>
      }
    >
      {/* Back link */}
      <div className="-mt-4">
        <Button variant="link" className="px-0 text-muted-foreground" asChild>
          <Link href="/admin/bookings">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Bookings
          </Link>
        </Button>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Guest Information */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Guest Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{guestInfo.firstName} {guestInfo.lastName || ''}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <a href={`mailto:${guestInfo.email}`} className="font-medium text-primary hover:underline inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {guestInfo.email}
                </a>
              </div>
              {guestInfo.phone && (
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {guestInfo.phone}
                  </p>
                </div>
              )}
              {(guestInfo.address || guestInfo.city || guestInfo.country) && (
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">
                    {[guestInfo.address, guestInfo.city, guestInfo.state, guestInfo.zipCode, guestInfo.country]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stay Details */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Stay Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Property</p>
                <Link href={`/admin/properties/${booking.propertyId}/edit`} className="font-medium text-primary hover:underline inline-flex items-center gap-1">
                  {booking.propertyId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Check-in</p>
                  <p className="font-medium">{checkInDate ? format(checkInDate, 'PPP') : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-out</p>
                  <p className="font-medium">{checkOutDate ? format(checkOutDate, 'PPP') : '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nights</p>
                  <p className="font-medium">{pricing?.numberOfNights || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Guests</p>
                  <p className="font-medium">{booking.numberOfGuests}</p>
                </div>
              </div>
              {booking.source && (
                <div>
                  <p className="text-sm text-muted-foreground">Source</p>
                  <p className="font-medium capitalize">{booking.source}</p>
                </div>
              )}
              {booking.externalId && (
                <div>
                  <p className="text-sm text-muted-foreground">Confirmation Code</p>
                  <p className="font-medium font-mono">{booking.externalId}</p>
                </div>
              )}
              {bookedAtDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Booked On</p>
                  <p className="font-medium">{format(bookedAtDate, 'PPP')}</p>
                </div>
              )}
              {cancelledAtDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Cancelled On</p>
                  <p className="font-medium text-destructive">{format(cancelledAtDate, 'PPP')}</p>
                </div>
              )}
              {booking.language && (
                <div>
                  <p className="text-sm text-muted-foreground">Language</p>
                  <p className="font-medium uppercase">{booking.language}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Pricing Breakdown */}
          {pricing && (
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-base">Pricing Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{formatCurrency(pricing.baseRate, currency)} x {pricing.numberOfNights} night{pricing.numberOfNights !== 1 ? 's' : ''}</span>
                  <span>{formatCurrency(pricing.baseRate * pricing.numberOfNights, currency)}</span>
                </div>
                {pricing.extraGuestFee != null && pricing.extraGuestFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Extra guest fee{pricing.numberOfExtraGuests ? ` (${pricing.numberOfExtraGuests} extra)` : ''}</span>
                    <span>{formatCurrency(pricing.extraGuestFee, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Accommodation total</span>
                  <span>{formatCurrency(pricing.accommodationTotal, currency)}</span>
                </div>
                {pricing.cleaningFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Cleaning fee</span>
                    <span>{formatCurrency(pricing.cleaningFee, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(pricing.subtotal, currency)}</span>
                </div>
                {pricing.taxes != null && pricing.taxes > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Taxes</span>
                    <span>{formatCurrency(pricing.taxes, currency)}</span>
                  </div>
                )}
                {pricing.discountAmount != null && pricing.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Discount{booking.appliedCouponCode ? ` (${booking.appliedCouponCode})` : ''}</span>
                    <span>-{formatCurrency(pricing.discountAmount, currency)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(pricing.total, currency)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Info */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Payment Status</p>
                <Badge variant="outline" className={cn('capitalize', getPaymentStatusColor(paymentInfo?.status))}>
                  {paymentInfo?.status || 'unknown'}
                </Badge>
              </div>
              {paymentInfo?.stripePaymentIntentId && (
                <div>
                  <p className="text-sm text-muted-foreground">Stripe Payment Intent</p>
                  <p className="font-mono text-sm break-all">{paymentInfo.stripePaymentIntentId}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Amount Paid</p>
                <p className="font-medium">{formatCurrency(paymentInfo?.amount || 0, currency)}</p>
              </div>
              {paidAtDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Paid At</p>
                  <p className="font-medium">{format(paidAtDate, 'PPP p')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hold Details (only for on-hold bookings) */}
          {status === 'on-hold' && (
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-base">Hold Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {booking.holdFee != null && (
                  <div>
                    <p className="text-sm text-muted-foreground">Hold Fee</p>
                    <p className="font-medium">{formatCurrency(booking.holdFee, currency)}</p>
                  </div>
                )}
                {holdUntilDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Hold Expires</p>
                    <p className={cn('font-medium', isHoldExpired && 'text-destructive')}>
                      {format(holdUntilDate, 'PPP p')} ({formatDistanceToNow(holdUntilDate, { addSuffix: true })})
                      {isHoldExpired && ' (Expired)'}
                    </p>
                  </div>
                )}
                {booking.holdPaymentId && (
                  <div>
                    <p className="text-sm text-muted-foreground">Hold Payment ID</p>
                    <p className="font-mono text-sm break-all">{booking.holdPaymentId}</p>
                  </div>
                )}
                {booking.convertedFromHold && (
                  <div>
                    <p className="text-sm text-muted-foreground">Converted from Hold</p>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Yes</Badge>
                  </div>
                )}
              </CardContent>
              <CardFooter className="gap-2 flex-wrap">
                <ExtendHoldDialog bookingId={booking.id} currentHoldUntil={holdUntilDate} />
                <CancelHoldButton bookingId={booking.id} />
                <ConvertHoldButton bookingId={booking.id} />
              </CardFooter>
            </Card>
          )}
        </div>
      </div>

      {/* Notes section (full width) */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {booking.notes ? (
            <pre className="whitespace-pre-wrap text-sm font-sans">{booking.notes}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">No notes</p>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
