'use client';

import { useCurrency } from '@/contexts/CurrencyContext';

export default function TestCurrencyPage() {
  try {
    const { selectedCurrency, formatPrice } = useCurrency();
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold">Currency Test Page</h1>
        <p>Selected Currency: {selectedCurrency}</p>
        <p>Formatted Price: {formatPrice(100)}</p>
        <p>Test passed - currency context is working!</p>
      </div>
    );
  } catch (error) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold">Currency Test Page</h1>
        <p>Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }
}