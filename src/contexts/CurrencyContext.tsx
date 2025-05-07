// src/contexts/CurrencyContext.tsx
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CurrencyCode } from '@/types';
import { SUPPORTED_CURRENCIES } from '@/types';
import { useSessionStorage } from '@/hooks/use-session-storage'; // For persisting selection

// Define a simple exchange rate structure
interface ExchangeRates {
  [key: string]: number; // Base is USD, so USD: 1
}

interface CurrencyContextType {
  selectedCurrency: CurrencyCode;
  setSelectedCurrency: (currency: CurrencyCode) => void;
  exchangeRates: ExchangeRates;
  convertToSelectedCurrency: (amount: number, fromCurrency: CurrencyCode) => number;
  formatPrice: (amount: number, currencyCode?: CurrencyCode, options?: Intl.NumberFormatOptions) => string;
  baseCurrencyForProperty: (propertyBaseCurrency: CurrencyCode) => CurrencyCode;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Mock exchange rates - In a real app, fetch these from an API
const MOCK_EXCHANGE_RATES: ExchangeRates = {
  USD: 1,
  EUR: 0.92, // 1 USD = 0.92 EUR
  RON: 4.58,  // 1 USD = 4.58 RON
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [persistedCurrency, setPersistedCurrency] = useSessionStorage<CurrencyCode>(
    'selectedDisplayCurrency',
    'USD' // Default to USD
  );
  const [selectedCurrency, setSelectedCurrencyState] = useState<CurrencyCode>(persistedCurrency);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(MOCK_EXCHANGE_RATES);

  useEffect(() => {
    // In a real app, you might fetch exchange rates here
    // For now, we use mock rates
    // Example: fetch('/api/exchange-rates').then(res => res.json()).then(data => setExchangeRates(data.rates));
    setSelectedCurrencyState(persistedCurrency); // Sync with session storage on mount
  }, [persistedCurrency]);

  const setSelectedCurrency = useCallback((currency: CurrencyCode) => {
    setSelectedCurrencyState(currency);
    setPersistedCurrency(currency); // Persist to session storage
  }, [setPersistedCurrency]);

  const convertToSelectedCurrency = useCallback((amount: number, fromCurrency: CurrencyCode): number => {
    if (fromCurrency === selectedCurrency) {
      return amount;
    }
    const amountInUSD = amount / (exchangeRates[fromCurrency] || 1); // Convert 'fromCurrency' to USD
    return amountInUSD * (exchangeRates[selectedCurrency] || 1); // Convert USD to 'selectedCurrency'
  }, [selectedCurrency, exchangeRates]);

  const formatPrice = useCallback((
    amount: number,
    currencyCode: CurrencyCode = selectedCurrency,
    options?: Intl.NumberFormatOptions
  ): string => {
    const defaultOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    };
    try {
      return new Intl.NumberFormat(undefined, { ...defaultOptions, ...options }).format(amount);
    } catch (e) {
      // Fallback for unsupported currency codes or other errors
      console.warn(`Error formatting price for currency ${currencyCode}:`, e);
      return `${amount.toFixed(2)} ${currencyCode}`;
    }
  }, [selectedCurrency]);

  // Helper to ensure we always use a valid base currency from the property
  const baseCurrencyForProperty = (propertyBaseCurrency: CurrencyCode): CurrencyCode => {
    return SUPPORTED_CURRENCIES.includes(propertyBaseCurrency) ? propertyBaseCurrency : 'USD'; // Default to USD if invalid
  };

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        setSelectedCurrency,
        exchangeRates,
        convertToSelectedCurrency,
        formatPrice,
        baseCurrencyForProperty,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};