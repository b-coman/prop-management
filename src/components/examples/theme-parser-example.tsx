'use client';

import { useEffect, useState } from 'react';
import { extractHSLValues, hslToString, modifyHSL, HSLColor, getHSLFromCSSVariable } from '@/lib/theme-utils';

/**
 * Example component demonstrating how to use theme utility functions
 */
export default function ThemeParserExample() {
  const [primaryColor, setPrimaryColor] = useState<HSLColor | null>(null);
  const [primaryColorModified, setPrimaryColorModified] = useState<HSLColor | null>(null);
  
  useEffect(() => {
    // Example 1: Getting color from CSS variable
    const primary = getHSLFromCSSVariable('primary');
    setPrimaryColor(primary);
    
    // Example 2: Creating a modified version of the color
    if (primary) {
      const darker = modifyHSL(primary, { l: Math.max(primary.l - 20, 0) });
      setPrimaryColorModified(darker);
    }
  }, []);
  
  // Example 3: Manual parsing of HSL string
  const manualParseExample = extractHSLValues('196 100% 47%');
  
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Theme Parser Example</h2>
      
      {/* Example of parsed primary color from CSS */}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Primary Color</h3>
        {primaryColor ? (
          <div className="space-y-1">
            <div 
              className="w-32 h-10 rounded-md" 
              style={{ backgroundColor: hslToString(primaryColor) }}
            />
            <p>HSL: {hslToString(primaryColor)}</p>
            <p>Hue: {primaryColor.h}, Saturation: {primaryColor.s}%, Lightness: {primaryColor.l}%</p>
          </div>
        ) : (
          <p>Loading primary color...</p>
        )}
      </div>
      
      {/* Example of modified color */}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Modified Primary Color (Darker)</h3>
        {primaryColorModified ? (
          <div className="space-y-1">
            <div 
              className="w-32 h-10 rounded-md" 
              style={{ backgroundColor: hslToString(primaryColorModified) }}
            />
            <p>HSL: {hslToString(primaryColorModified)}</p>
            <p>Hue: {primaryColorModified.h}, Saturation: {primaryColorModified.s}%, Lightness: {primaryColorModified.l}%</p>
          </div>
        ) : (
          <p>Loading modified color...</p>
        )}
      </div>
      
      {/* Example of manual parsing */}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Manual Parse Example</h3>
        {manualParseExample ? (
          <div className="space-y-1">
            <div 
              className="w-32 h-10 rounded-md" 
              style={{ backgroundColor: hslToString(manualParseExample) }}
            />
            <p>HSL: {hslToString(manualParseExample)}</p>
            <p>Hue: {manualParseExample.h}, Saturation: {manualParseExample.s}%, Lightness: {manualParseExample.l}%</p>
          </div>
        ) : (
          <p>Failed to parse manual example</p>
        )}
      </div>
      
      {/* With alpha transparency example */}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Alpha Transparency Example</h3>
        {primaryColor ? (
          <div className="space-y-2">
            <div className="flex space-x-2">
              <div 
                className="w-24 h-10 rounded-md" 
                style={{ backgroundColor: hslToString(primaryColor, 1.0) }}
              />
              <div 
                className="w-24 h-10 rounded-md" 
                style={{ backgroundColor: hslToString(primaryColor, 0.8) }}
              />
              <div 
                className="w-24 h-10 rounded-md" 
                style={{ backgroundColor: hslToString(primaryColor, 0.6) }}
              />
              <div 
                className="w-24 h-10 rounded-md" 
                style={{ backgroundColor: hslToString(primaryColor, 0.4) }}
              />
              <div 
                className="w-24 h-10 rounded-md" 
                style={{ backgroundColor: hslToString(primaryColor, 0.2) }}
              />
            </div>
            <p>Alpha values: 1.0, 0.8, 0.6, 0.4, 0.2</p>
          </div>
        ) : (
          <p>Loading alpha examples...</p>
        )}
      </div>
    </div>
  );
}