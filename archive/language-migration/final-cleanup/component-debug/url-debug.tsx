"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseDateSafe } from './date-utils';
import { format } from 'date-fns';

/**
 * Debug component specifically for URL parameters
 * This helps diagnose issues with URL parameter passing
 */
export function UrlDebugger() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  
  // Track all current URL parameters
  const [allParams, setAllParams] = useState<Record<string, string>>({});
  
  // Track parsed date objects
  const [parsedDates, setParsedDates] = useState<{
    checkIn: Date | null;
    checkOut: Date | null;
  }>({ checkIn: null, checkOut: null });
  
  useEffect(() => {
    setMounted(true);
    
    // Collect all search params
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    setAllParams(params);
    
    // Parse date parameters
    const checkInParam = searchParams.get('checkIn');
    const checkOutParam = searchParams.get('checkOut');
    
    setParsedDates({
      checkIn: checkInParam ? parseDateSafe(checkInParam, 'UrlDebugger') : null,
      checkOut: checkOutParam ? parseDateSafe(checkOutParam, 'UrlDebugger') : null,
    });
  }, [searchParams]);
  
  if (process.env.NODE_ENV !== 'development' || !mounted) {
    return null;
  }
  
  return (
    <div className="fixed bottom-0 left-0 p-2 bg-black/80 text-xs text-white z-50 max-w-xs overflow-auto max-h-screen">
      <h4 className="font-bold">URL Parameter Debug</h4>
      <pre className="mt-1 overflow-auto max-h-40">
        {Object.entries(allParams).map(([key, value]) => (
          <div key={key}>
            {key}: {value}
          </div>
        ))}
        
        {Object.keys(allParams).length === 0 && (
          <div className="text-yellow-400">No URL parameters found</div>
        )}
        
        <div className="mt-2 border-t border-gray-600 pt-1">
          <div>Parsed Dates:</div>
          <div>checkIn: {parsedDates.checkIn 
            ? format(parsedDates.checkIn, 'yyyy-MM-dd') 
            : 'null'}</div>
          <div>checkOut: {parsedDates.checkOut 
            ? format(parsedDates.checkOut, 'yyyy-MM-dd') 
            : 'null'}</div>
        </div>
      </pre>
    </div>
  );
}