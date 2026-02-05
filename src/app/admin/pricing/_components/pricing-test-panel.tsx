'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PlayIcon, ExternalLinkIcon, RefreshCwIcon, BugIcon } from 'lucide-react';

export function PricingTestPanel({ propertyId }: { propertyId: string }) {
  const [testScriptLoaded, setTestScriptLoaded] = useState(false);
  const [testTabValue, setTestTabValue] = useState('api');
  const [loading, setLoading] = useState(false);

  // Helper to load test script
  const loadTestScript = (scriptType: string) => {
    setLoading(true);

    // Remove existing script if any
    const existingScript = document.getElementById('browser-test-script');
    if (existingScript) {
      document.body.removeChild(existingScript);

      // Also try to remove any existing test panel (in case it was loaded previously)
      const existingPanel = document.getElementById('pricing-test-panel');
      if (existingPanel) {
        try {
          document.body.removeChild(existingPanel);
        } catch (e) {
          console.error('Error removing existing panel:', e);
        }
      }
    }

    // Create script element
    const script = document.createElement('script');

    // Set script path based on selected type
    // Files in public folder are served from root URL path
    // Add timestamp to avoid caching issues
    const timestamp = new Date().getTime();

    let scriptPath = `/browser-test-api.js?t=${timestamp}`;
    if (scriptType === 'ui') {
      scriptPath = `/browser-test-ui.js?t=${timestamp}`;
    } else if (scriptType === 'simple') {
      scriptPath = `/browser-test-simple.js?t=${timestamp}`;
    } else if (scriptType === 'consec-dates') {
      scriptPath = `/browser-test-consec-dates.js?t=${timestamp}`;
    }

    // Log script loading attempt
    console.log(`Attempting to load test script from: ${scriptPath}`);

    script.src = scriptPath;
    script.defer = true;
    script.id = 'browser-test-script';

    // Handle script loading
    script.onload = () => {
      setTestScriptLoaded(true);
      setLoading(false);
    };

    script.onerror = (error) => {
      console.error(`Failed to load test script: ${scriptPath}`, error);
      alert(`Failed to load test script at path: ${scriptPath}. Check if the file exists.`);
      setLoading(false);
    };

    // Add script to body
    document.body.appendChild(script);
  };

  // Open property in a new tab for testing
  const openPropertyInNewTab = () => {
    // Convert property ID to slug if needed
    const propertySlug = propertyId.replace(/\s+/g, '-').toLowerCase();
    window.open(`/booking/check/${propertySlug}?test-mode=${testTabValue}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Use the pricing test panel to discover and validate pricing and availability rules for your property.
        The test panel will automatically find test scenarios based on your property configuration.
      </div>

      <Tabs
        value={testTabValue}
        onValueChange={(value) => {
          setTestTabValue(value);
          setTestScriptLoaded(false);
        }}
        className="w-full"
      >
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="api">API-Based Tests</TabsTrigger>
          <TabsTrigger value="ui">UI-Focused Tests</TabsTrigger>
          <TabsTrigger value="simple">Simple Tests</TabsTrigger>
          <TabsTrigger value="consec-dates">Consecutive Dates</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">API-Based Test Panel</h3>
              <p className="text-sm text-muted-foreground">
                Discovers real test scenarios using your property's pricing and availability data
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={testScriptLoaded ? "outline" : "default"}
                onClick={() => loadTestScript('api')}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCwIcon className="mr-1 h-4 w-4 animate-spin" />
                ) : testScriptLoaded ? (
                  <RefreshCwIcon className="mr-1 h-4 w-4" />
                ) : (
                  <PlayIcon className="mr-1 h-4 w-4" />
                )}
                {testScriptLoaded ? "Reload Tests" : "Run Tests"}
              </Button>

              <Button variant="outline" onClick={openPropertyInNewTab}>
                <ExternalLinkIcon className="mr-1 h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
          </div>

          {!testScriptLoaded && !loading && (
            <Card className="p-4">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BugIcon className="h-10 w-10 text-primary/50 mb-3" />
                <h3 className="text-lg font-medium mb-1">Test Panel Not Loaded</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Click "Run Tests" to load the interactive test panel at the bottom of the page.
                  It will automatically discover test scenarios based on your property's data.
                </p>
              </div>
            </Card>
          )}

          {loading && (
            <Card className="p-4">
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCwIcon className="h-10 w-10 text-primary/50 animate-spin mb-3" />
                <h3 className="text-lg font-medium">Loading Test Panel...</h3>
              </div>
            </Card>
          )}

          {testScriptLoaded && (
            <Card className="p-4">
              <div className="flex flex-col">
                <h3 className="text-lg font-medium mb-2">Test Panel Loaded</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The test panel has been loaded and should appear at the bottom of the screen.
                  If you don't see it, try scrolling down or reloading the tests.
                </p>
                <div className="flex items-center p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="text-amber-600 mr-2 text-sm">
                    <strong>Note:</strong> The test panel is attached to the bottom of the page.
                    Navigating away from this page will remove the test panel.
                  </div>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ui" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">UI-Focused Test Panel</h3>
              <p className="text-sm text-muted-foreground">
                Tests with predefined scenarios focused on UI interaction
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={testScriptLoaded ? "outline" : "default"}
                onClick={() => loadTestScript('ui')}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCwIcon className="mr-1 h-4 w-4 animate-spin" />
                ) : testScriptLoaded ? (
                  <RefreshCwIcon className="mr-1 h-4 w-4" />
                ) : (
                  <PlayIcon className="mr-1 h-4 w-4" />
                )}
                {testScriptLoaded ? "Reload Tests" : "Run Tests"}
              </Button>

              <Button variant="outline" onClick={openPropertyInNewTab}>
                <ExternalLinkIcon className="mr-1 h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
          </div>

          {!testScriptLoaded && !loading && (
            <Card className="p-4">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BugIcon className="h-10 w-10 text-primary/50 mb-3" />
                <h3 className="text-lg font-medium mb-1">Test Panel Not Loaded</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Click "Run Tests" to load the UI-focused test panel with predefined scenarios.
                </p>
              </div>
            </Card>
          )}

          {loading && (
            <Card className="p-4">
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCwIcon className="h-10 w-10 text-primary/50 animate-spin mb-3" />
                <h3 className="text-lg font-medium">Loading Test Panel...</h3>
              </div>
            </Card>
          )}

          {testScriptLoaded && (
            <Card className="p-4">
              <div className="flex flex-col">
                <h3 className="text-lg font-medium mb-2">Test Panel Loaded</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The UI test panel has been loaded at the bottom of the screen.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="simple" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Simple Test Runner</h3>
              <p className="text-sm text-muted-foreground">
                Runs automated tests without a UI panel and logs results to console
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={testScriptLoaded ? "outline" : "default"}
                onClick={() => loadTestScript('simple')}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCwIcon className="mr-1 h-4 w-4 animate-spin" />
                ) : testScriptLoaded ? (
                  <RefreshCwIcon className="mr-1 h-4 w-4" />
                ) : (
                  <PlayIcon className="mr-1 h-4 w-4" />
                )}
                {testScriptLoaded ? "Run Again" : "Run Tests"}
              </Button>

              <Button variant="outline" onClick={openPropertyInNewTab}>
                <ExternalLinkIcon className="mr-1 h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
          </div>

          {!testScriptLoaded && !loading && (
            <Card className="p-4">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BugIcon className="h-10 w-10 text-primary/50 mb-3" />
                <h3 className="text-lg font-medium mb-1">Test Runner Not Started</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Click "Run Tests" to run the simple test suite. Results will be logged to the browser console.
                </p>
              </div>
            </Card>
          )}

          {loading && (
            <Card className="p-4">
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCwIcon className="h-10 w-10 text-primary/50 animate-spin mb-3" />
                <h3 className="text-lg font-medium">Running Tests...</h3>
              </div>
            </Card>
          )}

          {testScriptLoaded && (
            <Card className="p-4">
              <div className="flex flex-col">
                <h3 className="text-lg font-medium mb-2">Tests Completed</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The simple tests have been executed. Check the browser console (F12) to see the results.
                </p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-sm font-mono text-slate-700 whitespace-pre-wrap">
                    <strong>Console Output:</strong> Press F12 to view detailed test results
                  </div>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="consec-dates" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Consecutive Blocked Dates Analyzer</h3>
              <p className="text-sm text-muted-foreground">
                Specialized tool for analyzing consecutive blocked dates and checkout behavior
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={testScriptLoaded ? "outline" : "default"}
                onClick={() => loadTestScript('consec-dates')}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCwIcon className="mr-1 h-4 w-4 animate-spin" />
                ) : testScriptLoaded ? (
                  <RefreshCwIcon className="mr-1 h-4 w-4" />
                ) : (
                  <PlayIcon className="mr-1 h-4 w-4" />
                )}
                {testScriptLoaded ? "Reload Analyzer" : "Run Analyzer"}
              </Button>

              <Button variant="outline" onClick={openPropertyInNewTab}>
                <ExternalLinkIcon className="mr-1 h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
          </div>

          {!testScriptLoaded && !loading && (
            <Card className="p-4">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BugIcon className="h-10 w-10 text-primary/50 mb-3" />
                <h3 className="text-lg font-medium mb-1">Analyzer Not Started</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  This specialized tool analyzes consecutive blocked dates patterns and tests checkout behavior.
                  It helps identify issues with handling consecutive blocked dates where checkout should be allowed.
                </p>
              </div>
            </Card>
          )}

          {loading && (
            <Card className="p-4">
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCwIcon className="h-10 w-10 text-primary/50 animate-spin mb-3" />
                <h3 className="text-lg font-medium">Analyzing Blocked Date Patterns...</h3>
              </div>
            </Card>
          )}

          {testScriptLoaded && (
            <Card className="p-4">
              <div className="flex flex-col">
                <h3 className="text-lg font-medium mb-2">Analyzer Loaded</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The consecutive dates analyzer has been loaded at the bottom of the screen.
                  It identifies consecutive blocked date patterns and creates appropriate tests.
                </p>
                <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="text-green-700 mr-2 text-sm">
                    <strong>Helpful Feature:</strong> This specialized tool helps debug checkout on blocked date issues,
                    particularly for consecutive blocked dates where this would otherwise be difficult to test.
                  </div>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
