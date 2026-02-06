"use client";

import { useLanguage as useUnifiedLanguage } from '@/lib/language-system';
import type { ContentTranslationFunction } from '@/lib/language-system/language-types';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';

interface LanguageHook {
  currentLang: string;
  currentLanguage: string; // alias for compatibility
  switchLanguage: (lang: string) => void;
  changeLanguage: (lang: string) => void; // alias for compatibility
  t: (key: string, fallback?: string, variables?: Record<string, string | number>) => string;
  tc: ContentTranslationFunction;
  getLocalizedPath: (path: string, lang?: string) => string;
  isLanguageSupported: (lang: string) => boolean;
}

export function useLanguage(): LanguageHook {
  // Use the unified language system
  const unifiedHook = useUnifiedLanguage();
  
  // Return interface-compatible object with unified system
  return {
    currentLang: unifiedHook.currentLang,
    currentLanguage: unifiedHook.currentLanguage, // use existing alias
    switchLanguage: unifiedHook.switchLanguage,
    changeLanguage: unifiedHook.changeLanguage, // use existing alias
    t: unifiedHook.t,
    tc: unifiedHook.tc,
    getLocalizedPath: unifiedHook.getLocalizedPath,
    isLanguageSupported: unifiedHook.isLanguageSupported
  };
}