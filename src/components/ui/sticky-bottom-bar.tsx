/**
 * StickyBottomBar - the chrome every pinned mobile bar shares, in one place.
 *
 * WHY. There were four of these: one on the landing and property pages (the "de la 350 lei/noapte"
 * bar in generic-header-multipage) and three on the booking page (no dates yet / dates but no price
 * / priced). They had drifted. Two of the four were missing
 * `pb-[env(safe-area-inset-bottom)]` - including the PRICED booking bar, the single most important
 * control in the funnel, whose WhatsApp button therefore sat under the home indicator on every
 * iPhone that has one. The same two also disagreed about background and blur: one was opaque with
 * no blur, one dropped to 60% opacity where backdrop-filter is supported, two sat at 95%.
 *
 * None of that was a decision. It was four copies of the same div edited on four different days.
 * So the chrome lives here now and the call sites pass only their content, which means the next
 * pinned bar cannot forget the safe area.
 *
 * WHAT IS DELIBERATELY NOT HERE. The content, the height, the actions and the copy. The landing bar
 * invites ("from X per night" + check availability); the booking bars close (a real total + the
 * route that actually converts). Those are different jobs and merging them would produce one
 * component with two disjoint modes, which is worse than two components that look alike.
 *
 * THE 60% VARIANT WAS DROPPED. The header bar alone carried
 * `supports-[backdrop-filter]:bg-background/60`. Over a photograph - which is exactly what sits
 * behind it on a landing page - a price at 60% opacity is harder to read than one at 95%, and this
 * bar exists to be read. Unifying meant picking one; legibility won.
 */
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export interface StickyBottomBarProps {
  children: React.ReactNode;
  /**
   * Omit for a bar that is simply present whenever it renders - the booking bars, which appear and
   * disappear by being mounted and unmounted.
   *
   * Pass a boolean for a bar that slides: the landing bar stays out of the way until the visitor
   * has scrolled past the hero, then rises. Passing `false` translates it off-screen rather than
   * unmounting it, which is what makes the transition possible in both directions.
   */
  visible?: boolean;
  /** Extra classes for the OUTER shell. Content padding belongs on the children. */
  className?: string;
}

export function StickyBottomBar({ children, visible, className }: StickyBottomBarProps) {
  const slides = visible !== undefined;

  return (
    <div
      className={cn(
        // z-50 is the established layer for pinned bars here: above the mobile date strip (30) and
        // the mobile header (40), below toasts (100) and the consent sheet (70).
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'border-t border-border/50 bg-background/95 backdrop-blur',
        'shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]',
        // The whole reason this component exists. 0 on everything without a home indicator, ~34px
        // on the iPhones that have one. Callers that reserve space for a bar must reserve this too:
        // see the `pb-[calc(8rem+env(safe-area-inset-bottom))]` on the booking page's <main>.
        'pb-[env(safe-area-inset-bottom)]',
        slides && 'transition-transform duration-300 ease-in-out',
        slides && (visible ? 'translate-y-0' : 'translate-y-full'),
        className,
      )}
    >
      {children}
    </div>
  );
}
