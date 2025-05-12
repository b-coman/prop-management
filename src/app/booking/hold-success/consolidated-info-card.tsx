import { format } from 'date-fns';
import { Clock, Info, Loader2, RefreshCw, Users } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { Booking, Property } from '@/types';

interface ConsolidatedInfoCardProps {
  booking: Booking;
  property: Property | null;
  sessionId: string | null;
  verifying: boolean;
  verifyBookingStatus: () => Promise<void>;
}

export function ConsolidatedInfoCard({
  booking,
  property,
  sessionId,
  verifying,
  verifyBookingStatus
}: ConsolidatedInfoCardProps) {
  // Format dates for display
  const formatDate = (date: any, formatString: string = 'MMM d, yyyy') => {
    if (!date) return 'N/A';
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return format(dateObj, formatString);
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Calculate expiration time
  const calculateHoldUntil = (booking: Booking) => {
    if (!booking.holdUntil) return 'N/A';
    
    try {
      const holdUntilDate = booking.holdUntil instanceof Date 
        ? booking.holdUntil 
        : new Date(booking.holdUntil);
      
      return format(holdUntilDate, 'MMM d, yyyy h:mm a');
    } catch (e) {
      return 'N/A';
    }
  };

  // Format currency for display
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm">
      {/* Header - Property Information */}
      {property && (
        <div className="p-4 bg-slate-100 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-md overflow-hidden flex-shrink-0">
              {property.images && property.images.length > 0 && property.images[0].url ? (
                <img
                  src={property.images[0].url}
                  alt={property.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  No image
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">{property.name}</h3>
              {property.location && (
                <p className="text-sm text-slate-600">
                  {property.location.city}{property.location.city && property.location.country && ", "}
                  {property.location.country}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Main content - Hold Details */}
      <div className="p-4">
        <div className="space-y-4">
          {/* Date information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start space-x-2">
              <div className="h-5 w-5 text-primary flex-shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Check-in</h3>
                <p className="font-medium">{formatDate(booking.checkInDate)}</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <div className="h-5 w-5 text-primary flex-shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">Check-out</h3>
                <p className="font-medium">{formatDate(booking.checkOutDate)}</p>
              </div>
            </div>
          </div>
          
          {/* Hold expiration */}
          <div className="flex items-start space-x-2 p-3 border border-amber-200 bg-amber-50 rounded-md">
            <Clock className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-700">Hold Expires</h3>
              <p className="font-medium text-amber-900">{calculateHoldUntil(booking)}</p>
              <p className="text-sm text-amber-600">
                Complete your booking before this time to secure these dates
              </p>
            </div>
          </div>
          
          <Separator className="bg-slate-200" />
          
          {/* Hold & Guest Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left column - Hold Information */}
            <div className="flex items-start space-x-2">
              <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">Hold Information</h3>
                <p className="text-sm">Booking ID: <span className="font-medium">{booking.id}</span></p>
                
                {/* Payment status indicator */}
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                    booking.paymentInfo?.status === 'succeeded' 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {booking.paymentInfo?.status === 'succeeded' 
                      ? 'Payment Confirmed' 
                      : 'Payment Processing'}
                  </span>
                  
                  {/* Add verification button if payment not confirmed */}
                  {booking.paymentInfo?.status !== 'succeeded' && (
                    <button 
                      className="ml-2 text-primary hover:text-primary/80 inline-flex items-center text-xs"
                      onClick={verifyBookingStatus}
                      disabled={verifying}
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Verify Status
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Right column - Guest Information */}
            <div className="flex items-start space-x-2">
              <Users className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">Guest Information</h3>
                <p className="text-sm">{booking.guestInfo?.firstName} {booking.guestInfo?.lastName}</p>
              </div>
            </div>
          </div>
          
          <Separator className="bg-slate-200" />
          
          {/* Payment details */}
          <div className="flex items-start space-x-2">
            <div className="h-5 w-5 text-primary flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-sm">Payment Details</h3>
              
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Hold fee</span>
                  <span>{formatCurrency(booking.paymentInfo?.amount || booking.holdFee || 0, booking.pricing?.currency || 'EUR')}</span>
                </div>
                <div className="flex justify-between font-medium text-sm">
                  <span>Total Paid</span>
                  <span className="text-primary">{formatCurrency(booking.paymentInfo?.amount || booking.holdFee || 0, booking.pricing?.currency || 'EUR')}</span>
                </div>
              </div>
              
              <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                {sessionId && (
                  <p>Reference: {sessionId.substring(0, 12)}...</p>
                )}
                {(booking.holdPaymentId || booking.paymentInfo?.stripePaymentIntentId) && (
                  <p>
                    Payment ID: {(booking.holdPaymentId || booking.paymentInfo?.stripePaymentIntentId || '').substring(0, 12)}...
                  </p>
                )}
                {booking.paymentInfo?.paidAt && (
                  <p>
                    Paid on: {formatDate(booking.paymentInfo.paidAt, 'MMM d, yyyy h:mm a')}
                  </p>
                )}
                
                <p className="text-xs text-amber-600 mt-1">
                  Your hold fee {booking.holdFeeRefundable ? 'is refundable when you complete your booking' : 'is non-refundable'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}