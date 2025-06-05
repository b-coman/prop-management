// Performance and Accessibility testing script
// Run this in the browser console on the booking check page

(function() {
  console.log('⚡ Starting Performance & Accessibility Tests');
  console.log('==========================================\n');
  
  const testResults = {
    performance: {},
    accessibility: {},
    metrics: {}
  };
  
  // Performance Tests
  console.log('📊 Performance Metrics:');
  
  // Check page weight
  if (performance.getEntriesByType) {
    const resources = performance.getEntriesByType('resource');
    const totalSize = resources.reduce((total, resource) => {
      return total + (resource.transferSize || 0);
    }, 0);
    
    const jsSize = resources
      .filter(r => r.name.includes('.js'))
      .reduce((total, r) => total + (r.transferSize || 0), 0);
    
    const cssSize = resources
      .filter(r => r.name.includes('.css'))
      .reduce((total, r) => total + (r.transferSize || 0), 0);
    
    testResults.performance.totalSize = totalSize;
    testResults.performance.jsSize = jsSize;
    testResults.performance.cssSize = cssSize;
    
    console.log(`  Total page size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  JavaScript: ${(jsSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  CSS: ${(cssSize / 1024 / 1024).toFixed(2)} MB`);
  }
  
  // Check render time
  if (performance.timing) {
    const timing = performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
    const firstPaint = performance.getEntriesByType('paint')[0]?.startTime || 0;
    
    testResults.performance.loadTime = loadTime;
    testResults.performance.domReady = domReady;
    testResults.performance.firstPaint = firstPaint;
    
    console.log(`  Page load time: ${loadTime}ms ${loadTime < 3000 ? '✅' : '⚠️'}`);
    console.log(`  DOM ready: ${domReady}ms ${domReady < 1500 ? '✅' : '⚠️'}`);
    console.log(`  First paint: ${Math.round(firstPaint)}ms ${firstPaint < 1000 ? '✅' : '⚠️'}`);
  }
  
  // Check animations performance
  console.log('\n🎭 Animation Performance:');
  const animatedElements = document.querySelectorAll('[class*="transition"], [class*="animate"]');
  console.log(`  Animated elements: ${animatedElements.length}`);
  
  // Check will-change usage
  let willChangeCount = 0;
  animatedElements.forEach(el => {
    const styles = getComputedStyle(el);
    if (styles.willChange && styles.willChange !== 'auto') {
      willChangeCount++;
    }
  });
  console.log(`  Elements with will-change: ${willChangeCount}`);
  console.log(`  GPU acceleration: ${willChangeCount > 0 ? '✅ Enabled' : '⚠️ Not detected'}`);
  
  // Accessibility Tests
  console.log('\n♿ Accessibility Checks:');
  
  // Check ARIA labels
  const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
  let missingLabels = 0;
  
  interactiveElements.forEach(el => {
    const hasLabel = el.getAttribute('aria-label') || 
                    el.getAttribute('aria-labelledby') ||
                    el.textContent?.trim() ||
                    (el.tagName === 'INPUT' && document.querySelector(`label[for="${el.id}"]`));
    
    if (!hasLabel) {
      missingLabels++;
      console.log(`  ⚠️ Missing label: ${el.tagName}#${el.id || 'no-id'}`);
    }
  });
  
  testResults.accessibility.missingLabels = missingLabels;
  console.log(`  Interactive elements with labels: ${interactiveElements.length - missingLabels}/${interactiveElements.length} ${missingLabels === 0 ? '✅' : '⚠️'}`);
  
  // Check focus indicators
  console.log('\n🎯 Focus Management:');
  const focusableElements = document.querySelectorAll('button, a, input, select, textarea, [tabindex]');
  let elementsWithFocusStyles = 0;
  
  focusableElements.forEach(el => {
    el.focus();
    const focusStyles = getComputedStyle(el);
    const hasFocusIndicator = focusStyles.outline !== 'none' || 
                             focusStyles.boxShadow !== 'none' ||
                             focusStyles.borderColor !== getComputedStyle(el, null).borderColor;
    
    if (hasFocusIndicator) {
      elementsWithFocusStyles++;
    }
  });
  
  // Restore focus to body
  document.body.focus();
  
  testResults.accessibility.focusIndicators = elementsWithFocusStyles;
  console.log(`  Elements with focus indicators: ${elementsWithFocusStyles}/${focusableElements.length} ${elementsWithFocusStyles === focusableElements.length ? '✅' : '⚠️'}`);
  
  // Check color contrast
  console.log('\n🎨 Color Contrast:');
  const textElements = document.querySelectorAll('p, span, label, button');
  let lowContrastCount = 0;
  
  // Simple contrast check (not comprehensive)
  textElements.forEach(el => {
    const styles = getComputedStyle(el);
    const bgColor = styles.backgroundColor;
    const textColor = styles.color;
    
    // Convert to RGB values (simplified)
    if (bgColor.includes('rgb') && textColor.includes('rgb')) {
      const bgMatch = bgColor.match(/\d+/g);
      const textMatch = textColor.match(/\d+/g);
      
      if (bgMatch && textMatch) {
        const bgLuminance = (parseInt(bgMatch[0]) + parseInt(bgMatch[1]) + parseInt(bgMatch[2])) / 3;
        const textLuminance = (parseInt(textMatch[0]) + parseInt(textMatch[1]) + parseInt(textMatch[2])) / 3;
        const contrast = Math.abs(bgLuminance - textLuminance);
        
        if (contrast < 100) {
          lowContrastCount++;
        }
      }
    }
  });
  
  testResults.accessibility.lowContrast = lowContrastCount;
  console.log(`  Low contrast elements: ${lowContrastCount} ${lowContrastCount === 0 ? '✅' : '⚠️ Check manually'}`);
  
  // Check skip links
  const skipLinks = document.querySelectorAll('.skip-link, [href^="#main"], [href^="#content"]');
  console.log(`  Skip links: ${skipLinks.length} ${skipLinks.length > 0 ? '✅' : '⚠️'}`);
  
  // Check heading hierarchy
  console.log('\n📝 Heading Structure:');
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const headingLevels = Array.from(headings).map(h => parseInt(h.tagName.substring(1)));
  let validHierarchy = true;
  
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i-1] > 1) {
      validHierarchy = false;
      console.log(`  ⚠️ Skipped heading level: H${headingLevels[i-1]} → H${headingLevels[i]}`);
    }
  }
  
  console.log(`  Heading hierarchy: ${validHierarchy ? '✅ Valid' : '⚠️ Has gaps'}`);
  
  // Check form validation
  console.log('\n📋 Form Validation:');
  const forms = document.querySelectorAll('form');
  let formsWithValidation = 0;
  
  forms.forEach(form => {
    const hasRequired = form.querySelector('[required]');
    const hasPattern = form.querySelector('[pattern]');
    const hasType = form.querySelector('[type="email"], [type="tel"], [type="number"]');
    
    if (hasRequired || hasPattern || hasType) {
      formsWithValidation++;
    }
  });
  
  console.log(`  Forms with validation: ${formsWithValidation}/${forms.length} ${formsWithValidation === forms.length ? '✅' : '⚠️'}`);
  
  // Touch targets check
  console.log('\n👆 Touch Targets:');
  const buttons = document.querySelectorAll('button, a');
  let smallTargets = 0;
  
  buttons.forEach(btn => {
    const rect = btn.getBoundingClientRect();
    if (rect.width < 44 || rect.height < 44) {
      smallTargets++;
    }
  });
  
  testResults.accessibility.smallTargets = smallTargets;
  console.log(`  Small touch targets: ${smallTargets} ${smallTargets === 0 ? '✅' : '⚠️'}`);
  
  // Summary
  console.log('\n\n📊 TEST SUMMARY');
  console.log('===============');
  
  console.log('\nPerformance:');
  console.log(`  Page load: ${testResults.performance.loadTime}ms ${testResults.performance.loadTime < 3000 ? '✅' : '⚠️'}`);
  console.log(`  Total size: ${(testResults.performance.totalSize / 1024 / 1024).toFixed(2)}MB ${testResults.performance.totalSize < 3000000 ? '✅' : '⚠️'}`);
  
  console.log('\nAccessibility:');
  console.log(`  Missing labels: ${testResults.accessibility.missingLabels} ${testResults.accessibility.missingLabels === 0 ? '✅' : '⚠️'}`);
  console.log(`  Focus indicators: ${testResults.accessibility.focusIndicators}/${focusableElements.length} ${testResults.accessibility.focusIndicators === focusableElements.length ? '✅' : '⚠️'}`);
  console.log(`  Small touch targets: ${testResults.accessibility.smallTargets} ${testResults.accessibility.smallTargets === 0 ? '✅' : '⚠️'}`);
  
  console.log('\n📝 Recommendations:');
  if (testResults.performance.loadTime > 3000) {
    console.log('- Optimize page load time (currently > 3s)');
  }
  if (testResults.accessibility.missingLabels > 0) {
    console.log('- Add ARIA labels to interactive elements');
  }
  if (testResults.accessibility.smallTargets > 0) {
    console.log('- Increase size of touch targets to minimum 44x44px');
  }
  
  return testResults;
})();