// src/components/currency-switcher.tsx
"use client";

import { useCurrency } from '@/contexts/CurrencyContext';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils'; // Import cn for conditional classes

// Use flag emojis directly
const currencyFlags: { [key in CurrencyCode]: string } = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  RON: '🇷🇴',
};

export function CurrencySwitcher() {
  const { selectedCurrency, setSelectedCurrency } = useCurrency();

  const handleCurrencyChange = (value: string) => {
    if (SUPPORTED_CURRENCIES.includes(value as CurrencyCode)) {
      setSelectedCurrency(value as CurrencyCode);
    }
  };

  const SelectedFlag = currencyFlags[selectedCurrency];

  return (
    <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
      {/* Adjusted styles for emoji */}
      <SelectTrigger className="w-auto h-9 px-3 bg-transparent hover:bg-white/10 border-white/20 text-white focus:ring-white/50 data-[state=open]:bg-black/50">
        <div className="flex items-center gap-1.5">
           {/* Display flag emoji */}
           <span className="text-lg mr-1 opacity-80">{SelectedFlag}</span> {/* Adjusted size and opacity */}
          <SelectValue placeholder="Select currency" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-background border-border">
        {SUPPORTED_CURRENCIES.map((currency) => {
          const Flag = currencyFlags[currency];
          return (
            <SelectItem key={currency} value={currency} className="cursor-pointer hover:bg-accent/10">
              <div className="flex items-center gap-2">
                 {/* Display flag emoji */}
                 <span className="text-lg mr-1 opacity-80">{Flag}</span> {/* Adjusted size and opacity */}
                {currency}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
