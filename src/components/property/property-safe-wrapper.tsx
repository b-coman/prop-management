"use client";

import { useEffect, useState } from 'react';
import { PropertyPageRenderer } from './property-page-renderer';

export function PropertySafeWrapper(props: any) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading property...</div>;
  }

  try {
    return <PropertyPageRenderer {...props} />;
  } catch (error) {
    console.error('PropertyPageRenderer error:', error);
    return (
      <div className="p-4">
        <h1 className="text-2xl">Property Error</h1>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }
}