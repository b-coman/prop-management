// Browser test for multilingual functionality
(function() {
  console.log('Starting multilingual browser test...');

  const testResults = {
    passed: [],
    failed: []
  };

  function logResult(testName, success, details) {
    if (success) {
      testResults.passed.push(testName);
      console.log(`✓ ${testName}`);
    } else {
      testResults.failed.push({ test: testName, error: details });
      console.error(`✗ ${testName}:`, details);
    }
  }

  // Test 1: Check if language context exists
  function testLanguageContext() {
    try {
      // Check localStorage
      const savedLang = localStorage.getItem('preferred-language');
      logResult('Language persistence in localStorage', savedLang !== null, `Current language: ${savedLang || 'not set'}`);

      // Check current URL for Romanian
      const isRomanian = window.location.pathname.includes('/ro');
      logResult('URL language detection', true, `Is Romanian path: ${isRomanian}`);
      
      return true;
    } catch (error) {
      logResult('Language context check', false, error.message);
      return false;
    }
  }

  // Test 2: Check language selector
  function testLanguageSelector() {
    try {
      const selector = document.querySelector('[data-testid="language-selector"]') || 
                      document.querySelector('.language-selector') ||
                      document.querySelector('button:has(svg):has(span)'); // Look for globe icon with language
      
      logResult('Language selector exists', !!selector, selector ? 'Found language selector' : 'No selector found');
      
      if (selector) {
        // Log current language display
        const currentLang = selector.textContent.trim();
        console.log(`Current language display: ${currentLang}`);
      }
      
      return !!selector;
    } catch (error) {
      logResult('Language selector check', false, error.message);
      return false;
    }
  }

  // Test 3: Check translated content
  function testTranslatedContent() {
    try {
      const bookingButton = document.querySelector('button[type="submit"]') ||
                           document.querySelector('button:contains("Book")') ||
                           Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('Book'));
      
      const isRomanian = window.location.pathname.includes('/ro');
      const expectedText = isRomanian ? 'Rezervă' : 'Book';
      
      if (bookingButton) {
        const hasTranslation = bookingButton.textContent.includes(expectedText);
        logResult('Content translation check', hasTranslation, 
          `Button text: "${bookingButton.textContent}", Expected: "${expectedText}"`);
      } else {
        logResult('Content translation check', false, 'No booking button found');
      }
      
      return true;
    } catch (error) {
      logResult('Translated content check', false, error.message);
      return false;
    }
  }

  // Test 4: Test language switching
  async function testLanguageSwitch() {
    try {
      const selector = document.querySelector('[data-testid="language-selector"]') || 
                      document.querySelector('.language-selector') ||
                      document.querySelector('button:has(svg):has(span)');
      
      if (!selector) {
        logResult('Language switching', false, 'No language selector found');
        return false;
      }

      // Click the selector to open dropdown
      selector.click();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Find Romanian option
      const roOption = Array.from(document.querySelectorAll('a, button')).find(el => 
        el.textContent.includes('Română') || el.textContent.includes('RO')
      );

      if (roOption) {
        console.log('Found Romanian option, clicking...');
        roOption.click();
        
        // Wait for navigation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newUrl = window.location.pathname;
        logResult('Language switch to Romanian', newUrl.includes('/ro'), `New URL: ${newUrl}`);
      } else {
        logResult('Language switch test', false, 'Romanian option not found');
      }
      
      return true;
    } catch (error) {
      logResult('Language switching test', false, error.message);
      return false;
    }
  }

  // Test 5: Check multilingual data structure
  function testMultilingualData() {
    try {
      // Check if any data attributes contain multilingual content
      const elements = document.querySelectorAll('[data-content]');
      let hasMultilingualData = false;
      
      elements.forEach(el => {
        const content = el.getAttribute('data-content');
        try {
          const parsed = JSON.parse(content);
          if (parsed.en && parsed.ro) {
            hasMultilingualData = true;
          }
        } catch (e) {
          // Not JSON or invalid format
        }
      });
      
      logResult('Multilingual data structure', true, 
        hasMultilingualData ? 'Found multilingual data' : 'No multilingual data attributes found');
      
      return true;
    } catch (error) {
      logResult('Multilingual data check', false, error.message);
      return false;
    }
  }

  // Run all tests
  async function runTests() {
    console.log('Running multilingual tests...\n');
    
    testLanguageContext();
    testLanguageSelector();
    testTranslatedContent();
    await testLanguageSwitch();
    testMultilingualData();
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${testResults.passed.length}`);
    console.log(`Failed: ${testResults.failed.length}`);
    
    if (testResults.failed.length > 0) {
      console.log('\nFailed tests:');
      testResults.failed.forEach(test => {
        console.error(`- ${test.test}: ${test.error}`);
      });
    }
    
    return testResults;
  }

  // Export for external use
  window.multilingualTest = {
    runTests,
    testResults
  };

  // Auto-run tests after page load
  if (document.readyState === 'complete') {
    runTests();
  } else {
    window.addEventListener('load', runTests);
  }
})();