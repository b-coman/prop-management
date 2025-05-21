
// src/components/booking/availability-status.tsx
// OBSOLETE: This component is deprecated. Please use the version in sections/availability/ instead.
// This file will be moved to /src/archive in a future cleanup.
"use client";

import * as React from 'react';
import { format, differenceInDays } from 'date-fns';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Info,
  Mail,
  Phone,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AvailabilityCalendar } from './availability-calendar';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import type { CurrencyCode } from '@/types';

interface AvailabilityStatusProps {
  isLoadingAvailability: boolean;
  isAvailable: boolean | null;
  datesSelected: boolean;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  numberOfNights: number;
  suggestedDates: Array<{ from: Date; to: Date; recommendation?: string }>;
  unavailableDates: Date[];
  handleSelectAlternativeDate: (range: { from: Date; to: Date }) => void;
  propertySlug: string;
  email: string;
  setEmail: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  isProcessingBooking: boolean; // To disable notify button
}

export function AvailabilityStatus({
  // @deprecated Use the container-based implementation instead
  isLoadingAvailability,
  isAvailable,
  datesSelected,
  checkInDate,
  checkOutDate,
  numberOfNights,
  suggestedDates,
  unavailableDates,
  handleSelectAlternativeDate,
  propertySlug,
  email,
  setEmail,
  phone,
  setPhone,
  isProcessingBooking,
}: AvailabilityStatusProps) {
  // Add PROMINENT debug log to track component rendering
  console.log(`%c[TRACK_RENDERED_COMPONENT] AvailabilityStatus RENDERED at ${new Date().toISOString()}`, 'color: purple; font-weight: bold; font-size: 14px;');
  console.log(`%c[TRACK_RENDERED_COMPONENT] Props:`, 'color: purple;', {
    isLoadingAvailability,
    isAvailable,
    datesSelected,
    checkInDate: checkInDate?.toISOString(),
    checkOutDate: checkOutDate?.toISOString(),
    numberOfNights,
    unavailableDates: unavailableDates?.length,
    propertySlug
  });
  
  const { t } = useLanguage();

  // Track loading time for better UX
  const [longLoading, setLongLoading] = React.useState(false);

  // Set a flag if loading takes more than 3 seconds
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoadingAvailability) {
      timeoutId = setTimeout(() => {
        setLongLoading(true);
      }, 3000);
    } else {
      setLongLoading(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoadingAvailability]);
  const [notifyAvailability, setNotifyAvailability] = React.useState(false);
  const [notificationMethod, setNotificationMethod] = React.useState<'email' | 'sms'>('email');
  const { toast } = useToast();
  const [isSubmittingNotification, setIsSubmittingNotification] = React.useState(false); // Separate loading state

  const handleNotifyAvailabilitySubmit = async () => {
    if (!datesSelected || !checkInDate || !checkOutDate) return;

    if (notificationMethod === 'email' && !email) {
      toast({ title: t('errors.genericError'), description: t('forms.invalidEmail'), variant: "destructive" });
      return;
    }
    if (notificationMethod === 'sms' && !phone) {
      toast({ title: t('errors.genericError'), description: t('forms.invalidPhone'), variant: "destructive" });
      return;
    }

    setIsSubmittingNotification(true);
    try {
      console.log("[handleNotifyAvailability] Simulating availability alert request:", {
        propertyId: propertySlug,
        checkInDate: format(checkInDate, 'yyyy-MM-dd'),
        checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
        method: notificationMethod,
        contact: notificationMethod === 'email' ? email : phone,
      });
      // TODO: Replace with actual API call to save alert request
      await new Promise(res => setTimeout(res, 500)); // Simulate API call

      toast({
        title: "Alert Request Saved",
        description: `We'll notify you via ${notificationMethod} if ${format(checkInDate, 'MMM d')} - ${format(checkOutDate, 'MMM d')} becomes available.`,
      });
      setNotifyAvailability(false);
    } catch (error) {
      console.error("Error creating availability alert:", error);
      toast({
        title: "Error Saving Alert",
        description: `Could not save your notification request. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingNotification(false);
    }
  };

  const renderAvailabilityStatusMessage = () => {
    if (isLoadingAvailability) {
      return (
        <Alert variant="default" className="bg-blue-50 border-blue-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>{t('booking.checkingAvailability')}</AlertTitle>
          <AlertDescription className="flex flex-col space-y-2">
            <span>{t('booking.checkingAvailabilityMessage')}</span>
            {longLoading && (
              <div className="mt-2 text-sm">
                <p className="text-amber-700">{t('booking.loadingTooLong')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 self-start text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    // Manually retry the availability check
                    window.location.reload();
                  }}
                >
                  {t('booking.reloadToTryAgain')}
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      );
    }
    if (isAvailable === true && datesSelected && checkInDate && checkOutDate) {
      // Force a specific date format to ensure consistency
      const formattedCheckIn = format(checkInDate, 'MMM d, yyyy');
      const formattedCheckOut = format(checkOutDate, 'MMM d, yyyy');
      const nightsText = numberOfNights === 1 ? t('common.night') : t('common.nights');

      // Remove debug output in production
      if (process.env.NODE_ENV === 'development') {
        console.log("Displaying available dates message:", {
          checkIn: checkInDate.toISOString(),
          checkOut: checkOutDate.toISOString(),
          nights: numberOfNights,
          formatted: `${formattedCheckIn} - ${formattedCheckOut}`
        });
      }

      return (
        <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>{t('booking.datesAvailable')}</AlertTitle>
          <AlertDescription>
            {t('booking.availabilitySuccess')
              .replace('{{checkIn}}', formattedCheckIn)
              .replace('{{checkOut}}', formattedCheckOut)
              .replace('{{nights}}', String(numberOfNights))}
          </AlertDescription>
        </Alert>
      );
    }
    if (isAvailable === false && datesSelected && checkInDate && checkOutDate) {
      return (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>{t('booking.datesUnavailable')}</AlertTitle>
          <AlertDescription>
            {t('booking.datesUnavailableMessage')
              .replace('{{checkIn}}', format(checkInDate, 'MMM d'))
              .replace('{{checkOut}}', format(checkOutDate, 'MMM d'))}
          </AlertDescription>
        </Alert>
      );
    }
    if (!datesSelected) {
      return (
        <Alert variant="default" className="border-yellow-300 bg-yellow-50 text-yellow-800">
          <Info className="h-4 w-4 text-yellow-600" />
          <AlertTitle>{t('booking.selectDates')}</AlertTitle>
          <AlertDescription>{t('booking.selectDatesMessage')}</AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  const renderSuggestedDates = () => {
    if (isAvailable !== false || suggestedDates.length === 0) {
      return null;
    }
    return (
      <Card className="mt-6 bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="text-lg text-amber-900">{t('booking.alternativeDates')}</CardTitle>
          <CardDescription className="text-amber-800">
            {t('booking.alternativeDatesMessage')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestedDates.map((range, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-between bg-white hover:bg-gray-50 border-gray-300"
              onClick={() => handleSelectAlternativeDate(range)}
              disabled={isLoadingAvailability} // Disable while checking
            >
              <span>
                {format(range.from, 'MMM d, yyyy')} - {format(range.to, 'MMM d, yyyy')} ({differenceInDays(range.to, range.from)} nights)
              </span>
              {range.recommendation && <Badge variant="secondary">{range.recommendation}</Badge>}
            </Button>
          ))}
        </CardContent>
      </Card>
    );
  };

  const renderNotificationForm = () => {
    if (isAvailable !== false || !datesSelected || !checkInDate || !checkOutDate) return null;
    return (
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">{t('booking.getNotified')}</CardTitle>
          <CardDescription className="text-blue-800">
            {t('booking.wantToKnowIfAvailable')
              .replace('{{checkIn}}', format(checkInDate, 'MMM d'))
              .replace('{{checkOut}}', format(checkOutDate, 'MMM d'))}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="notify-availability"
              checked={notifyAvailability}
              onCheckedChange={(checked) => setNotifyAvailability(checked as boolean)}
              disabled={isSubmittingNotification || isProcessingBooking} // Disable if submitting this form or main form
            />
            <Label htmlFor="notify-availability" className="font-medium">
              {t('booking.notifyIfAvailable')}
            </Label>
          </div>
          {notifyAvailability && (
            <>
              <Separator />
              <p className="text-sm font-medium">{t('booking.howToNotify')}</p>
              <RadioGroup
                value={notificationMethod}
                onValueChange={(value) => setNotificationMethod(value as 'email' | 'sms')}
                className="flex gap-4"
                aria-disabled={isSubmittingNotification || isProcessingBooking}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="email" id="notify-email" disabled={isSubmittingNotification || isProcessingBooking}/>
                  <Label htmlFor="notify-email" className="flex items-center gap-1"><Mail className="h-4 w-4" /> Email</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sms" id="notify-sms" disabled={isSubmittingNotification || isProcessingBooking}/>
                  <Label htmlFor="notify-sms" className="flex items-center gap-1"><Phone className="h-4 w-4" /> SMS</Label>
                </div>
              </RadioGroup>
              {notificationMethod === 'email' && (
                <Input
                  type="email"
                  placeholder={t('booking.enterYourEmail')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={notificationMethod === 'email'}
                  className="bg-white"
                  disabled={isSubmittingNotification || isProcessingBooking}
                />
              )}
              {notificationMethod === 'sms' && (
                <Input
                  type="tel"
                  placeholder={t('booking.enterYourPhone')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required={notificationMethod === 'sms'}
                  className="bg-white"
                  disabled={isSubmittingNotification || isProcessingBooking}
                />
              )}
              <Button
                onClick={handleNotifyAvailabilitySubmit}
                disabled={isSubmittingNotification || isProcessingBooking}
                size="sm"
              >
                {isSubmittingNotification ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t('booking.requestNotification')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 mb-8">
      {/* OBSOLETE COMPONENT WARNING - This component is deprecated */}
      {renderAvailabilityStatusMessage()}
      {renderSuggestedDates()}
      {/* Calendar is rendered separately by the parent */}
      {renderNotificationForm()}
    </div>
  );
}

    