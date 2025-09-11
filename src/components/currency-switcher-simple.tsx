// src/components/currency-switcher-simple.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DollarSign, Check, ChevronDown } from "lucide-react";
import { useCurrency } from '@/contexts/CurrencyContext';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/types';
import { cn } from '@/lib/utils';
import { RenderTracker } from '@/components/debug/RenderTracker';

// Use text-based currency codes for consistency with language selector
const currencyLabels: { [key in CurrencyCode]: { code: string; name: string; symbol: string } } = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€' },
  RON: { code: 'RON', name: 'Romanian Leu', symbol: 'RON' },
};

interface CurrencySwitcherProps {
  className?: string;
  variant?: 'default' | 'ghost' | 'outline' | 'booking';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  showIcon?: boolean;
}

export function CurrencySwitcherSimple({ 
  className,
  variant = 'ghost',
  size = 'sm',
  showLabel = true,
  showIcon = false
}: CurrencySwitcherProps) {
  const { selectedCurrency, setSelectedCurrency } = useCurrency();
  const currentCurrency = currencyLabels[selectedCurrency];
  
  // Determine actual variant based on booking context
  const actualVariant = variant === 'booking' ? 'ghost' : variant;
  const actualSize = variant === 'booking' ? 'default' : size;
  
  return (
    <>
      <RenderTracker name="CurrencySwitcher" data={{ selectedCurrency, variant, showLabel }} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
        <Button 
          variant={actualVariant} 
          size={actualSize} 
          className={cn("gap-2", className)}
        >
          {showIcon && <DollarSign className="h-4 w-4" />}
          {showLabel && (
            <>
              <span className="hidden sm:inline">
                {currentCurrency?.symbol !== currentCurrency?.code 
                  ? `${currentCurrency?.symbol} ${currentCurrency?.code}`
                  : currentCurrency?.code
                }
              </span>
              <span className="sm:hidden">{currentCurrency?.code}</span>
            </>
          )}
          {!showLabel && currentCurrency?.code}
          {variant === 'booking' && <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        {SUPPORTED_CURRENCIES.map((currency) => {
          const currencyInfo = currencyLabels[currency];
          return (
            <DropdownMenuItem
              key={currency}
              onClick={() => setSelectedCurrency(currency)}
              className={cn(
                "cursor-pointer justify-between",
                selectedCurrency === currency && "bg-accent"
              )}
            >
              <span className="flex items-center gap-2">
                <span>{currencyInfo.symbol}</span>
                <span>{currencyInfo.code}</span>
              </span>
              {selectedCurrency === currency && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}