"use client";

import React from 'react';

interface TemporaryFallbackProps {
  message?: string;
}

export function TemporaryFallback({ message = "An error occurred" }: TemporaryFallbackProps) {
  return (
    <div className="max-w-2xl mx-auto w-full px-4 md:px-0 py-6">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
        <h3 className="font-medium text-amber-800">We encountered an issue</h3>
        <p className="text-sm text-amber-700 mt-1">
          {message}
        </p>
      </div>
    </div>
  );
}