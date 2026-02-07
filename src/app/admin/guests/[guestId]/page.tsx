import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { AdminPage } from '@/components/admin/AdminPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Mail, Phone, Globe, Eye } from 'lucide-react';
import { fetchGuestDetailAction } from '../actions';
import type { SerializableTimestamp } from '@/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ guestId: string }>;
}

const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string') {
    try {
      return parseISO(dateStr);
    } catch {
      return null;
    }
  }
  return null;
};

const formatDateSafe = (dateStr: SerializableTimestamp | null | undefined): string => {
  const d = parseDateSafe(dateStr);
  if (!d || isNaN(d.getTime())) return '-';
  return format(d, 'MMM d, yyyy');
};

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(amount);
};

export default async function GuestDetailPage({ params }: PageProps) {
  const { guestId } = await params;
  const data = await fetchGuestDetailAction(guestId);

  if (!data) {
    notFound();
  }

  const { guest, bookings } = data;

  return (
    <AdminPage
      title={`${guest.firstName} ${guest.lastName || ''}`}
      description={`Guest details and booking history`}
    >
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/guests">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Guests
          </Link>
        </Button>

        {/* Guest Info Card */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {guest.email ? (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{guest.email}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="italic">No email</span>
                </div>
              )}
              {guest.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{guest.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span>{guest.language === 'ro' ? 'Romanian' : 'English'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Subscription:</span>
                {guest.unsubscribed ? (
                  <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                    Unsubscribed
                    {guest.unsubscribedAt && ` on ${formatDateSafe(guest.unsubscribedAt)}`}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                    Subscribed
                  </Badge>
                )}
              </div>
              {guest.sources && guest.sources.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Sources:</span>
                  <div className="flex flex-wrap gap-1">
                    {guest.sources.map((src) => (
                      <Badge key={src} variant="outline" className="text-xs">
                        {src}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Total Bookings</dt>
                  <dd className="text-2xl font-semibold">{guest.totalBookings || 0}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total Spent</dt>
                  <dd className="text-2xl font-semibold">
                    {formatCurrency(guest.totalSpent || 0, guest.currency || 'EUR')}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">First Booking</dt>
                  <dd className="font-medium">{formatDateSafe(guest.firstBookingDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last Stay</dt>
                  <dd className="font-medium">{formatDateSafe(guest.lastStayDate || guest.lastBookingDate)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            {guest.tags && guest.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {guest.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tags assigned.</p>
            )}
          </CardContent>
        </Card>

        {/* Booking History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Booking History</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings found.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.propertyId}</TableCell>
                        <TableCell>{formatDateSafe(booking.checkInDate)}</TableCell>
                        <TableCell>{formatDateSafe(booking.checkOutDate)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              booking.status === 'confirmed' || booking.status === 'completed'
                                ? 'default'
                                : booking.status === 'cancelled'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="text-xs"
                          >
                            {booking.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {booking.source && (
                            <Badge variant="outline" className="text-xs">
                              {booking.source}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            booking.pricing?.total || 0,
                            booking.pricing?.currency || 'EUR'
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/admin/bookings/${booking.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}
