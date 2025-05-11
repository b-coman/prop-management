"use client";

/**
 * Utility to help debug issues with storage in the app
 */
export function debugSession(prefix: string) {
  if (typeof window === 'undefined') return {};
  
  const sessionStorage = window.sessionStorage;
  const result: Record<string, any> = {};
  
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(prefix)) {
      try {
        // Get the raw value
        const rawValue = sessionStorage.getItem(key);
        
        // Try to parse it if it's a JSON
        let parsedValue = rawValue;
        try {
          if (rawValue && rawValue !== 'null' && rawValue !== 'undefined') {
            parsedValue = JSON.parse(rawValue);
          }
        } catch (e) {
          // If it's not JSON, leave it as is
        }
        
        // Store both
        result[key] = {
          raw: rawValue,
          parsed: parsedValue,
          type: typeof parsedValue,
          isDate: parsedValue && parsedValue.match && 
            typeof parsedValue === 'string' && 
            parsedValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        };
      } catch (error) {
        result[key] = { 
          error: 'Error reading value',
          raw: sessionStorage.getItem(key)
        };
      }
    }
  }
  
  return result;
}