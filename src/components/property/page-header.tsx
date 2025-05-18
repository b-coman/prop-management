// src/components/property/page-header.tsx
"use client";

import { useEffect, useState } from 'react';
import { PageHeaderBlock } from '@/lib/overridesSchemas-multipage';
import { useLanguage } from '@/hooks/useLanguage';
import { setupPageHeaderContentAdjustment } from './page-header-helper';

interface PageHeaderProps {
  content: PageHeaderBlock;
}

export function PageHeader({ content }: PageHeaderProps) {
  const { title, subtitle, backgroundImage } = content;
  const { tc } = useLanguage();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    
    // Set up dynamic positioning after a short delay to ensure DOM is ready
    let cleanup: (() => void) | undefined;
    
    const timer = setTimeout(() => {
      cleanup = setupPageHeaderContentAdjustment();
    }, 100);
    
    return () => {
      clearTimeout(timer);
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  return (
    <section 
      className="relative h-[24vh] min-h-[240px] md:h-[32vh] md:min-h-[320px] w-full flex text-white has-transparent-header slides-under-header page-header"
      style={{ position: 'relative' }}
    >
      {backgroundImage && (
        <>
          {/* Background image */}
          <div className="absolute inset-0 -z-10">
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
          </div>
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/60 -z-10"></div>
        </>
      )}
      
      {/* Main content container - starts at top like hero for dynamic positioning */}
      <div className="container mx-auto px-4 flex flex-col h-full w-full justify-start items-center py-8 md:py-12 relative">
        <div className="text-center max-w-3xl mx-auto opacity-0 transition-opacity duration-300" ref={(el) => {
          // Initial invisible state to prevent flicker during positioning
          if (el) setTimeout(() => el.classList.remove('opacity-0'), 350);
        }}>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 drop-shadow-md">{tc(title)}</h1>
          {subtitle && <p className="text-lg md:text-xl max-w-2xl mx-auto drop-shadow-sm">{tc(subtitle)}</p>}
        </div>
      </div>
    </section>
  );
}