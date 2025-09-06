"use client";

import { useRef, useEffect } from 'react';

interface RenderTrackerProps {
  name: string;
  data?: any;
}

export function RenderTracker({ name, data }: RenderTrackerProps) {
  const renderCountRef = useRef(0);
  const previousDataRef = useRef(data);
  
  renderCountRef.current += 1;
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 [RENDER-TRACKER] ${name} - Render #${renderCountRef.current}`, {
        renderCount: renderCountRef.current,
        data,
        previousData: previousDataRef.current,
        dataChanged: JSON.stringify(data) !== JSON.stringify(previousDataRef.current),
        timestamp: new Date().toISOString()
      });
    }
    
    previousDataRef.current = data;
  });
  
  if (process.env.NODE_ENV === 'development' && renderCountRef.current > 1) {
    console.log(`🚨 [RENDER-TRACKER] ${name} - RE-RENDERED! Count: ${renderCountRef.current}`);
  }
  
  return null; // This component doesn't render anything
}