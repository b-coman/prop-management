"use client";

import { parseISO, isValid, startOfDay } from 'date-fns';

// Helper function for safely parsing date strings from URL params
export const parseDateSafe = (dateStr: string | undefined | null, componentName: string = 'DateUtils'): Date | null => {
  if (!dateStr) return null;

  console.log(`[${componentName}] Parsing date string: "${dateStr}"`);

  try {
    // First, try using parseISO which handles ISO format strings like YYYY-MM-DD
    const parsedISO = parseISO(dateStr);
    if (isValid(parsedISO)) {
      console.log(`[${componentName}] Successfully parsed ISO date: ${parsedISO.toISOString()}`);
      return startOfDay(parsedISO);
    }

    // If parseISO fails, try using standard Date constructor with explicit time zone setting
    const parsed = new Date(dateStr);
    if (isValid(parsed)) {
      console.log(`[${componentName}] Successfully parsed with Date constructor: ${parsed.toISOString()}`);
      return startOfDay(parsed);
    }

    // If date has dashes but wrong format, try to manually parse it
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        // Try different date format possibilities (yyyy-MM-dd, dd-MM-yyyy, etc.)
        const attempts = [
          new Date(`${parts[0]}-${parts[1]}-${parts[2]}`), // As is
          new Date(`${parts[2]}-${parts[1]}-${parts[0]}`), // Reversed
          new Date(`${parts[2]}-${parts[0]}-${parts[1]}`), // Other common format
        ];

        for (const attempt of attempts) {
          if (isValid(attempt)) {
            console.log(`[${componentName}] Successfully parsed using parts: ${attempt.toISOString()}`);
            return startOfDay(attempt);
          }
        }
      }
    }

    console.error(`[${componentName}] Failed to parse date string: "${dateStr}"`);
    return null;
  } catch (error) {
    console.error(`[${componentName}] Error parsing date string "${dateStr}":`, error);
    return null;
  }
};