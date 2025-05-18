// Debug script to analyze the form container positioning within hero section
(function() {
  console.group('Hero Form Container Audit');
  
  // Get relevant elements
  const header = document.querySelector('header');
  const heroSection = document.querySelector('#hero');
  const heroContainer = heroSection?.querySelector('.container');
  const titleContainer = heroSection?.querySelector('.text-center');
  const formContainer = heroSection?.querySelector('[class*="bg-background"]'); // Form usually has bg-background class
  const formWrapper = formContainer?.parentElement;
  
  // Log the elements
  console.log('Header:', header);
  console.log('Hero Section:', heroSection);
  console.log('Hero Container:', heroContainer);
  console.log('Title Container:', titleContainer);
  console.log('Form Container:', formContainer);
  console.log('Form Wrapper:', formWrapper);
  
  // Log dimensions and positions
  if (heroSection && formContainer) {
    const heroRect = heroSection.getBoundingClientRect();
    const formRect = formContainer.getBoundingClientRect();
    const titleRect = titleContainer?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    
    // Form positioning info
    console.log('Form Container Dimensions:', {
      width: formRect.width,
      height: formRect.height,
      top: formRect.top,
      bottom: formRect.bottom,
      left: formRect.left,
      right: formRect.right,
      // Distance from other elements
      distanceFromHeroTop: formRect.top - heroRect.top,
      distanceFromHeroBottom: heroRect.bottom - formRect.bottom,
      distanceFromHeader: headerRect ? formRect.top - headerRect.bottom : 'N/A',
      distanceFromTitle: titleRect ? formRect.top - titleRect.bottom : 'N/A',
      // Center point
      centerY: formRect.top + (formRect.height / 2),
      centerX: formRect.left + (formRect.width / 2),
      // Hero center for comparison
      heroCenterY: heroRect.top + (heroRect.height / 2),
      heroCenterX: heroRect.left + (heroRect.width / 2),
    });
    
    // Container CSS analysis
    if (formContainer && heroContainer) {
      const formStyles = window.getComputedStyle(formContainer);
      const containerStyles = window.getComputedStyle(heroContainer);
      const formWrapperStyles = formWrapper ? window.getComputedStyle(formWrapper) : null;
      
      console.log('Form Container Styles:', {
        display: formStyles.display,
        position: formStyles.position,
        width: formStyles.width,
        maxWidth: formStyles.maxWidth,
        margin: formStyles.margin,
        marginTop: formStyles.marginTop,
        marginBottom: formStyles.marginBottom,
        marginLeft: formStyles.marginLeft,
        marginRight: formStyles.marginRight,
        padding: formStyles.padding,
        backgroundColor: formStyles.backgroundColor,
        borderRadius: formStyles.borderRadius,
        boxShadow: formStyles.boxShadow,
      });
      
      console.log('Hero Container Styles:', {
        display: containerStyles.display,
        flexDirection: containerStyles.flexDirection,
        justifyContent: containerStyles.justifyContent,
        alignItems: containerStyles.alignItems,
        position: containerStyles.position,
      });
      
      if (formWrapperStyles) {
        console.log('Form Wrapper Styles:', {
          display: formWrapperStyles.display,
          flexDirection: formWrapperStyles.flexDirection,
          justifyContent: formWrapperStyles.justifyContent,
          alignItems: formWrapperStyles.alignItems,
          position: formWrapperStyles.position,
          marginTop: formWrapperStyles.marginTop,
        });
      }
    }
    
    // List any layout or positioning issues
    const issues = [];
    
    // Check for responsive issues
    if (formRect.width > heroRect.width * 0.95) {
      issues.push('Form container may be too wide for smaller screens');
    }
    
    // Check vertical positioning
    if (formRect.bottom > heroRect.bottom) {
      issues.push('Form extends beyond hero section bottom boundary');
    }
    
    // Check for potential overlap with title
    if (titleRect && formRect.top < titleRect.bottom) {
      issues.push('Form may overlap with title container');
    }
    
    // Check centering (if intended)
    const horizontalOffset = Math.abs(formRect.left + (formRect.width/2) - (heroRect.left + heroRect.width/2));
    if (horizontalOffset > 10) { // Allow small variations
      issues.push(`Form is not horizontally centered (offset: ${horizontalOffset}px)`);
    }
    
    if (issues.length > 0) {
      console.warn('Potential Form Positioning Issues:', issues);
    } else {
      console.log('No obvious form positioning issues detected');
    }
    
    // Suggestions for improvement
    console.log('Potential Form Positioning Improvements:');
    console.log('1. Use flex or grid positioning for more consistent layout');
    console.log('2. Consider more responsive sizing for the form container');
    console.log('3. Evaluate if the form\'s current position is optimal for user experience');
    console.log('4. Consider using relative positioning to ensure proper spacing from title');
  }
  
  console.groupEnd();
})();