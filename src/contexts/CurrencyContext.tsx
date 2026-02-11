// src/contexts/CurrencyContext.tsx
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { CurrencyCode } from '@/types';
import { SUPPORTED_CURRENCIES } from '@/types';
import { useSessionStorage } from '@/hooks/use-session-storage'; // For persisting selection
import { getCurrencyRates } from '@/services/configService'; // Import Firestore fetch function
import { Loader2 } from 'lucide-react'; // Import Loader icon

// Define a simple exchange rate structure
export interface ExchangeRates {
  [key: string]: number; // Base is USD, so USD: 1
}

interface CurrencyContextType {
  selectedCurrency: CurrencyCode;
  setSelectedCurrency: (currency: CurrencyCode) => void;
  setSelectedCurrencyTemporary: (currency: CurrencyCode) => void; // Temporary override without saving
  setDefaultCurrency: (currency: CurrencyCode) => void; // Set default from property data (only if user hasn't chosen)
  exchangeRates: ExchangeRates;
  ratesLoading: boolean; // Add loading state
  ratesError: string | null; // Add error state
  convertToSelectedCurrency: (amount: number, fromCurrency: CurrencyCode) => number;
  formatPrice: (amount: number, currencyCode?: CurrencyCode, options?: Intl.NumberFormatOptions) => string;
  baseCurrencyForProperty: (propertyBaseCurrency: CurrencyCode) => CurrencyCode;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Default rates in case Firestore fetch fails or is loading
const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  USD: 1,
  EUR: 0.92,
  RON: 4.58,
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [persistedCurrency, setPersistedCurrency] = useSessionStorage<CurrencyCode>(
    'selectedDisplayCurrency',
    'USD' // Default to USD
  );
  const [selectedCurrency, setSelectedCurrencyState] = useState<CurrencyCode>(persistedCurrency);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES); // Initialize with defaults
  const [ratesLoading, setRatesLoading] = useState<boolean>(true);
  const [ratesError, setRatesError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCurrencyState(persistedCurrency); // Sync with session storage on mount/change
  }, [persistedCurrency]);

  // Fetch rates from Firestore on mount
  useEffect(() => {
    const fetchRates = async () => {
      setRatesLoading(true);
      setRatesError(null);
      try {
        const rates = await getCurrencyRates();
        if (rates) {
          console.log("[CurrencyContext] Fetched rates from Firestore:", rates);
          // Basic validation: ensure USD is present and is 1
          if (rates.USD === 1) {
             setExchangeRates(rates);
          } else {
             console.warn("[CurrencyContext] Firestore rates invalid (USD != 1), using default rates.");
             setExchangeRates(DEFAULT_EXCHANGE_RATES);
             setRatesError("Fetched currency rates were invalid.");
          }
        } else {
          console.warn("[CurrencyContext] No rates found in Firestore, using default rates.");
          setExchangeRates(DEFAULT_EXCHANGE_RATES); // Fallback to default if not found
          // Optionally set an error if rates are critical
          // setRatesError("Could not load currency rates.");
        }
      } catch (error) {
        console.error("Error fetching currency rates from Firestore:", error);
        setRatesError("Failed to load currency rates.");
        setExchangeRates(DEFAULT_EXCHANGE_RATES); // Use default on error
      } finally {
        setRatesLoading(false);
      }
    };

    fetchRates();
  }, []); // Fetch only once on mount

  const setSelectedCurrency = useCallback((currency: CurrencyCode) => {
    setSelectedCurrencyState(currency);
    setPersistedCurrency(currency); // Persist to session storage
    // Mark that user has explicitly chosen a currency
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('userCurrencyChoice', 'true');
    }
  }, [setPersistedCurrency]);

  const setSelectedCurrencyTemporary = useCallback((currency: CurrencyCode) => {
    setSelectedCurrencyState(currency);
    // Don't persist to session storage - this is a temporary override
  }, []);

  // Detect currency from timezone: Romania → property default (RON), everyone else → EUR
  const detectCurrencyFromTimezone = useCallback((propertyBaseCurrency: CurrencyCode): CurrencyCode => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Europe/Bucharest"
      if (tz === 'Europe/Bucharest') return propertyBaseCurrency; // Romanian visitor → RON
      return 'EUR'; // International visitor → EUR as universal reference
    } catch {
      return propertyBaseCurrency; // Fallback if timezone detection fails
    }
  }, []);

  // Set default currency from property data — only applies if user hasn't explicitly chosen
  const setDefaultCurrency = useCallback((currency: CurrencyCode) => {
    if (typeof window === 'undefined') return;
    if (!SUPPORTED_CURRENCIES.includes(currency)) return;
    const userChose = window.sessionStorage.getItem('userCurrencyChoice');
    if (!userChose) {
      const detectedCurrency = detectCurrencyFromTimezone(currency);
      setSelectedCurrencyState(detectedCurrency);
      setPersistedCurrency(detectedCurrency);
    }
  }, [setPersistedCurrency, detectCurrencyFromTimezone]);

  const convertToSelectedCurrency = useCallback((amount: number, fromCurrency: CurrencyCode): number => {
     if (ratesLoading) return amount; // Return original amount if rates are loading
     if (fromCurrency === selectedCurrency) {
       return amount;
     }
    const baseRate = exchangeRates[fromCurrency] || 1;
    const targetRate = exchangeRates[selectedCurrency] || 1;

     const amountInUSD = amount / baseRate; // Convert 'fromCurrency' to USD
     return amountInUSD * targetRate; // Convert USD to 'selectedCurrency'
  }, [selectedCurrency, exchangeRates, ratesLoading]);

  const formatPrice = useCallback((
    amount: number,
    currencyCode: CurrencyCode = selectedCurrency,
    options?: Intl.NumberFormatOptions
  ): string => {
    const roundedAmount = Math.round(amount);
    
    // Special formatting for RON - display as "1,747 lei" instead of "RON 1,747"
    if (currencyCode === 'RON') {
      // Use toLocaleString to add thousand separators
      const formattedNumber = roundedAmount.toLocaleString('en-US');
      return `${formattedNumber} lei`;
    }
    
    const defaultOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    };
    try {
       // If rates are still loading, maybe indicate that? Or just format with potentially default rates.
       // For now, it will format using the current `exchangeRates` state.
      return new Intl.NumberFormat(undefined, { ...defaultOptions, ...options }).format(roundedAmount);
    } catch (e) {
      console.warn(`Error formatting price for currency ${currencyCode}:`, e);
      // Also add thousand separators to fallback
      const formattedNumber = roundedAmount.toLocaleString('en-US');
      return `${formattedNumber} ${currencyCode}`;
    }
  }, [selectedCurrency]);

  const baseCurrencyForProperty = useCallback((propertyBaseCurrency: CurrencyCode): CurrencyCode => {
     // Ensure the base currency from the property data is valid
     return SUPPORTED_CURRENCIES.includes(propertyBaseCurrency) ? propertyBaseCurrency : 'USD';
  }, []);

  // Optional: Display a loading indicator or error message while fetching rates
  // if (ratesLoading) {
  //   return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> Loading currency data...</div>;
  // }
  // if (ratesError) {
  //   return <div className="text-center text-red-500 p-4">Error loading currency rates: {ratesError}</div>;
  // }

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    selectedCurrency,
    setSelectedCurrency,
    setSelectedCurrencyTemporary,
    setDefaultCurrency,
    exchangeRates,
    ratesLoading,
    ratesError,
    convertToSelectedCurrency,
    formatPrice,
    baseCurrencyForProperty,
  }), [
    selectedCurrency,
    setSelectedCurrency,
    setSelectedCurrencyTemporary,
    setDefaultCurrency,
    exchangeRates,
    ratesLoading,
    ratesError,
    convertToSelectedCurrency,
    formatPrice,
    baseCurrencyForProperty,
  ]);

  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    // During SSR or if provider is missing, return a safe default
    if (typeof window === 'undefined') {
      return {
        selectedCurrency: 'USD' as CurrencyCode,
        setSelectedCurrency: () => {},
        setSelectedCurrencyTemporary: () => {},
        setDefaultCurrency: () => {},
        exchangeRates: DEFAULT_EXCHANGE_RATES,
        ratesLoading: false,
        ratesError: null,
        convertToSelectedCurrency: (amount: number) => amount,
        formatPrice: (amount: number, currencyCode?: CurrencyCode) => {
          const currency = currencyCode || 'USD';
          const roundedAmount = Math.round(amount);
          
          // Special formatting for RON with thousand separators
          if (currency === 'RON') {
            const formattedNumber = roundedAmount.toLocaleString('en-US');
            return `${formattedNumber} lei`;
          }
          
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(roundedAmount);
        },
        baseCurrencyForProperty: (currency: CurrencyCode) => currency,
      };
    }
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
