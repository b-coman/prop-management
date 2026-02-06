// src/app/admin/properties/[slug]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarCheck,
  DollarSign,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Edit,
  ArrowLeft,
  ArrowRight,
  Sliders,
  CalendarDays,
  Rss,
  Users,
  BedDouble,
  Bath,
  Clock,
  ImageIcon,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AdminPage } from '@/components/admin';
import { fetchPropertyOverview } from './actions';

export const dynamic = 'force-dynamic';

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 border-green-300';
    case 'inactive': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'draft': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getBookingStatusColor = (status?: string): string => {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
    case 'completed': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'on-hold': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
    case 'pending': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PropertyOverviewPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await fetchPropertyOverview(slug);

  if (!data) {
    notFound();
  }

  const { property, metrics, recentBookings, upcomingCheckIns, upcomingCheckOuts } = data;

  // Change indicator
  function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
    if (previous === 0 && current > 0) {
      return (
        <span className="text-xs text-green-600 flex items-center gap-0.5">
          <TrendingUp className="h-3 w-3" />
          +{current} new
        </span>
      );
    }
    if (previous > 0) {
      const pct = Math.round(((current - previous) / previous) * 100);
      const isUp = pct >= 0;
      return (
        <span className={`text-xs flex items-center gap-0.5 ${isUp ? 'text-green-600' : 'text-red-600'}`}>
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isUp ? '+' : ''}{pct}% vs last month
        </span>
      );
    }
    return null;
  }

  return (
    <AdminPage
      title={property.name}
      description={`${property.location} ${property.status ? '' : ''}`}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`capitalize ${getStatusColor(property.status)}`}>
            {property.status}
          </Badge>
          <Link href={`/admin/properties/${slug}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" /> Edit Property
            </Button>
          </Link>
        </div>
      }
    >
      {/* Back link */}
      <div className="-mt-4">
        <Button variant="link" className="px-0 text-muted-foreground" asChild>
          <Link href="/admin/properties">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Properties
          </Link>
        </Button>
      </div>

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalBookings}</div>
            <p className="text-xs text-muted-foreground">{metrics.bookingsThisMonth} this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.revenueThisMonth, property.baseCurrency)}</div>
            <ChangeIndicator current={metrics.revenueThisMonth} previous={metrics.revenueLastMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Occupancy</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.occupancyThisMonth}%</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Inquiries</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingInquiries}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Property Details */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Property Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Price per Night</p>
                  <p className="font-medium">{formatCurrency(property.pricePerNight, property.baseCurrency)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Currency</p>
                  <p className="font-medium">{property.baseCurrency}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Max Guests</p>
                    <p className="font-medium">{property.maxGuests}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Base Occupancy</p>
                  <p className="font-medium">{property.baseOccupancy}</p>
                </div>
              </div>
              {(property.bedrooms || property.bathrooms) && (
                <div className="grid grid-cols-2 gap-3">
                  {property.bedrooms != null && (
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Bedrooms</p>
                        <p className="font-medium">{property.bedrooms}</p>
                      </div>
                    </div>
                  )}
                  {property.bathrooms != null && (
                    <div className="flex items-center gap-2">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Bathrooms</p>
                        <p className="font-medium">{property.bathrooms}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(property.checkInTime || property.checkOutTime) && (
                <div className="grid grid-cols-2 gap-3">
                  {property.checkInTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Check-in</p>
                        <p className="font-medium">{property.checkInTime}</p>
                      </div>
                    </div>
                  )}
                  {property.checkOutTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Check-out</p>
                        <p className="font-medium">{property.checkOutTime}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Activity */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Upcoming Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingCheckIns.length === 0 && upcomingCheckOuts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming activity in the next 7 days</p>
              ) : (
                <div className="space-y-4">
                  {upcomingCheckIns.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Check-ins</p>
                      <div className="space-y-2">
                        {upcomingCheckIns.map(item => (
                          <Link
                            key={item.id}
                            href={`/admin/bookings/${item.id}`}
                            className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-md transition-colors"
                          >
                            <span className="text-sm font-medium">{item.guestName}</span>
                            <Badge variant="outline" className="text-xs">{item.date}</Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {upcomingCheckIns.length > 0 && upcomingCheckOuts.length > 0 && <Separator />}
                  {upcomingCheckOuts.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Check-outs</p>
                      <div className="space-y-2">
                        {upcomingCheckOuts.map(item => (
                          <Link
                            key={item.id}
                            href={`/admin/bookings/${item.id}`}
                            className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-md transition-colors"
                          >
                            <span className="text-sm font-medium">{item.guestName}</span>
                            <Badge variant="outline" className="text-xs">{item.date}</Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Recent Bookings */}
          <Card className="bg-muted/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Bookings</CardTitle>
              <Link href={`/admin/bookings`}>
                <Button variant="ghost" size="sm" className="text-xs">
                  View All <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet</p>
              ) : (
                <div className="space-y-3">
                  {recentBookings.map(booking => (
                    <Link
                      key={booking.id}
                      href={`/admin/bookings/${booking.id}`}
                      className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-md transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{booking.guestName}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.checkInDate ? new Date(booking.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                          {' - '}
                          {booking.checkOutDate ? new Date(booking.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <Badge variant="outline" className={`text-xs capitalize ${getBookingStatusColor(booking.status)}`}>
                          {booking.status}
                        </Badge>
                        <span className="text-sm font-medium">{formatCurrency(booking.total, booking.currency)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/admin/properties/${slug}/images`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Manage Images</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link href={`/admin/pricing`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Manage Pricing</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link href={`/admin/calendar`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">View Calendar</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link href={`/admin/bookings`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">View Bookings</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link href={`/admin/inquiries`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">View Inquiries</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <div className="flex items-center justify-between p-2">
                <div className="flex items-center gap-2">
                  <Rss className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">iCal Feeds</span>
                </div>
                <Badge variant="outline">{metrics.activeICalFeeds}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
