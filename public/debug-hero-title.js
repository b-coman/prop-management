// Debug script to fix hero title and subtitle position
(function() {
  console.group('Hero Title Fix');
  
  // Get elements
  const header = document.querySelector('header');
  const heroSection = document.querySelector('#hero');
  const heroTitleContainer = heroSection?.querySelector('.text-center');
  const heroTitle = heroTitleContainer?.querySelector('h1');
  const heroSubtitle = heroTitleContainer?.querySelector('p');
  
  console.log('Header:', header);
  console.log('Hero Title Container:', heroTitleContainer);
  console.log('Hero Title:', heroTitle);
  console.log('Hero Subtitle:', heroSubtitle);
  
  if (header && heroTitleContainer) {
    const headerHeight = header.getBoundingClientRect().height;
    console.log(`Header height: ${headerHeight}px`);
    
    // Apply direct position fix to the title container
    heroTitleContainer.style.marginTop = `${headerHeight}px`;
    heroTitleContainer.style.paddingTop = '1rem';
    
    console.log('Applied margin-top to title container');
    
    // Log final position
    setTimeout(() => {
      if (heroTitleContainer) {
        const rect = heroTitleContainer.getBoundingClientRect();
        console.log('Hero Title Container final position:', {
          top: rect.top,
          height: rect.height,
          marginTop: window.getComputedStyle(heroTitleContainer).marginTop,
          paddingTop: window.getComputedStyle(heroTitleContainer).paddingTop
        });
      }
    }, 100);
  }
  
  console.groupEnd();
})();