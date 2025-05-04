
"use client"; // This hook needs access to window.sessionStorage

import { useState, useEffect, useCallback } from 'react';

// Helper function to safely parse JSON or return primitive if possible
function safeJsonParse<T>(value: string | null): T | string | boolean | number | null { // Return type allows primitives or original string
  if (value === null || value === undefined) return null;
  try {
    // Try parsing as JSON first
    return JSON.parse(value);
  } catch (e) {
    // If JSON parsing fails, check if it might be a primitive stored as a string
    const trimmedValue = value.trim();
    if (trimmedValue.toLowerCase() === 'true') return true;
    if (trimmedValue.toLowerCase() === 'false') return false;
    if (trimmedValue === 'null') return null;
    if (trimmedValue === 'undefined') return undefined; // Handle stored 'undefined' string

    // Check if it's a number string (handle potential leading/trailing spaces)
    // Ensure it's not an empty string before converting to number
    if (trimmedValue !== '' && !isNaN(Number(trimmedValue))) {
        // It looks like a number, return it as a number
        return Number(trimmedValue);
    }

    // If it's neither valid JSON nor a recognizable primitive string,
    // return the original string for the caller to potentially handle.
    // console.warn(`Session storage value for key wasn't JSON, returning raw string: "${value}"`);
    return value;
  }
}

// Helper function to potentially parse stored date strings or return other parsed types/strings
function parseStoredValue<T>(storedValue: string | null): T | string | boolean | number | null | undefined { // Return type updated
    const parsed = safeJsonParse<T>(storedValue); // This now returns T | string | boolean | number | null | undefined

    // If parsed is a string, try parsing as ISO date
    if (typeof parsed === 'string') {
        // Basic ISO date check (YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DD)
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-]\d{2}:\d{2}))?)?$/;
        if (isoDateRegex.test(parsed)) {
            const date = new Date(parsed);
            // Check if the date is valid (Date object handles invalid dates gracefully sometimes)
            // A more robust check might be needed depending on expected date formats
            if (!isNaN(date.getTime())) {
                // Ensure the parsed date string wasn't just YYYY-MM-DD which Date might interpret wrongly depending on timezone
                // If the original string contains 'T', it's likely a full ISO string
                if (parsed.includes('T') || parsed.length === 10) { // Accept YYYY-MM-DD too
                     return date as T; // Return Date object if valid
                }
            }
        }
    }
    // Return the parsed value (could be T, string, boolean, number, undefined) or null
    return parsed;
}


// Hook definition
export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.sessionStorage.getItem(key);
      const parsedItem = item ? parseStoredValue<T>(item) : null;

      if (parsedItem !== null && parsedItem !== undefined) {
          // Now we check the type of parsedItem against initialValue more carefully
          if (typeof parsedItem === typeof initialValue ||
              (parsedItem instanceof Date && initialValue instanceof Date) ||
              (initialValue === null && parsedItem === null) || // Allow null match
              (initialValue === undefined && parsedItem === undefined) // Allow undefined match
             ) {
             return parsedItem as T;
          } else {
              // Attempt type coercion if reasonable (e.g., string '1' to number 1)
               if (typeof initialValue === 'number' && typeof parsedItem === 'number') {
                  return parsedItem as T;
              }
              if (typeof initialValue === 'boolean' && typeof parsedItem === 'boolean') {
                  return parsedItem as T;
              }
               if (typeof initialValue === 'string' && typeof parsedItem === 'string') {
                  return parsedItem as T;
              }
              // If coercion isn't straightforward or types mismatch significantly, warn and fallback
             console.warn(`Session storage type mismatch for key "${key}". Expected ${typeof initialValue}, found ${typeof parsedItem}. Using initial value.`);
             return initialValue;
          }

      }
      return initialValue; // Fallback if item is null or undefined after parsing
    } catch (error) {
      console.error(`Error reading sessionStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
         // Convert value to string for storage
          let stringifiedValue;
          if (valueToStore === null) {
              stringifiedValue = 'null';
          } else if (valueToStore === undefined) {
              stringifiedValue = 'undefined';
          } else if (valueToStore instanceof Date) {
              stringifiedValue = valueToStore.toISOString(); // Store dates as ISO strings
          } else if (typeof valueToStore === 'object') { // Handle arrays and objects
              stringifiedValue = JSON.stringify(valueToStore); // Stringify objects/arrays
          } else {
              stringifiedValue = String(valueToStore); // Convert other primitives to string
          }
          window.sessionStorage.setItem(key, stringifiedValue);
      }
    } catch (error) {
      console.error(`Error setting sessionStorage key “${key}”:`, error);
    }
  }, [key, storedValue]);

  // Optional: Listen for storage changes (consider impact on complex state)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea === window.sessionStorage && event.key === key) {
        try {
          const newValue = event.newValue ? parseStoredValue<T>(event.newValue) : null;
          // Similar type check as initial load
           if (newValue !== null && newValue !== undefined) {
               if (typeof newValue === typeof initialValue ||
                   (newValue instanceof Date && initialValue instanceof Date) ||
                   (initialValue === null && newValue === null) ||
                   (initialValue === undefined && newValue === undefined)) {
                 setStoredValue(newValue as T);
               } else {
                   // Handle potential type mismatch on update, maybe fallback or log
                    console.warn(`Session storage update type mismatch for key "${key}". Ignoring update.`);
                    // Or fallback: setStoredValue(initialValue);
               }
            } else {
                 // Handle case where value is removed or becomes null/undefined
                 if (initialValue === null || initialValue === undefined) {
                    setStoredValue(initialValue);
                 } else {
                     // If initial value wasn't null/undefined, but storage becomes so,
                     // decide if you should revert to initial or accept null/undefined
                     setStoredValue(newValue as T); // Accept null/undefined if parsed as such
                 }

            }
        } catch (error) {
          console.error(`Error handling storage change for key “${key}”:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]); // Added initialValue to dependency array

  return [storedValue, setValue];
}
