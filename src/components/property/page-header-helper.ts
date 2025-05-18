'use client';

/**
 * Page Header Content Positioning System
 * 
 * Provides dynamic positioning for page header section elements to ensure
 * they display correctly with the fixed transparent header, similar to hero-helper.ts
 * but adapted for the smaller page headers.
 */

export function setupPageHeaderContentAdjustment(): () => void {
  let resizeObserver: ResizeObserver | null = null;
  let rafId: number | null = null;

  const HEADER_HEIGHT = 64; // 4rem
  const MOBILE_BREAKPOINT = 768;

  const getViewportDimensions = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    isMobile: window.innerWidth < MOBILE_BREAKPOINT,
  });

  const positionContent = () => {
    // Find page header and title elements
    const pageHeader = document.querySelector('section[class*="page-header"]') || 
                       document.querySelector('section.has-transparent-header:not(#hero)');
    if (!pageHeader) return;

    const titleContainer = pageHeader.querySelector('.text-center');
    if (!titleContainer) return;

    const { height, isMobile } = getViewportDimensions();
    const headerElement = document.querySelector('header') || document.querySelector('#site-header');
    const actualHeaderHeight = headerElement?.getBoundingClientRect().height || HEADER_HEIGHT;

    // Get the page header's total height
    const pageHeaderHeight = pageHeader.getBoundingClientRect().height;
    
    // Calculate available space below the fixed header
    const availableHeight = pageHeaderHeight - actualHeaderHeight;
    
    // Calculate vertical centering within the visible area
    const titleHeight = (titleContainer as HTMLElement).offsetHeight;
    const verticalPadding = (availableHeight - titleHeight) / 2;
    
    // Apply positioning - add header height to push content below fixed header
    (titleContainer as HTMLElement).style.marginTop = `${actualHeaderHeight + Math.max(verticalPadding, 20)}px`;
    
    // Adjust for mobile if needed
    if (isMobile) {
      (titleContainer as HTMLElement).style.marginTop = `${actualHeaderHeight + Math.max(verticalPadding, 16)}px`;
    }
  };

  const init = () => {
    // Initial positioning
    positionContent();

    // Watch for element size changes
    const pageHeader = document.querySelector('section[class*="page-header"]') || 
                       document.querySelector('section.has-transparent-header:not(#hero)');
    if (pageHeader && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(positionContent);
      });
      resizeObserver.observe(pageHeader);
    }

    // Handle window resize
    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(positionContent);
    };
    window.addEventListener('resize', handleResize);

    // Font loading
    if ('fonts' in document) {
      document.fonts.ready.then(positionContent);
    }

    // Return cleanup function
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('resize', handleResize);
    };
  };

  return init();
}