// Language testing script for booking check page
// Run this in the browser console to test multilingual support

(function() {
  console.log('🌐 Starting Language Testing Suite');
  console.log('=================================\n');
  
  const testResults = {
    currentLanguage: null,
    translations: {},
    textOverflow: [],
    missingTranslations: []
  };
  
  // Get current language
  const htmlLang = document.documentElement.getAttribute('lang') || 'en';
  const urlLang = window.location.pathname.includes('/ro/') ? 'ro' : 'en';
  testResults.currentLanguage = urlLang;
  
  console.log(`Current language: ${testResults.currentLanguage}`);
  console.log(`HTML lang attribute: ${htmlLang}`);
  
  // Function to check text overflow
  function checkTextOverflow() {
    const elements = document.querySelectorAll('button, label, h1, h2, h3, p, span');
    const overflowElements = [];
    
    elements.forEach(el => {
      if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
        overflowElements.push({
          element: el.tagName,
          text: el.textContent.substring(0, 50) + '...',
          width: `${el.scrollWidth}px > ${el.clientWidth}px`
        });
      }
    });
    
    return overflowElements;
  }
  
  // Function to find multilingual objects
  function findMultilingualObjects() {
    const scripts = document.querySelectorAll('script');
    const multilingualObjects = [];
    
    scripts.forEach(script => {
      if (script.textContent && script.textContent.includes('"en":') && script.textContent.includes('"ro":')) {
        // Found potential multilingual object
        multilingualObjects.push('Found multilingual data in script');
      }
    });
    
    return multilingualObjects;
  }
  
  // Check for common UI text
  const commonTexts = {
    'Book Now': ['Book Now', 'Rezervă Acum'],
    'Contact Host': ['Contact Host', 'Contactează Gazda'],
    'Hold Dates': ['Hold for 24 Hours', 'Rezervă pentru 24 de Ore'],
    'Check Availability': ['Check Dates', 'Verifică Disponibilitatea'],
    'Select Dates': ['Select dates', 'Selectează Datele'],
    'First Name': ['First Name', 'Prenume'],
    'Last Name': ['Last Name', 'Nume'],
    'Email': ['Email', 'Email'],
    'Phone': ['Phone', 'Telefon'],
    'Message': ['Message', 'Mesaj'],
    'Continue': ['Continue to Payment', 'Continuă la Plată']
  };
  
  // Check which texts are present
  console.log('\n📝 Checking UI Text:');
  const bodyText = document.body.textContent;
  
  for (const [key, [en, ro]] of Object.entries(commonTexts)) {
    const enFound = bodyText.includes(en);
    const roFound = bodyText.includes(ro);
    
    if (testResults.currentLanguage === 'en' && enFound) {
      console.log(`  ✓ "${key}" in English`);
      testResults.translations[key] = 'correct';
    } else if (testResults.currentLanguage === 'ro' && roFound) {
      console.log(`  ✓ "${key}" in Romanian`);
      testResults.translations[key] = 'correct';
    } else if (testResults.currentLanguage === 'en' && roFound && !enFound) {
      console.log(`  ⚠️ "${key}" showing Romanian in English mode`);
      testResults.translations[key] = 'wrong_language';
    } else if (testResults.currentLanguage === 'ro' && enFound && !roFound) {
      console.log(`  ⚠️ "${key}" showing English in Romanian mode`);
      testResults.translations[key] = 'wrong_language';
    } else {
      console.log(`  ❌ "${key}" not found`);
      testResults.translations[key] = 'missing';
      testResults.missingTranslations.push(key);
    }
  }
  
  // Check for text overflow
  console.log('\n📏 Checking Text Overflow:');
  const overflowElements = checkTextOverflow();
  testResults.textOverflow = overflowElements;
  
  if (overflowElements.length === 0) {
    console.log('  ✓ No text overflow detected');
  } else {
    console.log(`  ⚠️ Found ${overflowElements.length} elements with text overflow:`);
    overflowElements.forEach(el => {
      console.log(`    - ${el.element}: "${el.text}" (${el.width})`);
    });
  }
  
  // Check multilingual objects
  console.log('\n🔍 Checking Multilingual Implementation:');
  const mlObjects = findMultilingualObjects();
  
  if (mlObjects.length > 0) {
    console.log('  ✓ Found multilingual data structures');
  } else {
    console.log('  ⚠️ No multilingual data structures found');
  }
  
  // Function to switch language
  window.switchLanguage = function(lang) {
    const currentPath = window.location.pathname;
    let newPath;
    
    if (lang === 'ro') {
      if (currentPath.includes('/ro/')) {
        newPath = currentPath;
      } else {
        newPath = '/ro' + currentPath;
      }
    } else {
      newPath = currentPath.replace('/ro/', '/');
    }
    
    console.log(`Switching to ${lang}: ${newPath}`);
    window.location.pathname = newPath;
  };
  
  // Create visual language switcher
  window.createLanguageSwitcher = function() {
    const switcher = document.createElement('div');
    switcher.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: white;
      border: 2px solid #ddd;
      border-radius: 8px;
      padding: 10px;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    switcher.innerHTML = '<h3 style="margin: 0 0 10px 0; font-size: 14px;">Language</h3>';
    
    ['en', 'ro'].forEach(lang => {
      const btn = document.createElement('button');
      btn.textContent = lang.toUpperCase();
      btn.style.cssText = `
        display: inline-block;
        padding: 5px 15px;
        margin: 0 5px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: ${testResults.currentLanguage === lang ? '#007bff' : '#fff'};
        color: ${testResults.currentLanguage === lang ? '#fff' : '#000'};
        cursor: pointer;
      `;
      
      btn.onclick = () => switchLanguage(lang);
      switcher.appendChild(btn);
    });
    
    document.body.appendChild(switcher);
    console.log('Language switcher added to page');
  };
  
  // Summary
  console.log('\n\n📊 LANGUAGE TEST SUMMARY');
  console.log('========================');
  
  const correctTranslations = Object.values(testResults.translations).filter(v => v === 'correct').length;
  const wrongTranslations = Object.values(testResults.translations).filter(v => v === 'wrong_language').length;
  const missingTranslations = Object.values(testResults.translations).filter(v => v === 'missing').length;
  
  console.log(`Current Language: ${testResults.currentLanguage.toUpperCase()}`);
  console.log(`Correct Translations: ${correctTranslations}/${Object.keys(commonTexts).length} ✅`);
  console.log(`Wrong Language: ${wrongTranslations} ⚠️`);
  console.log(`Missing Translations: ${missingTranslations} ❌`);
  console.log(`Text Overflow Issues: ${testResults.textOverflow.length} ${testResults.textOverflow.length > 0 ? '⚠️' : '✓'}`);
  
  const score = (correctTranslations / Object.keys(commonTexts).length) * 100;
  console.log(`\nTranslation Score: ${Math.round(score)}%`);
  
  console.log('\n📝 Usage:');
  console.log('- Run switchLanguage("ro") or switchLanguage("en") to switch languages');
  console.log('- Run createLanguageSwitcher() to add visual language switcher');
  console.log('- Check for text overflow in both languages');
  
  return testResults;
})();