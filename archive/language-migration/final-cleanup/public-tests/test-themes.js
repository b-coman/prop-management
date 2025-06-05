// Theme testing script for booking check page
// Run this in the browser console to test all themes

(function() {
  console.log('🎨 Starting Theme Testing Suite');
  console.log('==============================\n');
  
  const themes = ['coastal', 'mountain', 'modern', 'rustic', 'luxury'];
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'coastal';
  
  console.log(`Current theme: ${currentTheme}`);
  
  const testResults = {
    themes: {}
  };
  
  // Function to check theme variables
  function checkThemeVariables(theme) {
    const computedStyle = getComputedStyle(document.documentElement);
    const variables = {
      '--primary': computedStyle.getPropertyValue('--primary'),
      '--background': computedStyle.getPropertyValue('--background'),
      '--foreground': computedStyle.getPropertyValue('--foreground'),
      '--card': computedStyle.getPropertyValue('--card'),
      '--border': computedStyle.getPropertyValue('--border'),
      '--muted': computedStyle.getPropertyValue('--muted'),
      '--accent': computedStyle.getPropertyValue('--accent'),
      '--destructive': computedStyle.getPropertyValue('--destructive')
    };
    
    const hasAllVariables = Object.values(variables).every(v => v && v.trim() !== '');
    
    return {
      hasAllVariables,
      variables,
      elementsStyled: checkElementStyling()
    };
  }
  
  // Function to check if elements are properly styled
  function checkElementStyling() {
    const elements = {
      buttons: document.querySelectorAll('button'),
      cards: document.querySelectorAll('[class*="card"]'),
      inputs: document.querySelectorAll('input'),
      labels: document.querySelectorAll('label'),
      borders: document.querySelectorAll('[class*="border"]')
    };
    
    const styled = {
      buttons: 0,
      cards: 0,
      inputs: 0,
      labels: 0,
      borders: 0
    };
    
    // Check buttons
    elements.buttons.forEach(btn => {
      const styles = getComputedStyle(btn);
      if (styles.backgroundColor || styles.color) {
        styled.buttons++;
      }
    });
    
    // Check cards
    elements.cards.forEach(card => {
      const styles = getComputedStyle(card);
      if (styles.backgroundColor || styles.borderColor) {
        styled.cards++;
      }
    });
    
    // Check inputs
    elements.inputs.forEach(input => {
      const styles = getComputedStyle(input);
      if (styles.borderColor || styles.backgroundColor) {
        styled.inputs++;
      }
    });
    
    return {
      buttonsStyled: styled.buttons === elements.buttons.length,
      cardsStyled: styled.cards === elements.cards.length,
      inputsStyled: styled.inputs === elements.inputs.length,
      totalElements: Object.values(elements).reduce((sum, el) => sum + el.length, 0),
      styledElements: Object.values(styled).reduce((sum, count) => sum + count, 0)
    };
  }
  
  // Test current theme
  console.log(`\n📋 Testing current theme: ${currentTheme}`);
  const currentThemeResult = checkThemeVariables(currentTheme);
  testResults.themes[currentTheme] = currentThemeResult;
  
  console.log(`  Variables loaded: ${currentThemeResult.hasAllVariables ? '✅' : '❌'}`);
  console.log(`  Elements styled: ${currentThemeResult.elementsStyled.styledElements}/${currentThemeResult.elementsStyled.totalElements}`);
  
  // Function to switch themes
  async function testTheme(theme) {
    console.log(`\n🔄 Switching to theme: ${theme}`);
    
    // Switch theme
    document.documentElement.setAttribute('data-theme', theme);
    
    // Wait for styles to apply
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test the theme
    const result = checkThemeVariables(theme);
    testResults.themes[theme] = result;
    
    console.log(`  Variables loaded: ${result.hasAllVariables ? '✅' : '❌'}`);
    console.log(`  Elements styled: ${result.elementsStyled.styledElements}/${result.elementsStyled.totalElements}`);
    
    // Check specific components
    const bookingCard = document.querySelector('.booking-form-card');
    const dateButton = document.querySelector('#date');
    const ctaButton = document.querySelector('[variant="cta"]');
    
    if (bookingCard) {
      const cardStyles = getComputedStyle(bookingCard);
      console.log(`  Card background: ${cardStyles.backgroundColor}`);
    }
    
    if (dateButton) {
      const btnStyles = getComputedStyle(dateButton);
      console.log(`  Date button border: ${btnStyles.borderColor}`);
    }
    
    if (ctaButton) {
      const ctaStyles = getComputedStyle(ctaButton);
      console.log(`  CTA button bg: ${ctaStyles.backgroundColor}`);
    }
    
    return result;
  }
  
  // Manual theme switching function
  window.testAllThemes = async function() {
    console.log('\n🚀 Testing all themes automatically...');
    
    for (const theme of themes) {
      if (theme !== currentTheme) {
        await testTheme(theme);
      }
    }
    
    // Return to original theme
    console.log(`\n🔄 Returning to original theme: ${currentTheme}`);
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // Summary
    console.log('\n\n📊 THEME TEST SUMMARY');
    console.log('====================');
    
    let passedThemes = 0;
    for (const [theme, result] of Object.entries(testResults.themes)) {
      const passed = result.hasAllVariables && result.elementsStyled.buttonsStyled && result.elementsStyled.cardsStyled;
      console.log(`${theme}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      if (passed) passedThemes++;
    }
    
    console.log(`\nOverall: ${passedThemes}/${themes.length} themes passed`);
  };
  
  // Visual theme switcher
  window.createThemeSwitcher = function() {
    const switcher = document.createElement('div');
    switcher.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: white;
      border: 2px solid #ddd;
      border-radius: 8px;
      padding: 10px;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    switcher.innerHTML = '<h3 style="margin: 0 0 10px 0; font-size: 14px;">Theme Switcher</h3>';
    
    themes.forEach(theme => {
      const btn = document.createElement('button');
      btn.textContent = theme;
      btn.style.cssText = `
        display: block;
        width: 100%;
        padding: 5px 10px;
        margin: 5px 0;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: ${theme === currentTheme ? '#007bff' : '#fff'};
        color: ${theme === currentTheme ? '#fff' : '#000'};
        cursor: pointer;
      `;
      
      btn.onclick = () => {
        document.documentElement.setAttribute('data-theme', theme);
        console.log(`Switched to ${theme} theme`);
        // Update button styles
        switcher.querySelectorAll('button').forEach(b => {
          b.style.background = b.textContent === theme ? '#007bff' : '#fff';
          b.style.color = b.textContent === theme ? '#fff' : '#000';
        });
      };
      
      switcher.appendChild(btn);
    });
    
    document.body.appendChild(switcher);
    console.log('Theme switcher added to page');
  };
  
  console.log('\n📝 Usage:');
  console.log('- Run testAllThemes() to test all themes automatically');
  console.log('- Run createThemeSwitcher() to add visual theme switcher');
  console.log('- Check console for detailed results');
  
  return testResults;
})();