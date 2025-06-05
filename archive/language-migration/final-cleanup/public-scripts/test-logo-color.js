// Test script to check logo color
(function() {
  const checkLogoColor = () => {
    const header = document.querySelector('#site-header');
    const logoContainer = header?.querySelector('svg')?.parentElement;
    const logo = header?.querySelector('svg');
    
    if (logo) {
      const computedStyle = window.getComputedStyle(logo);
      const fill = computedStyle.fill;
      const color = computedStyle.color;
      const parentColor = window.getComputedStyle(logoContainer).color;
      
      console.log('=== Logo Color Test ===');
      console.log('Logo SVG found');
      console.log('Fill style:', fill);
      console.log('Color style:', color);
      console.log('Parent color:', parentColor);
      console.log('SVG fill attribute:', logo.getAttribute('fill'));
      console.log('Current color used:', logo.style.fill || 'currentColor (inherited)');
      console.log('Header classes:', header?.className);
      console.log('Logo container classes:', logoContainer?.className);
    } else {
      console.log('No logo SVG found in header');
    }
  };
  
  // Run on load
  window.addEventListener('load', checkLogoColor);
  
  // Also check on scroll
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(checkLogoColor, 500);
  });
})();