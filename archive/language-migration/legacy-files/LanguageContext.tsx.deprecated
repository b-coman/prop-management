"use client";

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';

interface LanguageContextType {
  currentLang: string;
  switchLanguage: (lang: string) => void;
  t: (key: string) => string;
  tc: (content: any) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
  initialLanguage?: string;
}

export function LanguageProvider({ children, initialLanguage }: LanguageProviderProps) {
  const pathname = usePathname();
  const [currentLang, setCurrentLang] = useState(initialLanguage || DEFAULT_LANGUAGE);
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize language from URL or browser preferences
  useEffect(() => {
    const detectLanguage = () => {
      // Check URL for language
      const segments = pathname.split('/');
      const propertyIndex = segments.indexOf('properties');
      
      if (propertyIndex >= 0 && segments[propertyIndex + 2]) {
        const possibleLang = segments[propertyIndex + 2];
        if (SUPPORTED_LANGUAGES.includes(possibleLang)) {
          return possibleLang;
        }
      }
      
      // Check localStorage
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
      
      return DEFAULT_LANGUAGE;
    };
    
    const detectedLang = detectLanguage();
    setCurrentLang(detectedLang);
  }, [pathname]);
  
  // Translation cache to prevent repeated requests
  const translationCacheRef = useRef<Map<string, any>>(new Map());
  
  // Load translations with caching
  useEffect(() => {
    const loadTranslations = async () => {
      // Check cache first
      if (translationCacheRef.current.has(currentLang)) {
        console.log(`[LanguageContext] 📦 Using cached translations for ${currentLang}`);
        setTranslations(translationCacheRef.current.get(currentLang));
        return;
      }
      
      setIsLoading(true);
      try {
        console.log(`[LanguageContext] 🌐 Fetching translations for ${currentLang}`);
        const response = await fetch(`/locales/${currentLang}.json`);
        if (!response.ok) {
          throw new Error(`Failed to load translations for ${currentLang}`);
        }
        const data = await response.json();
        
        // Cache the translations
        translationCacheRef.current.set(currentLang, data);
        setTranslations(data);
      } catch (error) {
        console.error(`Failed to load ${currentLang} translations:`, error);
        
        // Try to load default language as fallback
        if (currentLang !== DEFAULT_LANGUAGE) {
          try {
            // Check cache for default language first
            if (translationCacheRef.current.has(DEFAULT_LANGUAGE)) {
              console.log(`[LanguageContext] 📦 Using cached fallback translations for ${DEFAULT_LANGUAGE}`);
              setTranslations(translationCacheRef.current.get(DEFAULT_LANGUAGE));
            } else {
              console.log(`[LanguageContext] 🌐 Fetching fallback translations for ${DEFAULT_LANGUAGE}`);
              const fallbackResponse = await fetch(`/locales/${DEFAULT_LANGUAGE}.json`);
              const fallbackData = await fallbackResponse.json();
              
              // Cache the fallback translations
              translationCacheRef.current.set(DEFAULT_LANGUAGE, fallbackData);
              setTranslations(fallbackData);
            }
          } catch (fallbackError) {
            console.error(`Failed to load fallback translations:`, fallbackError);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTranslations();
  }, [currentLang]);
  
  // UI translation function
  const t = (key: string): string => {
    if (!key) return '';
    
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    
    return typeof value === 'string' ? value : key;
  };
  
  // Content translation function
  const tc = (content: any): string => {
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
  };
  
  // Switch language function
  const switchLanguage = (lang: string): void => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      console.warn(`Unsupported language: ${lang}`);
      return;
    }
    
    setCurrentLang(lang);
    localStorage.setItem('preferredLanguage', lang);
  };
  
  const value: LanguageContextType = {
    currentLang,
    switchLanguage,
    t,
    tc,
    isLoading
  };
  
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguageContext = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguageContext must be used within a LanguageProvider');
  }
  return context;
};

// Re-export for convenience
export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';