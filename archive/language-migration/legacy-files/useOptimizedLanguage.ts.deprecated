import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface Translation {
  [key: string]: string | Translation;
}

interface LanguageHook {
  t: (key: string) => string;
  tc: (content: any, key: string) => string;
  lang: string;
  setLang: (lang: string) => void;
  isLoading: boolean;
}

// Lazy load translations
const loadTranslations = async (lang: string): Promise<Translation> => {
  try {
    const module = await import(`@/locales/${lang}.json`);
    return module.default;
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error);
    return {};
  }
};

// Cache for loaded translations
const translationCache = new Map<string, Translation>();

export function useOptimizedLanguage(): LanguageHook {
  const pathname = usePathname();
  const router = useRouter();
  const [translations, setTranslations] = useState<Translation>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Extract language from URL
  const getCurrentLang = useCallback((): string => {
    const segments = pathname.split('/');
    if (segments[1] === 'ro') return 'ro';
    if (segments[2] === 'ro') return 'ro';
    if (segments[3] === 'ro') return 'ro';
    return 'en';
  }, [pathname]);
  
  const currentLang = getCurrentLang();
  
  // Load translations with caching
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      
      // Check cache first
      if (translationCache.has(currentLang)) {
        setTranslations(translationCache.get(currentLang)!);
        setIsLoading(false);
        return;
      }
      
      // Load translations
      const trans = await loadTranslations(currentLang);
      translationCache.set(currentLang, trans);
      setTranslations(trans);
      setIsLoading(false);
    }
    
    load();
  }, [currentLang]);
  
  // Optimized translation getter with memoization
  const t = useCallback((key: string): string => {
    if (!translations || Object.keys(translations).length === 0) {
      return key; // Return key as fallback during loading
    }
    
    const keys = key.split('.');
    let value: any = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  }, [translations]);
  
  // Optimized content translation
  const tc = useCallback((content: any, key: string): string => {
    if (!content || typeof content !== 'object') return '';
    
    // Direct access for multilingual content
    if (content[currentLang]) {
      return content[currentLang][key] || content[currentLang];
    }
    
    // Fallback to English
    if (content.en) {
      return content.en[key] || content.en;
    }
    
    // Legacy format support
    if (content[key]) {
      return typeof content[key] === 'object' && content[key][currentLang] 
        ? content[key][currentLang] 
        : content[key];
    }
    
    return '';
  }, [currentLang]);
  
  // Optimized language setter
  const setLang = useCallback((newLang: string) => {
    if (newLang === currentLang) return;
    
    const segments = pathname.split('/');
    let newPath = pathname;
    
    if (currentLang === 'ro') {
      // Remove /ro from path
      if (segments[1] === 'ro') {
        segments.splice(1, 1);
      } else if (segments[2] === 'ro') {
        segments.splice(2, 1);
      } else if (segments[3] === 'ro') {
        segments.splice(3, 1);
      }
      newPath = segments.join('/') || '/';
    } else if (newLang === 'ro') {
      // Add /ro to path
      if (segments[1] === 'properties' && segments[2]) {
        segments.splice(3, 0, 'ro');
      } else if (segments[1]) {
        segments.splice(1, 0, 'ro');
      } else {
        newPath = '/ro';
      }
      newPath = segments.join('/');
    }
    
    // Update localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-language', newLang);
    }
    
    router.push(newPath);
  }, [currentLang, pathname, router]);
  
  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(() => ({
    t,
    tc,
    lang: currentLang,
    setLang,
    isLoading
  }), [t, tc, currentLang, setLang, isLoading]);
}