/**
 * @jest-environment jsdom
 *
 * These assertions are on class strings, which is usually a smell. Here it is the point.
 *
 * `env(safe-area-inset-bottom)` resolves to 0 in jsdom, in headless Chrome, and in every desktop
 * browser anyone would test this in. It is non-zero only on the physical phones where getting it
 * wrong means the WhatsApp button sits under the home indicator - which is precisely why two of the
 * four bars had already lost it without anyone noticing, including the priced booking bar. There is
 * no behaviour to observe in a test environment; the class IS the behaviour, so the class is what
 * gets pinned.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { StickyBottomBar } from '../sticky-bottom-bar';

const shell = () => screen.getByTestId('content').parentElement as HTMLElement;

describe('StickyBottomBar', () => {
  it('always reserves the home-indicator inset', () => {
    // The regression this component was created to make impossible.
    render(<StickyBottomBar><span data-testid="content">x</span></StickyBottomBar>);
    expect(shell().className).toContain('pb-[env(safe-area-inset-bottom)]');
  });

  it('reserves it on a sliding bar too', () => {
    // The landing bar is the other one that had lost it.
    render(<StickyBottomBar visible><span data-testid="content">x</span></StickyBottomBar>);
    expect(shell().className).toContain('pb-[env(safe-area-inset-bottom)]');
  });

  it('pins to the bottom above the date strip and header, and never shows on desktop', () => {
    render(<StickyBottomBar><span data-testid="content">x</span></StickyBottomBar>);
    const cls = shell().className;
    expect(cls).toContain('fixed');
    expect(cls).toContain('bottom-0');
    expect(cls).toContain('z-50');   // date strip is 30, mobile header 40
    expect(cls).toContain('lg:hidden');
  });

  it('does not animate when no visibility is passed', () => {
    // The booking bars appear by mounting. A transform on a freshly mounted bar would slide it in
    // from nowhere every time the price changed.
    render(<StickyBottomBar><span data-testid="content">x</span></StickyBottomBar>);
    const cls = shell().className;
    expect(cls).not.toContain('transition-transform');
    expect(cls).not.toContain('translate-y-full');
  });

  it('slides out of the way rather than unmounting when hidden', () => {
    // translate-y-full, not display:none — otherwise it cannot animate back in.
    render(<StickyBottomBar visible={false}><span data-testid="content">x</span></StickyBottomBar>);
    const cls = shell().className;
    expect(cls).toContain('translate-y-full');
    expect(cls).toContain('transition-transform');
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('slides in when visible', () => {
    render(<StickyBottomBar visible><span data-testid="content">x</span></StickyBottomBar>);
    expect(shell().className).toContain('translate-y-0');
    expect(shell().className).not.toContain('translate-y-full');
  });

  it('renders its content', () => {
    render(<StickyBottomBar><span data-testid="content">2.467 lei</span></StickyBottomBar>);
    expect(screen.getByText('2.467 lei')).toBeInTheDocument();
  });
});
