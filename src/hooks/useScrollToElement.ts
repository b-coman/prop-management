'use client';

import { useCallback, useRef, useEffect, useState } from 'react';

interface ScrollToElementOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
  offset?: number;
  delay?: number;
}

export function useScrollToElement() {
  const scrollToElement = useCallback((
    elementId: string,
    options: ScrollToElementOptions = {}
  ) => {
    const {
      behavior = 'smooth',
      block = 'start',
      inline = 'nearest',
      offset = 0,
      delay = 0
    } = options;

    const scrollAction = () => {
      const element = document.getElementById(elementId);
      if (!element) {
        console.warn(`Element with id "${elementId}" not found`);
        return;
      }

      // Calculate the scroll position with offset
      if (offset !== 0) {
        const elementPosition = element.getBoundingClientRect();
        const absoluteElementTop = elementPosition.top + window.pageYOffset;
        const scrollToPosition = absoluteElementTop - offset;

        window.scrollTo({
          top: scrollToPosition,
          behavior
        });
      } else {
        element.scrollIntoView({
          behavior,
          block,
          inline
        });
      }
    };

    if (delay > 0) {
      setTimeout(scrollAction, delay);
    } else {
      scrollAction();
    }
  }, []);

  return scrollToElement;
}

export function useScrollToTop() {
  const scrollToTop = useCallback((options: ScrollToElementOptions = {}) => {
    const { behavior = 'smooth', delay = 0 } = options;

    const scrollAction = () => {
      window.scrollTo({
        top: 0,
        behavior
      });
    };

    if (delay > 0) {
      setTimeout(scrollAction, delay);
    } else {
      scrollAction();
    }
  }, []);

  return scrollToTop;
}

export function useScrollRestoration() {
  const scrollPositionRef = useRef(0);
  const isRestoringRef = useRef(false);

  const saveScrollPosition = useCallback(() => {
    scrollPositionRef.current = window.pageYOffset;
  }, []);

  const restoreScrollPosition = useCallback((delay = 0) => {
    isRestoringRef.current = true;
    
    const restoreAction = () => {
      window.scrollTo({
        top: scrollPositionRef.current,
        behavior: 'instant' as any
      });
      
      // Reset restoration flag after a short delay
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
    };

    if (delay > 0) {
      setTimeout(restoreAction, delay);
    } else {
      restoreAction();
    }
  }, []);

  const isRestoring = useCallback(() => {
    return isRestoringRef.current;
  }, []);

  return {
    saveScrollPosition,
    restoreScrollPosition,
    isRestoring
  };
}

interface ScrollSpyOptions {
  offset?: number;
  rootMargin?: string;
  threshold?: number | number[];
}

export function useScrollSpy(
  elementIds: string[],
  options: ScrollSpyOptions = {}
) {
  const {
    offset = 0,
    rootMargin = '-20% 0px -70% 0px',
    threshold = 0
  } = options;

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin,
        threshold
      }
    );

    const elements = elementIds
      .map(id => document.getElementById(id))
      .filter(el => el !== null) as HTMLElement[];

    elements.forEach(element => {
      observer.observe(element);
    });

    return () => {
      elements.forEach(element => {
        observer.unobserve(element);
      });
    };
  }, [elementIds, rootMargin, threshold]);

  return activeId;
}