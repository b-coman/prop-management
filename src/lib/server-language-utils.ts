// Server-side language utilities for handling multilingual content
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './language-constants';

/**
 * Server-side function to extract the appropriate translation from a multilingual object
 * @param content - The content to translate (can be string or multilingual object)
 * @param preferredLang - The preferred language code (defaults to en)
 * @returns The translated string
 */
export function serverTranslateContent(content: any, preferredLang: string = DEFAULT_LANGUAGE): string {
  if (!content) return '';
  
  // If content is already a string, return it
  if (typeof content === 'string') {
    return content;
  }
  
  // If content is an object with language keys
  if (typeof content === 'object' && !Array.isArray(content)) {
    // First try the preferred language
    if (content[preferredLang] && typeof content[preferredLang] === 'string') {
      return content[preferredLang];
    }
    
    // Then try the default language
    if (content[DEFAULT_LANGUAGE] && typeof content[DEFAULT_LANGUAGE] === 'string') {
      return content[DEFAULT_LANGUAGE];
    }
    
    // Finally, return the first available translation
    const firstKey = Object.keys(content).find(key => 
      SUPPORTED_LANGUAGES.includes(key) && typeof content[key] === 'string'
    );
    if (firstKey) {
      return content[firstKey];
    }
    
    // If no valid translation found, try to return any string value
    const anyStringKey = Object.keys(content).find(key => typeof content[key] === 'string');
    if (anyStringKey) {
      return content[anyStringKey];
    }
    
    // If still no string found, return the property slug if available
    if (content.slug && typeof content.slug === 'string') {
      return content.slug;
    }
    
    // As a last resort, return an empty string to avoid rendering an object
    console.warn('Unable to extract string from multilingual content:', content);
    return '';
  }
  
  // If content is not a string or a proper multilingual object, convert to string
  return String(content || '');
}

/**
 * Extract language preference from URL or headers
 * @param pathname - Current pathname
 * @param headers - Request headers
 * @returns The detected language code
 */
export function getServerLanguagePreference(pathname?: string, headers?: Headers): string {
  // Check URL for language
  if (pathname) {
    const segments = pathname.split('/');
    const propertyIndex = segments.indexOf('properties');
    
    if (propertyIndex >= 0 && segments[propertyIndex + 2]) {
      const possibleLang = segments[propertyIndex + 2];
      if (SUPPORTED_LANGUAGES.includes(possibleLang)) {
        return possibleLang;
      }
    }
  }
  
  // Check Accept-Language header
  if (headers) {
    const acceptLang = headers.get('accept-language');
    if (acceptLang) {
      const primaryLang = acceptLang.split(',')[0].split('-')[0].toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(primaryLang)) {
        return primaryLang;
      }
    }
  }
  
  return DEFAULT_LANGUAGE;
}