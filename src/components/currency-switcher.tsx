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

// Simple Flag Placeholder Components (Replace with actual SVGs or components if available)
const FlagPlaceholder = ({ code, className }: { code: string, className?: string }) => (
    <div className={cn("w-5 h-3 rounded-sm flex items-center justify-center text-xs font-bold text-white bg-muted-foreground", className)}>
        {/* Render country code or symbol */}
        {code === 'USD' ? 'US' : code === 'EUR' ? 'EU' : 'RO'}
    </div>
);

const currencyIcons: { [key in CurrencyCode]: React.ElementType } = {
  USD: (props: any) => <FlagPlaceholder code="USD" {...props} />,
  EUR: (props: any) => <FlagPlaceholder code="EUR" {...props} />,
  RON: (props: any) => <FlagPlaceholder code="RON" {...props} />,
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
           {/* Apply subtle transparency using Tailwind opacity class */}
           <SelectedIcon className="opacity-80" />
          <SelectValue placeholder="Select currency" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-background border-border">
        {SUPPORTED_CURRENCIES.map((currency) => {
          const Icon = currencyIcons[currency];
          return (
            <SelectItem key={currency} value={currency} className="cursor-pointer hover:bg-accent/10">
              <div className="flex items-center gap-2">
                 {/* Apply subtle transparency using Tailwind opacity class */}
                 <Icon className="opacity-80" />
                {currency}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
