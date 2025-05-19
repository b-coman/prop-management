// src/components/booking/booking-options-cards.tsx
"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { Property } from '@/types'; // Import Property type
import { ContactCard } from './contact-card'; // Import specific cards
import { HoldCard } from './hold-card';
import { BookNowCard } from './book-now-card';
import { motion } from 'framer-motion';
import { useArrowKeyNavigation } from '@/hooks/useKeyboardNavigation';

type SelectedOption = 'contact' | 'hold' | 'bookNow' | null;

interface BookingOptionsCardsProps {
  selectedOption: SelectedOption;
  onSelectOption: (option: SelectedOption) => void;
  property: Property; // Receive property to check options
}

export function BookingOptionsCards({
  selectedOption,
  onSelectOption,
  property,
}: BookingOptionsCardsProps) {
  const { enableContactOption = true, enableHoldOption = true } = property; // Default to true if not set
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const options: SelectedOption[] = [];
  
  // Build available options array
  if (enableContactOption) options.push('contact');
  if (enableHoldOption) options.push('hold');
  options.push('bookNow');
  
  // Set up arrow key navigation
  const validCardRefs = cardRefs.current.filter(ref => ref !== null) as HTMLDivElement[];
  useArrowKeyNavigation(
    validCardRefs,
    (index) => onSelectOption(options[index]),
    'horizontal'
  );

  return (
    <motion.div 
      className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1
          }
        }
      }}
    >
      {/* Contact Card */}
      {enableContactOption && (
        <motion.div
          ref={(el) => { if (enableContactOption) cardRefs.current[0] = el; }}
          tabIndex={0}
          role="button"
          aria-pressed={selectedOption === 'contact'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectOption('contact');
            }
          }}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                duration: 0.4,
                ease: "easeOut"
              }
            }
          }}
        >
          <ContactCard
            isSelected={selectedOption === 'contact'}
            onSelect={() => onSelectOption('contact')}
          />
        </motion.div>
      )}

      {/* Hold Card */}
      {enableHoldOption && (
        <motion.div
          ref={(el) => { 
            const index = enableContactOption ? 1 : 0;
            if (enableHoldOption) cardRefs.current[index] = el; 
          }}
          tabIndex={0}
          role="button"
          aria-pressed={selectedOption === 'hold'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectOption('hold');
            }
          }}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                duration: 0.4,
                ease: "easeOut"
              }
            }
          }}
        >
          <HoldCard
            isSelected={selectedOption === 'hold'}
            onSelect={() => onSelectOption('hold')}
            holdFeeAmount={property.holdFeeAmount || 25} // Use property config or default
            propertyBaseCurrency={property.baseCurrency} // Pass the property's base currency
          />
        </motion.div>
      )}

      {/* Book Now Card */}
      <motion.div
        ref={(el) => { 
          const index = (enableContactOption ? 1 : 0) + (enableHoldOption ? 1 : 0);
          cardRefs.current[index] = el; 
        }}
        tabIndex={0}
        role="button"
        aria-pressed={selectedOption === 'bookNow'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectOption('bookNow');
          }
        }}
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: {
            opacity: 1,
            y: 0,
            transition: {
              duration: 0.4,
              ease: "easeOut"
            }
          }
        }}
      >
        <BookNowCard
          isSelected={selectedOption === 'bookNow'}
          onSelect={() => onSelectOption('bookNow')}
        />
      </motion.div>
    </motion.div>
  );
}
