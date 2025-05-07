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
import { DollarSign, Euro, PoundSterling } from 'lucide-react'; // Using Pound for RON as a placeholder

const currencyIcons: { [key in CurrencyCode]: React.ElementType } = {
  USD: DollarSign,
  EUR: Euro,
  RON: PoundSterling, // Placeholder, consider a more appropriate icon or text
};

export function CurrencySwitcher() {
  const { selectedCurrency, setSelectedCurrency } = useCurrency();

  const handleCurrencyChange = (value: string) => {
    if (SUPPORTED_CURRENCIES.includes(value as CurrencyCode)) {
      setSelectedCurrency(value as CurrencyCode);
    }
  };

  const SelectedIcon = currencyIcons[selectedCurrency];

  return (
    <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
      <SelectTrigger className="w-auto h-9 px-3 bg-transparent hover:bg-white/10 border-white/20 text-white focus:ring-white/50 data-[state=open]:bg-black/50">
        <div className="flex items-center gap-1.5">
          <SelectedIcon className="h-4 w-4" />
          <SelectValue placeholder="Select currency" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-background border-border">
        {SUPPORTED_CURRENCIES.map((currency) => {
          const Icon = currencyIcons[currency];
          return (
            <SelectItem key={currency} value={currency} className="cursor-pointer hover:bg-accent/10">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {currency}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}