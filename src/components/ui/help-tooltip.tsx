"use client";

import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
  className?: string;
  iconClassName?: string;
  contentClassName?: string;
  children?: React.ReactNode;
}

export function HelpTooltip({ 
  content, 
  className,
  iconClassName,
  contentClassName,
  children 
}: HelpTooltipProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Detect touch device
    const checkTouchDevice = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(max-width: 768px)').matches
      );
    };

    checkTouchDevice();
    window.addEventListener('resize', checkTouchDevice);
    
    return () => window.removeEventListener('resize', checkTouchDevice);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (isTouchDevice) {
      e.preventDefault();
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    }
  };

  // Mobile: Expandable help text
  if (isTouchDevice) {
    return (
      <span className={cn("inline-flex flex-col", className)}>
        <span className="inline-flex items-center">
          {children}
          <button
            type="button"
            onClick={handleClick}
            className={cn(
              "ml-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded",
              iconClassName
            )}
            aria-label="Toggle help information"
            aria-expanded={isExpanded}
          >
            <Info className="h-3 w-3" />
          </button>
        </span>
        {isExpanded && (
          <span 
            className={cn(
              "text-xs text-muted-foreground mt-1 block animate-in slide-in-from-top-1 duration-200",
              contentClassName
            )}
          >
            {content}
          </span>
        )}
      </span>
    );
  }

  // Desktop: Traditional tooltip
  return (
    <TooltipProvider>
      <span className={cn("inline-flex items-center", className)}>
        {children}
        <Tooltip>
          <TooltipTrigger asChild>
            <span 
              className={cn(
                "ml-1 text-xs text-muted-foreground cursor-help",
                iconClassName
              )}
            >
              <Info className="h-3 w-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent className={contentClassName}>
            <p>{content}</p>
          </TooltipContent>
        </Tooltip>
      </span>
    </TooltipProvider>
  );
}