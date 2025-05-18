// src/components/currency-switcher.tsx
"use client";

import { useState, useEffect } from 'react'; // Import useState and useEffect
import { useCurrency } from '@/contexts/CurrencyContext';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

// Use flag emojis directly
const currencyFlags: { [key in CurrencyCode]: string } = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  RON: '🇷🇴',
};

// Add className to props
interface CurrencySwitcherProps {
  className?: string;
}

export function CurrencySwitcher({ className }: CurrencySwitcherProps) {
  const { selectedCurrency, setSelectedCurrency } = useCurrency();
  const [hasMounted, setHasMounted] = useState(false); // State to track client mount
  const [isOpen, setIsOpen] = useState(false); // Track open state

  // Set hasMounted to true after the component mounts on the client
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleCurrencyChange = (value: string) => {
    if (SUPPORTED_CURRENCIES.includes(value as CurrencyCode)) {
      setSelectedCurrency(value as CurrencyCode);
    }
  };

  const SelectedFlag = currencyFlags[selectedCurrency];

  return (
    <Select 
      value={selectedCurrency} 
      onValueChange={handleCurrencyChange}
      onOpenChange={setIsOpen}
    >
      {/* Apply passed className to the trigger */}
      <SelectTrigger 
        className={cn(
          "w-auto h-9 px-3 transition-all duration-200 focus:ring-1 focus:ring-offset-0",
          // Override default styles completely based on state
          isOpen ? "bg-black/20" : "bg-transparent",
          className // Merge dynamic class here
        )}
        style={{
          // Use inline styles as a last resort to override everything
          backgroundColor: isOpen ? "rgba(0,0,0,0.2)" : "transparent"
        }}
        // Custom data attribute to allow styling dropdowns in theme-aware way
        data-theme-aware="true"
      >
        <SelectValue>
           {/* Render placeholder or nothing until mounted */}
          {hasMounted ? (
            <div className="flex items-center gap-1.5">
              <span className="text-lg mr-1 opacity-80">{SelectedFlag}</span> {/* Flag */}
              {selectedCurrency} {/* Code */}
            </div>
          ) : (
            // Render a placeholder or nothing during SSR/initial client render
            <div className="flex items-center gap-1.5">
              <span className="text-lg mr-1 opacity-80">🇺🇸</span> {/* Default/Placeholder flag */}
              USD {/* Default/Placeholder currency */}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-background border-border shadow-lg">
        {SUPPORTED_CURRENCIES.map((currency) => {
          const Flag = currencyFlags[currency];
          return (
            <SelectItem key={currency} value={currency} className="cursor-pointer hover:bg-accent/10 focus:bg-accent/10">
              <div className="flex items-center gap-2">
                <span className="text-lg mr-1 opacity-80">{Flag}</span> {/* Flag */}
                {currency} {/* Code */}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
