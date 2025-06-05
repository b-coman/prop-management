/**
 * @fileoverview Language HTML Attribute Updater
 * @module components/language-html-updater
 * 
 * @description
 * Client component that dynamically updates the HTML lang attribute
 * based on the detected language from URL parameters or language system.
 * This ensures SSR-rendered pages have the correct language attribute.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';

interface LanguageHtmlUpdaterProps {
  initialLanguage?: string;
}

export function LanguageHtmlUpdater({ initialLanguage }: LanguageHtmlUpdaterProps) {
  const { currentLang } = useLanguage();
  
  useEffect(() => {
    // Update HTML lang attribute when language changes
    const htmlElement = document.documentElement;
    const targetLang = currentLang || initialLanguage || 'en';
    
    if (htmlElement.lang !== targetLang) {
      console.log(`[LanguageHtmlUpdater] Updating HTML lang from "${htmlElement.lang}" to "${targetLang}"`);
      htmlElement.lang = targetLang;
    }
  }, [currentLang, initialLanguage]);
  
  // Set initial language on mount if provided
  useEffect(() => {
    if (initialLanguage && typeof window !== 'undefined') {
      const htmlElement = document.documentElement;
      if (htmlElement.lang !== initialLanguage) {
        console.log(`[LanguageHtmlUpdater] Setting initial HTML lang to "${initialLanguage}"`);
        htmlElement.lang = initialLanguage;
      }
    }
  }, [initialLanguage]);
  
  return null; // This component doesn't render anything
}