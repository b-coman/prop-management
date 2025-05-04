
"use client"; // This hook needs access to window.sessionStorage

import { useState, useEffect, useCallback } from 'react';

// Helper function to safely parse JSON
function safeJsonParse<T>(value: string | null): T | null {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch (e) {
    console.error("Error parsing session storage value:", e);
    return null;
  }
}

// Helper function to safely stringify JSON
function safeJsonStringify(value: unknown): string | null {
    try {
        // Handle Date objects specifically
        if (value instanceof Date) {
            return value.toISOString(); // Store dates as ISO strings
        }
        return JSON.stringify(value);
    } catch (e) {
        console.error("Error stringifying value for session storage:", e);
        return null;
    }
}

// Helper function to parse potentially stored date strings
function parseStoredValue<T>(storedValue: string | null): T | null {
    const parsed = safeJsonParse<T | string>(storedValue); // It might be a string (like ISO date) or other JSON
    if (typeof parsed === 'string') {
        // Attempt to parse as ISO date string
        const date = new Date(parsed);
        if (!isNaN(date.getTime())) {
            return date as T; // Return Date object if valid
        }
    }
    return parsed as T | null; // Return parsed value or null
}


export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Get initial value from session storage or use the provided initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue; // Server-side rendering fallback
    }
    try {
      const item = window.sessionStorage.getItem(key);
       // Parse stored item, handling potential JSON errors and date strings
      const parsedItem = item ? parseStoredValue<T>(item) : null;
      return parsedItem !== null ? parsedItem : initialValue;
    } catch (error) {
      console.error(`Error reading sessionStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to sessionStorage
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
      // Save to session storage
      if (typeof window !== 'undefined') {
          const stringifiedValue = safeJsonStringify(valueToStore);
          if (stringifiedValue !== null) {
             window.sessionStorage.setItem(key, stringifiedValue);
          } else {
             // Handle stringification error, maybe remove the item?
             window.sessionStorage.removeItem(key);
          }
      }
    } catch (error) {
      console.error(`Error setting sessionStorage key “${key}”:`, error);
    }
  }, [key, storedValue]); // Include storedValue in dependencies for the function update case

  // Listen for changes to the same key from other tabs/windows (optional)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea === window.sessionStorage && event.key === key) {
        try {
          const newValue = event.newValue ? parseStoredValue<T>(event.newValue) : null;
           if (newValue !== null) {
             setStoredValue(newValue);
           } else {
              setStoredValue(initialValue); // Fallback if parsing fails or value is removed
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
  }, [key, initialValue]); // Add initialValue dependency


  return [storedValue, setValue];
}
