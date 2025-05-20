"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

// Event bus for in-memory synchronization (within the same tab)
// This allows components in the same tab to communicate storage changes
export const StorageEventBus = {
  listeners: new Map<string, Set<(newValue: any) => void>>(),
  
  subscribe(key: string, callback: (newValue: any) => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)?.add(callback);
    
    return () => {
      this.listeners.get(key)?.delete(callback);
      // Clean up the set if empty
      if (this.listeners.get(key)?.size === 0) {
        this.listeners.delete(key);
      }
    };
  },
  
  publish(key: string, newValue: any) {
    this.listeners.get(key)?.forEach(callback => {
      try {
        callback(newValue);
      } catch (error) {
        console.error(`Error in StorageEventBus callback for key "${key}":`, error);
      }
    });
  }
};

// Helper function to safely parse stored values
function parseStoredValue<T>(key: string, storedValue: string | null, initialValue: T): T {
  if (storedValue === null) return initialValue;

  try {
    // Handle special cases of primitives stored as strings
    if (storedValue === 'null') return null as unknown as T;
    if (storedValue === 'undefined') return undefined as unknown as T;
    if (storedValue === 'true') return true as unknown as T;
    if (storedValue === 'false') return false as unknown as T;

    // Special handling for dates
    // If the key suggests this might be a date (contains "Date" in the key)
    // and the value looks like an ISO date string, convert it to a Date
    if ((key.includes('Date') || key.includes('date')) && typeof storedValue === 'string') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-]\d{2}:\d{2}))?)?$/;
      if (dateRegex.test(storedValue)) {
        const date = new Date(storedValue);
        if (!isNaN(date.getTime())) {
          console.log(`[parseStoredValue] Converting ISO string to Date for key "${key}":`, storedValue, date);
          return date as unknown as T;
        }
      }
    }

    // Try parsing as JSON
    const parsed = JSON.parse(storedValue);

    // Check if this is potentially a date stored as a string from parsed JSON
    if (parsed && typeof parsed === 'string') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-]\d{2}:\d{2}))?)?$/;
      if (dateRegex.test(parsed)) {
        const date = new Date(parsed);
        if (!isNaN(date.getTime())) {
          console.log(`[parseStoredValue] Converting JSON date string to Date for key "${key}":`, parsed, date);
          return date as unknown as T;
        }
      }
    }

    return parsed;
  } catch (error) {
    // If JSON parsing fails, it might be a primitive stored as a string
    if (typeof initialValue === 'number' && !isNaN(Number(storedValue))) {
      return Number(storedValue) as unknown as T;
    }

    // Check if the raw string is a date format - especially when initialValue is null
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-]\d{2}:\d{2}))?)?$/;
    if ((key.includes('Date') || key.includes('date')) && dateRegex.test(storedValue)) {
      const date = new Date(storedValue);
      if (!isNaN(date.getTime())) {
        console.log(`[parseStoredValue] Converting raw string to Date for key "${key}":`, storedValue, date);
        return date as unknown as T;
      }
    }

    // For other strings, just return as is
    return storedValue as unknown as T;
  }
}

// Helper to stringify values for storage
function stringifyForStorage(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  // Special case for Date objects
  if (value instanceof Date) {
    // Ensure date is valid before serializing
    if (isNaN(value.getTime())) {
      console.error(`[stringifyForStorage] Invalid Date object: ${value}`);
      return 'null'; // Treat invalid dates as null
    }
    // Store dates directly as ISO strings, not wrapped in JSON
    return value.toISOString();
  }

  // For objects and arrays
  if (typeof value === 'object') {
    try {
      // Check if the object might have Date properties and convert them
      const processed = JSON.parse(JSON.stringify(value, (key, val) => {
        // Convert any Date objects in the JSON to ISO strings
        if (val instanceof Date) {
          if (isNaN(val.getTime())) {
            console.error(`[stringifyForStorage] Invalid Date in object property: ${key}`);
            return null; // Treat invalid dates as null
          }
          return val.toISOString();
        }
        return val;
      }));

      return JSON.stringify(processed);
    } catch (error) {
      console.error(`[stringifyForStorage] Error processing object:`, error);
      // Fallback to simple stringification if there's a circular reference or other issue
      return '{}';
    }
  }

  // For primitives
  return String(value);
}

// Options for the hook
interface SyncedStorageOptions {
  storage?: 'session' | 'local'; // Storage type
  sync?: boolean;                // Whether to sync across tabs
  debug?: boolean;               // Enable debug logging
  prefix?: string;               // Key prefix for namespacing
  serializer?: (value: any) => string; // Custom serializer
  deserializer?: (value: string, defaultValue: any) => any; // Custom deserializer
}

// Default options
const defaultOptions: SyncedStorageOptions = {
  storage: 'session',
  sync: true,
  debug: false,
  prefix: 'app_',
};

/**
 * Enhanced storage hook that synchronizes across tabs and components
 * 
 * @param key Storage key
 * @param initialValue Default value if key doesn't exist in storage
 * @param options Configuration options
 * @returns [value, setValue, {removeItem, clearAll}]
 */
export function useSyncedStorage<T>(
  key: string,
  initialValue: T,
  options: SyncedStorageOptions = {}
): [T, (value: T | ((val: T) => T)) => void, { removeItem: () => void; clearAll: () => void }] {
  // Merge default options
  const opts = { ...defaultOptions, ...options };
  
  // Prefixed key for storage
  const prefixedKey = opts.prefix ? `${opts.prefix}${key}` : key;
  
  // Get storage object based on options
  const storageObj = opts.storage === 'local' ? 
    (typeof window !== 'undefined' ? window.localStorage : null) : 
    (typeof window !== 'undefined' ? window.sessionStorage : null);
  
  // Track if we're ignoring the next storage event (when we triggered it ourselves)
  const ignoreNextStorageEvent = useRef(false);
  
  // Track mounted state to prevent setting state after unmount
  const isMounted = useRef(true);
  
  // Initialize state
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined' || !storageObj) {
      return initialValue;
    }
    
    try {
      const storedItem = storageObj.getItem(prefixedKey);
      if (storedItem) {
        const valueToUse = opts.deserializer 
          ? opts.deserializer(storedItem, initialValue)
          : parseStoredValue(prefixedKey, storedItem, initialValue);
        
        if (opts.debug) {
          console.log(`[useSyncedStorage] Loaded "${prefixedKey}":`, valueToUse);
        }
        
        return valueToUse;
      }
    } catch (error) {
      console.error(`[useSyncedStorage] Error loading "${prefixedKey}":`, error);
    }
    
    return initialValue;
  });
  
  // Helper function for comparing values, with special handling for dates
  const valueEquals = (a: any, b: any): boolean => {
    // Handle null/undefined
    if (a === b) return true;
    if (a == null || b == null) return false;
    
    // Special handling for Date objects
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    
    // Handle primitive types
    if (typeof a !== 'object' && typeof b !== 'object') {
      return a === b;
    }
    
    // For objects, do a simple shallow comparison
    // This is a basic implementation - for deep equality you would need a more complex solution
    if (typeof a === 'object' && typeof b === 'object') {
      // Compare arrays
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((val, idx) => valueEquals(val, b[idx]));
      }
      
      // Compare regular objects
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(key => valueEquals(a[key], b[key]));
    }
    
    return false;
  };
  
  // Update local state and storage
  const setValue = useCallback((valueOrFn: T | ((val: T) => T)) => {
    if (!isMounted.current) return;
    
    try {
      const newValue = valueOrFn instanceof Function ? valueOrFn(state) : valueOrFn;
      
      // Skip update if the value hasn't changed
      // This prevents unnecessary re-renders and storage operations
      if (valueEquals(state, newValue)) {
        if (opts.debug) {
          console.log(`[useSyncedStorage] Skipped update for "${prefixedKey}" - value unchanged`);
        }
        return;
      }
      
      // Update local state
      setState(newValue);
      
      // Skip storage update if storage is not available
      if (typeof window === 'undefined' || !storageObj) {
        return;
      }
      
      // Serialize the value
      const serialized = opts.serializer
        ? opts.serializer(newValue)
        : stringifyForStorage(newValue);
      
      // Update storage
      if (newValue === null || newValue === undefined) {
        storageObj.removeItem(prefixedKey);
      } else {
        storageObj.setItem(prefixedKey, serialized);
      }
      
      // Set flag to ignore next storage event in this tab
      ignoreNextStorageEvent.current = true;
      
      // Notify other components in the same tab
      StorageEventBus.publish(prefixedKey, newValue);
      
      if (opts.debug) {
        console.log(`[useSyncedStorage] Updated "${prefixedKey}":`, newValue);
      }
    } catch (error) {
      console.error(`[useSyncedStorage] Error setting "${prefixedKey}":`, error);
    }
  }, [prefixedKey, state, opts.debug, opts.serializer, storageObj]);
  
  // Additional utilities
  const utils = {
    removeItem: useCallback(() => {
      if (typeof window === 'undefined' || !storageObj) return;
      
      try {
        storageObj.removeItem(prefixedKey);
        setState(initialValue);
        
        // Set flag to ignore next storage event in this tab
        ignoreNextStorageEvent.current = true;
        
        // Notify other components in the same tab
        StorageEventBus.publish(prefixedKey, initialValue);
        
        if (opts.debug) {
          console.log(`[useSyncedStorage] Removed "${prefixedKey}"`);
        }
      } catch (error) {
        console.error(`[useSyncedStorage] Error removing "${prefixedKey}":`, error);
      }
    }, [prefixedKey, initialValue, opts.debug, storageObj]),
    
    clearAll: useCallback(() => {
      if (typeof window === 'undefined' || !storageObj) return;
      
      try {
        storageObj.clear();
        setState(initialValue);
        
        if (opts.debug) {
          console.log(`[useSyncedStorage] Cleared all ${opts.storage} storage`);
        }
      } catch (error) {
        console.error(`[useSyncedStorage] Error clearing ${opts.storage} storage:`, error);
      }
    }, [initialValue, opts.debug, opts.storage, storageObj]),
  };
  
  // Listen for changes in other tabs
  useEffect(() => {
    if (typeof window === 'undefined' || !opts.sync) return;
    
    const handleStorageChange = (event: StorageEvent) => {
      // Skip if change came from this tab
      if (ignoreNextStorageEvent.current) {
        ignoreNextStorageEvent.current = false;
        return;
      }
      
      // Skip if not our key or not from our storage
      if (
        event.key !== prefixedKey || 
        (opts.storage === 'local' && event.storageArea !== localStorage) ||
        (opts.storage === 'session' && event.storageArea !== sessionStorage)
      ) {
        return;
      }
      
      try {
        if (opts.debug) {
          console.log(`[useSyncedStorage] Storage event for "${prefixedKey}":`, event.newValue);
        }
        
        // Get new value (or initialValue if key was removed)
        const newValue = event.newValue 
          ? (opts.deserializer 
            ? opts.deserializer(event.newValue, initialValue)
            : parseStoredValue(prefixedKey, event.newValue, initialValue))
          : initialValue;
        
        // Update state if component is still mounted
        if (isMounted.current) {
          setState(newValue);
        }
      } catch (error) {
        console.error(`[useSyncedStorage] Error handling storage event for "${prefixedKey}":`, error);
      }
    };
    
    // Subscribe to storage events for cross-tab communication
    window.addEventListener('storage', handleStorageChange);
    
    // Track mount status
    return () => {
      isMounted.current = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [prefixedKey, initialValue, opts.storage, opts.sync, opts.debug, opts.deserializer]);
  
  // Subscribe to the event bus for same-tab communication
  useEffect(() => {
    if (typeof window === 'undefined' || !opts.sync) return;
    
    const handleLocalChange = (newValue: T) => {
      // Skip if change came from this component
      if (ignoreNextStorageEvent.current) {
        ignoreNextStorageEvent.current = false;
        return;
      }
      
      // Update state if component is still mounted
      if (isMounted.current) {
        setState(newValue);
        
        if (opts.debug) {
          console.log(`[useSyncedStorage] Local event for "${prefixedKey}":`, newValue);
        }
      }
    };
    
    // Subscribe to the event bus
    const unsubscribe = StorageEventBus.subscribe(prefixedKey, handleLocalChange);
    
    return () => {
      unsubscribe();
    };
  }, [prefixedKey, opts.sync, opts.debug]);
  
  return [state, setValue, utils];
}

/**
 * Hook specifically for session storage with sync
 */
export function useSyncedSessionStorage<T>(
  key: string,
  initialValue: T,
  options: Omit<SyncedStorageOptions, 'storage'> = {}
) {
  return useSyncedStorage(key, initialValue, { ...options, storage: 'session' });
}

/**
 * Hook specifically for local storage with sync
 */
export function useSyncedLocalStorage<T>(
  key: string,
  initialValue: T,
  options: Omit<SyncedStorageOptions, 'storage'> = {}
) {
  return useSyncedStorage(key, initialValue, { ...options, storage: 'local' });
}

/**
 * Directly set a value in storage from anywhere (not hook-based)
 */
export function setSyncedStorageValue<T>(
  key: string,
  value: T,
  options: SyncedStorageOptions = {}
): void {
  const opts = { ...defaultOptions, ...options };
  const prefixedKey = opts.prefix ? `${opts.prefix}${key}` : key;
  
  const storageObj = opts.storage === 'local' 
    ? (typeof window !== 'undefined' ? window.localStorage : null)
    : (typeof window !== 'undefined' ? window.sessionStorage : null);
  
  if (!storageObj) return;
  
  try {
    // Serialize the value
    const serialized = opts.serializer
      ? opts.serializer(value)
      : stringifyForStorage(value);
    
    // Update storage
    if (value === null || value === undefined) {
      storageObj.removeItem(prefixedKey);
    } else {
      storageObj.setItem(prefixedKey, serialized);
    }
    
    // Notify other components
    StorageEventBus.publish(prefixedKey, value);
    
    if (opts.debug) {
      console.log(`[setSyncedStorageValue] Updated "${prefixedKey}":`, value);
    }
  } catch (error) {
    console.error(`[setSyncedStorageValue] Error setting "${prefixedKey}":`, error);
  }
}

/**
 * Get a value from storage from anywhere (not hook-based)
 */
export function getSyncedStorageValue<T>(
  key: string,
  defaultValue: T,
  options: SyncedStorageOptions = {}
): T {
  const opts = { ...defaultOptions, ...options };
  const prefixedKey = opts.prefix ? `${opts.prefix}${key}` : key;

  const storageObj = opts.storage === 'local'
    ? (typeof window !== 'undefined' ? window.localStorage : null)
    : (typeof window !== 'undefined' ? window.sessionStorage : null);

  if (!storageObj) return defaultValue;

  try {
    const storedItem = storageObj.getItem(prefixedKey);
    if (!storedItem) return defaultValue;

    const valueToUse = opts.deserializer
      ? opts.deserializer(storedItem, defaultValue)
      : parseStoredValue(prefixedKey, storedItem, defaultValue);

    if (opts.debug) {
      console.log(`[getSyncedStorageValue] Retrieved "${prefixedKey}":`, valueToUse);
    }

    return valueToUse;
  } catch (error) {
    console.error(`[getSyncedStorageValue] Error getting "${prefixedKey}":`, error);
    return defaultValue;
  }
}

/**
 * Utility to clear all synced storage values with a specific prefix
 * Useful for clearing all booking related data at once
 */
export function clearSyncedStorageByPrefix(
  prefix: string,
  options: SyncedStorageOptions = {}
): void {
  const opts = { ...defaultOptions, ...options };

  const storageObj = opts.storage === 'local'
    ? (typeof window !== 'undefined' ? window.localStorage : null)
    : (typeof window !== 'undefined' ? window.sessionStorage : null);

  if (!storageObj) return;

  // Get all keys that start with the prefix
  const keysToRemove: string[] = [];
  for (let i = 0; i < storageObj.length; i++) {
    const key = storageObj.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  // Remove all matching keys
  keysToRemove.forEach(key => {
    try {
      // Publish null to the event bus to reset components
      StorageEventBus.publish(key, null);
      // Remove from storage
      storageObj.removeItem(key);

      if (opts.debug) {
        console.log(`[clearSyncedStorageByPrefix] Removed "${key}"`);
      }
    } catch (error) {
      console.error(`[clearSyncedStorageByPrefix] Error removing "${key}":`, error);
    }
  });
}