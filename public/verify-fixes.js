// Verification script for booking redesign fixes
(function() {
  console.log('🔍 Starting Fix Verification Suite');
  
  const results = {
    touchTargets: false,
    altText: false,
    colorContrast: false
  };
  
  // Test 1: Touch Target Sizes
  console.log('\n📏 Testing Touch Target Sizes...');
  const guestButtons = document.querySelectorAll('button[aria-label*="guest"]');
  if (guestButtons.length > 0) {
    const firstButton = guestButtons[0];
    const rect = firstButton.getBoundingClientRect();
    const minSize = Math.min(rect.width, rect.height);
    
    if (minSize >= 44) {
      console.log('✅ Touch targets are now 44px or larger:', minSize + 'px');
      results.touchTargets = true;
    } else {
      console.log('❌ Touch targets still too small:', minSize + 'px');
    }
  } else {
    console.log('⚠️ No guest buttons found to test');
  }
  
  // Test 2: Alt Text on Images
  console.log('\n🖼️ Testing Image Alt Text...');
  const images = document.querySelectorAll('img');
  let missingAltCount = 0;
  
  images.forEach((img, index) => {
    if (!img.alt || img.alt.trim() === '') {
      missingAltCount++;
      console.log(`❌ Image ${index + 1} missing alt text:`, img.src);
    }
  });
  
  if (missingAltCount === 0) {
    console.log('✅ All images have alt text');
    results.altText = true;
  } else {
    console.log(`❌ ${missingAltCount} images still missing alt text`);
  }
  
  // Test 3: Color Contrast on Disabled Buttons
  console.log('\n🎨 Testing Color Contrast...');
  
  // Create a temporary disabled button to test
  const testButton = document.createElement('button');
  testButton.disabled = true;
  testButton.className = 'button'; // Use whatever button class
  testButton.textContent = 'Test';
  document.body.appendChild(testButton);
  
  const styles = window.getComputedStyle(testButton);
  const textColor = styles.color;
  const bgColor = styles.backgroundColor;
  
  // Simple contrast calculation (not perfect but good for verification)
  console.log('Disabled button text color:', textColor);
  console.log('Disabled button background:', bgColor);
  
  // Check if using specific gray colors we set
  if (styles.color.includes('rgb(75, 85, 99)') || // gray-600
      styles.color.includes('#4b5563')) {
    console.log('✅ Using improved contrast colors');
    results.colorContrast = true;
  } else {
    console.log('⚠️ May need to verify contrast manually');
  }
  
  // Remove test button
  document.body.removeChild(testButton);
  
  // Summary
  console.log('\n📊 Fix Verification Summary:');
  console.log('Touch Targets:', results.touchTargets ? '✅ Fixed' : '❌ Still needs work');
  console.log('Alt Text:', results.altText ? '✅ Fixed' : '❌ Still needs work');
  console.log('Color Contrast:', results.colorContrast ? '✅ Fixed' : '⚠️ Check manually');
  
  const passCount = Object.values(results).filter(r => r).length;
  console.log(`\nOverall: ${passCount}/3 fixes verified`);
  
  return results;
})();