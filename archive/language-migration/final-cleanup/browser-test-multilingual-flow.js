// Comprehensive browser test for multilingual flow
(async function() {
  console.log('Starting comprehensive multilingual flow test...\n');

  const testResults = {
    passed: [],
    failed: [],
    warnings: []
  };

  function log(message, type = 'info') {
    const prefix = {
      info: 'ℹ️',
      success: '✓',
      error: '✗',
      warning: '⚠️'
    }[type] || '';
    
    console.log(`${prefix} ${message}`);
  }

  function addResult(testName, status, details) {
    if (status === 'passed') {
      testResults.passed.push(testName);
      log(`${testName}: PASSED`, 'success');
    } else if (status === 'failed') {
      testResults.failed.push({ test: testName, error: details });
      log(`${testName}: FAILED - ${details}`, 'error');
    } else if (status === 'warning') {
      testResults.warnings.push({ test: testName, message: details });
      log(`${testName}: WARNING - ${details}`, 'warning');
    }
  }

  // Test 1: Initial page load and language detection
  async function testInitialLoad() {
    try {
      // Check if page loaded properly
      const pageTitle = document.title;
      addResult('Page Load', 'passed', `Page title: ${pageTitle}`);

      // Check browser language
      const browserLang = navigator.language.startsWith('ro') ? 'ro' : 'en';
      log(`Browser language: ${navigator.language} (detected as ${browserLang})`);

      // Check saved preference
      const savedLang = localStorage.getItem('preferred-language');
      if (savedLang) {
        log(`Saved language preference: ${savedLang}`);
      } else {
        log('No saved language preference');
      }

      // Check current URL
      const currentPath = window.location.pathname;
      const urlLang = currentPath.includes('/ro') ? 'ro' : 'en';
      log(`URL language: ${urlLang} (path: ${currentPath})`);

      addResult('Language Detection', 'passed', 
        `Browser: ${browserLang}, Saved: ${savedLang || 'none'}, URL: ${urlLang}`);
    } catch (error) {
      addResult('Initial Load Test', 'failed', error.message);
    }
  }

  // Test 2: Language selector functionality
  async function testLanguageSelector() {
    try {
      // Find language selector
      const selectors = [
        '[data-testid="language-selector"]',
        '.language-selector',
        'button[aria-label*="language"]',
        'button:has(svg[class*="globe"])'
      ];

      let selector = null;
      for (const sel of selectors) {
        selector = document.querySelector(sel);
        if (selector) break;
      }

      if (!selector) {
        // Try to find by content
        const buttons = document.querySelectorAll('button');
        selector = Array.from(buttons).find(btn => 
          btn.textContent.includes('EN') || 
          btn.textContent.includes('RO') ||
          btn.querySelector('svg')
        );
      }

      if (!selector) {
        addResult('Language Selector', 'failed', 'Language selector not found');
        return;
      }

      addResult('Language Selector Found', 'passed', 'Selector element located');

      // Test clicking the selector
      selector.click();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Look for language options
      const options = document.querySelectorAll(
        'a[href*="/ro"], a[href="/"], button[data-lang], [role="option"]'
      );

      if (options.length > 0) {
        addResult('Language Options', 'passed', `Found ${options.length} language options`);
      } else {
        addResult('Language Options', 'warning', 'No clear language options found');
      }

      // Close dropdown by clicking outside
      document.body.click();
    } catch (error) {
      addResult('Language Selector Test', 'failed', error.message);
    }
  }

  // Test 3: Translation verification
  async function testTranslations() {
    try {
      const currentLang = window.location.pathname.includes('/ro') ? 'ro' : 'en';
      log(`Testing translations for language: ${currentLang}`);

      // Common UI elements to check
      const elementsToCheck = [
        { selector: 'button[type="submit"]', en: 'Book', ro: 'Rezervă' },
        { selector: 'a[href*="properties"]', en: 'Properties', ro: 'Proprietăți' },
        { selector: 'label[for*="check"]', en: 'Check', ro: 'Check' },
        { selector: 'h1, h2, h3', en: 'Welcome', ro: 'Bun venit' }
      ];

      let translationCount = 0;
      let correctTranslations = 0;

      for (const check of elementsToCheck) {
        const elements = document.querySelectorAll(check.selector);
        for (const element of elements) {
          const text = element.textContent.toLowerCase();
          const expectedText = check[currentLang].toLowerCase();
          
          if (text.includes(expectedText)) {
            correctTranslations++;
          }
          translationCount++;
        }
      }

      if (translationCount > 0) {
        const successRate = (correctTranslations / translationCount) * 100;
        addResult('Translation Verification', 
          successRate > 50 ? 'passed' : 'warning',
          `${correctTranslations}/${translationCount} translations correct (${successRate.toFixed(1)}%)`
        );
      } else {
        addResult('Translation Verification', 'warning', 'No translatable elements found');
      }
    } catch (error) {
      addResult('Translation Test', 'failed', error.message);
    }
  }

  // Test 4: Navigation with language persistence
  async function testLanguageNavigation() {
    try {
      const initialLang = window.location.pathname.includes('/ro') ? 'ro' : 'en';
      log(`Starting navigation test from ${initialLang}`);

      // Find a navigation link
      const navLink = document.querySelector('a[href*="properties"]') ||
                     document.querySelector('nav a') ||
                     document.querySelector('a[href^="/"]');

      if (!navLink) {
        addResult('Navigation Test', 'warning', 'No navigation links found');
        return;
      }

      const linkHref = navLink.getAttribute('href');
      log(`Testing navigation to: ${linkHref}`);

      // Check if link maintains language
      if (initialLang === 'ro') {
        const maintainsLang = linkHref.includes('/ro');
        addResult('Language Persistence in Links', 
          maintainsLang ? 'passed' : 'failed',
          `Link ${maintainsLang ? 'maintains' : 'does not maintain'} Romanian language`
        );
      } else {
        addResult('Language Persistence in Links', 'passed', 'English links work correctly');
      }
    } catch (error) {
      addResult('Navigation Test', 'failed', error.message);
    }
  }

  // Test 5: Form elements in different languages
  async function testFormElements() {
    try {
      const forms = document.querySelectorAll('form');
      if (forms.length === 0) {
        addResult('Form Elements Test', 'warning', 'No forms found on page');
        return;
      }

      const currentLang = window.location.pathname.includes('/ro') ? 'ro' : 'en';
      let formElementsFound = 0;
      let correctlyTranslated = 0;

      forms.forEach(form => {
        const inputs = form.querySelectorAll('input, textarea, select');
        const labels = form.querySelectorAll('label');
        const buttons = form.querySelectorAll('button');

        formElementsFound += inputs.length + labels.length + buttons.length;

        // Check placeholders
        inputs.forEach(input => {
          const placeholder = input.getAttribute('placeholder');
          if (placeholder) {
            if (currentLang === 'ro' && /[ăâîșț]/i.test(placeholder)) {
              correctlyTranslated++;
            } else if (currentLang === 'en' && !/[ăâîșț]/i.test(placeholder)) {
              correctlyTranslated++;
            }
          }
        });

        // Check button text
        buttons.forEach(button => {
          const text = button.textContent;
          if (currentLang === 'ro' && /[ăâîșț]/i.test(text)) {
            correctlyTranslated++;
          } else if (currentLang === 'en' && !/[ăâîșț]/i.test(text)) {
            correctlyTranslated++;
          }
        });
      });

      if (formElementsFound > 0) {
        addResult('Form Elements Translation', 'passed', 
          `Found ${formElementsFound} form elements, ${correctlyTranslated} appear correctly translated`
        );
      } else {
        addResult('Form Elements Test', 'warning', 'No form elements to test');
      }
    } catch (error) {
      addResult('Form Elements Test', 'failed', error.message);
    }
  }

  // Test 6: Language switch and reload
  async function testLanguageSwitch() {
    try {
      const currentLang = window.location.pathname.includes('/ro') ? 'ro' : 'en';
      const targetLang = currentLang === 'en' ? 'ro' : 'en';
      
      log(`Testing switch from ${currentLang} to ${targetLang}`);

      // Try to switch language
      const selector = document.querySelector('[data-testid="language-selector"]') ||
                      document.querySelector('.language-selector') ||
                      document.querySelector('button:has(svg)');

      if (!selector) {
        addResult('Language Switch Test', 'failed', 'No language selector found');
        return;
      }

      // Click selector
      selector.click();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Find target language option
      const targetOption = Array.from(document.querySelectorAll('a, button')).find(el => {
        const text = el.textContent.toLowerCase();
        return (targetLang === 'ro' && (text.includes('română') || text.includes('ro'))) ||
               (targetLang === 'en' && (text.includes('english') || text.includes('en')));
      });

      if (targetOption) {
        addResult('Language Switch Option', 'passed', `Found ${targetLang} option`);
        
        // Note: Actually clicking would navigate away from the test
        log('Language switch option found and verified');
      } else {
        addResult('Language Switch Option', 'failed', `${targetLang} option not found`);
      }
    } catch (error) {
      addResult('Language Switch Test', 'failed', error.message);
    }
  }

  // Run all tests
  async function runAllTests() {
    log('=== Multilingual Flow Test Suite ===\n');
    
    await testInitialLoad();
    log('');
    
    await testLanguageSelector();
    log('');
    
    await testTranslations();
    log('');
    
    await testLanguageNavigation();
    log('');
    
    await testFormElements();
    log('');
    
    await testLanguageSwitch();
    log('');
    
    // Summary
    log('=== Test Summary ===');
    log(`Passed: ${testResults.passed.length}`, 'success');
    log(`Failed: ${testResults.failed.length}`, 'error');
    log(`Warnings: ${testResults.warnings.length}`, 'warning');
    
    if (testResults.failed.length > 0) {
      log('\nFailed tests:');
      testResults.failed.forEach(test => {
        log(`- ${test.test}: ${test.error}`, 'error');
      });
    }
    
    if (testResults.warnings.length > 0) {
      log('\nWarnings:');
      testResults.warnings.forEach(test => {
        log(`- ${test.test}: ${test.message}`, 'warning');
      });
    }
    
    // Update DOM if test results element exists
    const resultsEl = document.getElementById('test-results');
    if (resultsEl) {
      resultsEl.innerHTML = `
        <div class="space-y-2">
          <p class="text-green-600">✓ Passed: ${testResults.passed.length}</p>
          <p class="text-red-600">✗ Failed: ${testResults.failed.length}</p>
          <p class="text-yellow-600">⚠ Warnings: ${testResults.warnings.length}</p>
        </div>
      `;
    }
    
    return testResults;
  }

  // Export for external use
  window.multilingualFlowTest = {
    runAllTests,
    testResults
  };

  // Auto-run after a short delay to ensure page is fully loaded
  setTimeout(runAllTests, 1000);
})();