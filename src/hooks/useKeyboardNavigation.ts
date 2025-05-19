import { useEffect, useRef } from 'react';

interface UseKeyboardNavigationOptions {
  onEscape?: () => void;
  onEnter?: () => void;
  onTab?: (event: KeyboardEvent) => void;
  onShiftTab?: (event: KeyboardEvent) => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions) {
  const {
    onEscape,
    onEnter,
    onTab,
    onShiftTab,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    enabled = true
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onEscape?.();
          break;
        
        case 'Enter':
          if (!event.shiftKey && !event.ctrlKey && !event.altKey) {
            onEnter?.();
          }
          break;
        
        case 'Tab':
          if (event.shiftKey) {
            onShiftTab?.(event);
          } else {
            onTab?.(event);
          }
          break;
        
        case 'ArrowUp':
          event.preventDefault();
          onArrowUp?.();
          break;
        
        case 'ArrowDown':
          event.preventDefault();
          onArrowDown?.();
          break;
        
        case 'ArrowLeft':
          event.preventDefault();
          onArrowLeft?.();
          break;
        
        case 'ArrowRight':
          event.preventDefault();
          onArrowRight?.();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onEscape, onEnter, onTab, onShiftTab, onArrowUp, onArrowDown, onArrowLeft, onArrowRight]);
}

// Focus trap hook for modal/form elements
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, enabled = true) {
  const firstFocusableRef = useRef<HTMLElement | null>(null);
  const lastFocusableRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const focusableArray = Array.from(focusableElements) as HTMLElement[];
    firstFocusableRef.current = focusableArray[0];
    lastFocusableRef.current = focusableArray[focusableArray.length - 1];

    // Focus first element on mount
    firstFocusableRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !container.contains(document.activeElement)) return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusableRef.current) {
          event.preventDefault();
          lastFocusableRef.current?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusableRef.current) {
          event.preventDefault();
          firstFocusableRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, enabled]);

  return {
    firstFocusableRef,
    lastFocusableRef
  };
}

// Arrow key navigation for option cards
export function useArrowKeyNavigation(
  items: HTMLElement[],
  onSelect: (index: number) => void,
  orientation: 'horizontal' | 'vertical' | 'grid' = 'horizontal',
  columns?: number
) {
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      let newIndex = currentIndexRef.current;

      switch (event.key) {
        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'grid') {
            event.preventDefault();
            newIndex = (currentIndexRef.current + 1) % items.length;
          }
          break;
        
        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'grid') {
            event.preventDefault();
            newIndex = (currentIndexRef.current - 1 + items.length) % items.length;
          }
          break;
        
        case 'ArrowDown':
          event.preventDefault();
          if (orientation === 'vertical') {
            newIndex = (currentIndexRef.current + 1) % items.length;
          } else if (orientation === 'grid' && columns) {
            newIndex = Math.min(currentIndexRef.current + columns, items.length - 1);
          }
          break;
        
        case 'ArrowUp':
          event.preventDefault();
          if (orientation === 'vertical') {
            newIndex = (currentIndexRef.current - 1 + items.length) % items.length;
          } else if (orientation === 'grid' && columns) {
            newIndex = Math.max(currentIndexRef.current - columns, 0);
          }
          break;
        
        case 'Enter':
        case ' ':
          event.preventDefault();
          onSelect(currentIndexRef.current);
          break;
        
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        
        case 'End':
          event.preventDefault();
          newIndex = items.length - 1;
          break;
      }

      if (newIndex !== currentIndexRef.current && items[newIndex]) {
        currentIndexRef.current = newIndex;
        items[newIndex].focus();
      }
    };

    items.forEach(item => {
      item.addEventListener('keydown', handleKeyDown);
    });

    return () => {
      items.forEach(item => {
        item.removeEventListener('keydown', handleKeyDown);
      });
    };
  }, [items, onSelect, orientation, columns]);

  return currentIndexRef;
}