'use client';

import { useEffect } from 'react';

/**
 * Debug hook that logs details about an array of dates
 */
export function useDateDebug(dates: Date[], label: string): void {
  useEffect(() => {
    if (!dates || !Array.isArray(dates)) {
      console.log(`[DateDebug: ${label}] Invalid dates array:`, dates);
      return;
    }

    console.log(`[DateDebug: ${label}] Analyzing ${dates.length} dates`);
    
    if (dates.length === 0) {
      console.log(`[DateDebug: ${label}] Empty dates array`);
      return;
    }

    // Check if all items are Date objects
    const validDates = dates.filter(d => d instanceof Date && !isNaN(d.getTime()));
    console.log(`[DateDebug: ${label}] Valid Date objects: ${validDates.length} / ${dates.length}`);
    
    if (validDates.length > 0) {
      // Sample a few dates for inspection
      const sampleSize = Math.min(3, validDates.length);
      console.log(`[DateDebug: ${label}] Sample of ${sampleSize} dates:`);
      
      for (let i = 0; i < sampleSize; i++) {
        const date = validDates[i];
        console.log(`  Date ${i + 1}:`, {
          raw: date,
          iso: date.toISOString(),
          string: date.toString(),
          ymd: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
          components: {
            year: date.getFullYear(),
            month: date.getMonth() + 1, // 1-based for clarity
            day: date.getDate(),
            hours: date.getHours(),
            minutes: date.getMinutes(),
            seconds: date.getSeconds(),
            ms: date.getMilliseconds(),
            timezone: date.getTimezoneOffset() / -60 // Convert from minutes to hours, invert sign
          }
        });
      }
    }
    
    // Check for timezone issues (dates spanning multiple days)
    const daySet = new Set<string>();
    const nonUniqueYMD = new Set<string>();
    
    validDates.forEach(date => {
      const ymd = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      if (daySet.has(ymd)) {
        nonUniqueYMD.add(ymd);
      } else {
        daySet.add(ymd);
      }
    });
    
    if (nonUniqueYMD.size > 0) {
      console.warn(`[DateDebug: ${label}] Found ${nonUniqueYMD.size} days with multiple entries:`);
      console.warn([...nonUniqueYMD]);
    }
    
  }, [dates, label]);
}