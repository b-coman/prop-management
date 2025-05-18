// src/components/currency-switcher-simple.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/types';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

// Use flag emojis directly
const currencyFlags: { [key in CurrencyCode]: string } = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  RON: '🇷🇴',
};

interface CurrencySwitcherProps {
  className?: string;
  dropdownClassName?: string;
  isHeaderScrolled?: boolean;
}

export function CurrencySwitcherSimple({ className, dropdownClassName, isHeaderScrolled = false }: CurrencySwitcherProps) {
  const { selectedCurrency, setSelectedCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCurrencyChange = (currency: CurrencyCode) => {
    setSelectedCurrency(currency);
    setIsOpen(false);
  };

  const SelectedFlag = currencyFlags[selectedCurrency];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-md transition-all duration-200",
          "focus:outline-none focus:ring-1 focus:ring-offset-0",
          isOpen && "bg-black/20",
          className
        )}
      >
        {hasMounted ? (
          <>
            <span className="text-lg opacity-80">{SelectedFlag}</span>
            <span>{selectedCurrency}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </>
        ) : (
          <>
            <span className="text-lg opacity-80">🇺🇸</span>
            <span>USD</span>
            <ChevronDown className="h-4 w-4" />
          </>
        )}
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-full mt-1 right-0 rounded-md shadow-lg z-50 overflow-hidden",
          // Dynamic background based on header state
          isHeaderScrolled ? 
            "bg-background border border-border" : 
            "bg-black/90 backdrop-blur-sm border border-white/20",
          dropdownClassName
        )}>
          {SUPPORTED_CURRENCIES.map((currency) => {
            const Flag = currencyFlags[currency];
            return (
              <button
                key={currency}
                onClick={() => handleCurrencyChange(currency)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 w-full text-left transition-colors",
                  // Dynamic hover and text colors based on header state
                  isHeaderScrolled ? 
                    "hover:bg-accent/10 text-foreground" : 
                    "hover:bg-white/10 text-white",
                  currency === selectedCurrency && (isHeaderScrolled ? "bg-accent/5" : "bg-white/5")
                )}
              >
                <span className="text-lg opacity-80">{Flag}</span>
                <span>{currency}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}