"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Calendar, CreditCard } from 'lucide-react';

interface BookingOptionsProps {
  selectedOption: 'contact' | 'hold' | 'bookNow' | null;
  onSelectOption: (option: 'contact' | 'hold' | 'bookNow' | null) => void;
  property: any;
}

/**
 * BookingOptions component for displaying booking option cards
 * 
 * This is a placeholder component that would be implemented with actual logic
 * in a real application.
 */
export function BookingOptions({
  selectedOption,
  onSelectOption,
  property
}: BookingOptionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Contact Host Option */}
      <Card className={`${selectedOption === 'contact' ? 'border-primary' : 'border-border'} cursor-pointer transition-all hover:border-primary/50`}>
        <CardContent className="p-4 flex flex-col items-center text-center h-full">
          <Mail className="h-8 w-8 mb-2 text-primary" />
          <h3 className="font-medium mb-1">Contact Host</h3>
          <p className="text-sm text-muted-foreground mb-4 flex-grow">
            Have questions? Send a message to the host.
          </p>
          <Button 
            variant={selectedOption === 'contact' ? 'default' : 'outline'}
            onClick={() => onSelectOption('contact')}
            className="w-full"
          >
            Contact
          </Button>
        </CardContent>
      </Card>
      
      {/* Hold Dates Option */}
      <Card className={`${selectedOption === 'hold' ? 'border-primary' : 'border-border'} cursor-pointer transition-all hover:border-primary/50`}>
        <CardContent className="p-4 flex flex-col items-center text-center h-full">
          <Calendar className="h-8 w-8 mb-2 text-primary" />
          <h3 className="font-medium mb-1">Hold Dates</h3>
          <p className="text-sm text-muted-foreground mb-4 flex-grow">
            Reserve these dates for 24 hours with a small fee.
          </p>
          <Button 
            variant={selectedOption === 'hold' ? 'default' : 'outline'}
            onClick={() => onSelectOption('hold')}
            className="w-full"
          >
            Hold ($10)
          </Button>
        </CardContent>
      </Card>
      
      {/* Book Now Option */}
      <Card className={`${selectedOption === 'bookNow' ? 'border-primary' : 'border-border'} cursor-pointer transition-all hover:border-primary/50`}>
        <CardContent className="p-4 flex flex-col items-center text-center h-full">
          <CreditCard className="h-8 w-8 mb-2 text-primary" />
          <h3 className="font-medium mb-1">Book Now</h3>
          <p className="text-sm text-muted-foreground mb-4 flex-grow">
            Secure your booking instantly with payment.
          </p>
          <Button 
            variant={selectedOption === 'bookNow' ? 'default' : 'outline'}
            onClick={() => onSelectOption('bookNow')}
            className="w-full"
          >
            Book Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}