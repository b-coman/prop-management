/**
 * Multilingual String Utilities
 * 
 * @file-status: ACTIVE
 * @created: 2025-05-31
 * @description: Utilities for handling multilingual string objects
 * @dependencies: @/types
 */

import type { MultilingualString } from '@/types';

/**
 * Extracts a string value from a multilingual string object
 * Fallback order: preferred language -> 'en' -> first available language -> fallback
 * 
 * @param value - The multilingual string or regular string
 * @param preferredLanguage - Preferred language code (defaults to 'en')
 * @param fallback - Fallback string if no translation found
 * @returns Extracted string value
 */
export function getLocalizedString(
  value: MultilingualString | string | undefined | null,
  preferredLanguage: string = 'en',
  fallback: string = ''
): string {
  // Handle null/undefined
  if (!value) return fallback;
  
  // If it's already a string, return it
  if (typeof value === 'string') return value;
  
  // Try preferred language first
  if (value[preferredLanguage]) {
    return value[preferredLanguage];
  }
  
  // Fallback to English
  if (value.en) {
    return value.en;
  }
  
  // Fallback to first available language
  const availableLanguages = Object.keys(value);
  if (availableLanguages.length > 0) {
    return value[availableLanguages[0]] || fallback;
  }
  
  // Return fallback if nothing found
  return fallback;
}

/**
 * Extracts property name as string for external services (like Stripe)
 * This is a convenience function specifically for property names
 * 
 * @param propertyName - Property name (multilingual or string)
 * @param language - Preferred language (defaults to 'en')
 * @returns Property name as string
 */
export function getPropertyNameString(
  propertyName: MultilingualString | string | undefined,
  language: string = 'en'
): string {
  return getLocalizedString(propertyName, language, 'Property');
}

/**
 * Gets all available languages for a multilingual string
 * 
 * @param value - The multilingual string
 * @returns Array of available language codes
 */
export function getAvailableLanguages(value: MultilingualString | string): string[] {
  if (typeof value === 'string') return ['en']; // Assume string is English
  return Object.keys(value);
}

/**
 * Checks if a multilingual string has a specific language
 * 
 * @param value - The multilingual string
 * @param language - Language code to check
 * @returns True if the language is available
 */
export function hasLanguage(value: MultilingualString | string, language: string): boolean {
  if (typeof value === 'string') return language === 'en';
  return language in value && !!value[language];
}