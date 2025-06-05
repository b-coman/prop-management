'use client';

import { useEffect } from 'react';

export default function TestScriptLoader() {
  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') return;
      
    // Check for the test-mode parameter
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('test-mode')) {
      console.log('Test mode detected. Loading test script...');
      
      // Create script element and set its source
      const script = document.createElement('script');
      
      // Determine which test script to load
      const testType = urlParams.get('test-mode');
      let scriptPath = '/browser-test-api.js'; // Default script
      
      // Allow specifying different test scripts
      if (testType === 'ui') {
        scriptPath = '/browser-test-ui.js';
      } else if (testType === 'simple') {
        scriptPath = '/browser-test-simple.js';
      } else if (testType === 'consec-dates') {
        scriptPath = '/browser-test-consec-dates.js';
        console.log('Loading specialized consecutive dates test script for analyzing consecutive blocked dates');
      }
      
      // Add timestamp to avoid caching
      scriptPath += `?t=${new Date().getTime()}`;
      
      // Log script loading attempt
      console.log(`TestScriptLoader: Loading script from: ${scriptPath}`);
      console.log(`TestScriptLoader: Full URL: ${window.location.origin}${scriptPath}`);
      
      script.src = scriptPath;
      script.defer = true;
      
      // Add an ID to avoid duplicate script loading
      script.id = 'browser-test-script';
      
      // Only add if not already present
      if (!document.getElementById('browser-test-script')) {
        document.body.appendChild(script);
        console.log(`Loaded test script: ${scriptPath}`);
      }
    }
  }, []); // Empty dependency array means this runs once on mount

  // This component doesn't render anything visible
  return null;
}