// src/components/currency-switcher-safe.tsx
"use client";

import { CurrencySwitcherSimple } from './currency-switcher-simple';

interface CurrencySwitcherSafeProps {
  className?: string;
  dropdownClassName?: string;
  isHeaderScrolled?: boolean;
}

export function CurrencySwitcherSafe(props: CurrencySwitcherSafeProps) {
  // Return a placeholder during SSR
  if (typeof window === 'undefined') {
    return <div className={props.className}>USD</div>;
  }

  try {
    return <CurrencySwitcherSimple {...props} />;
  } catch (error) {
    console.error('Currency switcher error:', error);
    return <div className={props.className}>USD</div>;
  }
}