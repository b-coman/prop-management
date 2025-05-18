"use client";

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';

interface LanguageHook {
  currentLang: string;
  currentLanguage: string; // alias for compatibility
  switchLanguage: (lang: string) => void;
  changeLanguage: (lang: string) => void; // alias for compatibility
  t: (key: string) => string;
  tc: (content: any) => string;
  getLocalizedPath: (path: string, lang?: string) => string;
  isLanguageSupported: (lang: string) => boolean;
}

export function useLanguage(): LanguageHook {
  const pathname = usePathname();
  const router = useRouter();
  const [translations, setTranslations] = useState<Record<string, any>>({});
  
  // Extract current language from URL
  const getCurrentLang = useCallback((): string => {
    const segments = pathname.split('/');
    const propertyIndex = segments.indexOf('properties');
    
    if (propertyIndex >= 0 && segments[propertyIndex + 2]) {
      const possibleLang = segments[propertyIndex + 2];
      if (SUPPORTED_LANGUAGES.includes(possibleLang)) {
        return possibleLang;
      }
    }
    
    // Check if we're on the client side
    if (typeof window !== 'undefined') {
      // Check localStorage for saved preference
      const savedLang = localStorage.getItem('preferredLanguage');
      if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang)) {
        return savedLang;
      }
      
      // Check browser language
      const browserLang = navigator.language.toLowerCase();
      const primaryLang = browserLang.split('-')[0];
      if (SUPPORTED_LANGUAGES.includes(primaryLang)) {
        return primaryLang;
      }
    }
    
    return DEFAULT_LANGUAGE;
  }, [pathname]);
  
  const currentLang = getCurrentLang();
  
  // Load translations
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const response = await fetch(`/locales/${currentLang}.json`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setTranslations(data);
      } catch (error) {
        console.error(`Failed to load ${currentLang} translations:`, error);
        // Try to load default language as fallback
        if (currentLang !== DEFAULT_LANGUAGE) {
          try {
            const fallbackResponse = await fetch(`/locales/${DEFAULT_LANGUAGE}.json`);
            
            if (!fallbackResponse.ok) {
              throw new Error(`HTTP error! status: ${fallbackResponse.status}`);
            }
            
            const fallbackData = await fallbackResponse.json();
            setTranslations(fallbackData);
          } catch (fallbackError) {
            console.error(`Failed to load fallback translations:`, fallbackError);
          }
        }
      }
    };
    
    loadTranslations();
  }, [currentLang]);
  
  // Translation function for UI strings
  const t = useCallback((key: string): string => {
    if (!key) return '';
    
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    
    // Return the found translation or the key itself as fallback
    return typeof value === 'string' ? value : key;
  }, [translations]);
  
  // Translation function for content objects
  const tc = useCallback((content: any): string => {
    if (!content) return '';
    
    // If content is an object with language keys
    if (typeof content === 'object' && !Array.isArray(content)) {
      // First try the current language
      if (content[currentLang]) {
        return content[currentLang];
      }
      // Then try the default language
      if (content[DEFAULT_LANGUAGE]) {
        return content[DEFAULT_LANGUAGE];
      }
      // Finally, return the first available translation
      const firstKey = Object.keys(content).find(key => SUPPORTED_LANGUAGES.includes(key));
      if (firstKey) {
        return content[firstKey];
      }
    }
    
    // If content is already a string or not a translation object
    return String(content);
  }, [currentLang]);
  
  // Get localized path
  const getLocalizedPath = useCallback((path: string, lang?: string): string => {
    const targetLang = lang || currentLang;
    const segments = path.split('/');
    const propertyIndex = segments.indexOf('properties');
    
    if (propertyIndex >= 0 && segments[propertyIndex + 1]) {
      const slug = segments[propertyIndex + 1];
      let langIndex = propertyIndex + 2;
      
      // Remove existing language if present
      if (SUPPORTED_LANGUAGES.includes(segments[langIndex])) {
        segments.splice(langIndex, 1);
      }
      
      // Add new language if not default
      if (targetLang !== DEFAULT_LANGUAGE) {
        segments.splice(propertyIndex + 2, 0, targetLang);
      }
      
      return segments.join('/');
    }
    
    // For non-property pages, add language prefix
    if (targetLang !== DEFAULT_LANGUAGE) {
      return `/${targetLang}${path}`;
    }
    
    return path;
  }, [currentLang]);
  
  // Switch language
  const switchLanguage = useCallback((lang: string): void => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      console.warn(`Unsupported language: ${lang}`);
      return;
    }
    
    // Save preference (only on client side)
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLanguage', lang);
    }
    
    // Navigate to new language URL
    const newPath = getLocalizedPath(pathname, lang);
    router.push(newPath);
  }, [pathname, router, getLocalizedPath]);
  
  // Check if language is supported
  const isLanguageSupported = useCallback((lang: string): boolean => {
    return SUPPORTED_LANGUAGES.includes(lang);
  }, []);
  
  return {
    currentLang,
    currentLanguage: currentLang, // alias for compatibility
    switchLanguage,
    changeLanguage: switchLanguage, // alias for compatibility
    t,
    tc,
    getLocalizedPath,
    isLanguageSupported
  };
}