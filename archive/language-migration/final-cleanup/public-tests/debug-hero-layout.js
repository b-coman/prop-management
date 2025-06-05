// Debug script to analyze the hero section layout
(function() {
  console.group('Hero Section Layout Analysis');
  
  // Get all key elements
  const header = document.querySelector('header');
  const heroSection = document.querySelector('#hero');
  const heroContainer = heroSection?.querySelector('.container');
  const heroContent = heroSection?.querySelector('.text-center');
  const mainContent = document.querySelector('#main-content');
  
  console.log('Header:', header);
  console.log('Hero Section:', heroSection);
  console.log('Hero Container:', heroContainer);
  console.log('Hero Content:', heroContent);
  console.log('Main Content:', mainContent);
  
  // Log dimensions and positions
  if (header && heroSection) {
    const headerRect = header.getBoundingClientRect();
    const heroRect = heroSection.getBoundingClientRect();
    const heroContentRect = heroContent?.getBoundingClientRect();
    
    console.log('Header dimensions:', {
      height: headerRect.height,
      top: headerRect.top,
      bottom: headerRect.bottom,
      visible: headerRect.height > 0 && headerRect.width > 0
    });
    
    console.log('Hero dimensions:', {
      height: heroRect.height,
      top: heroRect.top,
      bottom: heroRect.bottom,
      visible: heroRect.height > 0 && heroRect.width > 0
    });
    
    if (heroContent) {
      console.log('Hero Content dimensions:', {
        height: heroContentRect.height,
        top: heroContentRect.top,
        bottom: heroContentRect.bottom,
        distanceFromTop: heroContentRect.top - headerRect.bottom,
        distanceFromBottom: heroRect.bottom - heroContentRect.bottom,
        centeredPosition: heroRect.top + (heroRect.height / 2),
        actualCenterY: heroContentRect.top + (heroContentRect.height / 2),
        isCentered: Math.abs((heroRect.top + (heroRect.height / 2)) - (heroContentRect.top + (heroContentRect.height / 2))) < 20
      });
    }
  }
  
  // Check computed styles
  if (heroContent) {
    const computedStyle = window.getComputedStyle(heroContent);
    console.log('Hero Content Computed Style:', {
      paddingTop: computedStyle.paddingTop,
      marginTop: computedStyle.marginTop,
      position: computedStyle.position,
      display: computedStyle.display,
      alignItems: computedStyle.alignItems,
      justifyContent: computedStyle.justifyContent
    });
  }
  
  if (heroContainer) {
    const computedStyle = window.getComputedStyle(heroContainer);
    console.log('Hero Container Computed Style:', {
      paddingTop: computedStyle.paddingTop,
      marginTop: computedStyle.marginTop,
      position: computedStyle.position,
      display: computedStyle.display,
      alignItems: computedStyle.alignItems,
      justifyContent: computedStyle.justifyContent
    });
  }
  
  console.log('Suggesting needed adjustments...');
  
  if (header && heroContent) {
    const headerHeight = header.getBoundingClientRect().height;
    console.log(`To center content properly, try adding paddingTop: ${headerHeight/2}px to the hero content`);
    
    // Visualize center line
    const heroRect = heroSection.getBoundingClientRect();
    const heroCenter = heroRect.top + (heroRect.height / 2);
    
    // Create visual guide element if it doesn't exist
    let centerLine = document.getElementById('debug-center-line');
    if (!centerLine) {
      centerLine = document.createElement('div');
      centerLine.id = 'debug-center-line';
      centerLine.style.position = 'absolute';
      centerLine.style.left = '0';
      centerLine.style.right = '0';
      centerLine.style.height = '1px';
      centerLine.style.backgroundColor = 'red';
      centerLine.style.zIndex = '9999';
      document.body.appendChild(centerLine);
    }
    
    centerLine.style.top = `${heroCenter}px`;
    console.log(`Added visual guide at the center of the hero section (${heroCenter}px from top)`);
  }
  
  console.groupEnd();
})();