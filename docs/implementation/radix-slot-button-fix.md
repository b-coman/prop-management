# Radix Slot Button Fix Documentation

## Date: May 18, 2025

### Problem

Runtime error encountered when using Next.js `Link` component wrapping a `Button` component:

```
Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined. You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.

Check the render method of `Primitive.button.SlotClone`.
```

### Root Cause

The error occurs when the `Button` component (which uses Radix UI's `Slot` internally) is wrapped by a Next.js `Link` component. This creates a conflict between how Next.js handles link children and how Radix's Slot component expects to clone elements.

### Incorrect Pattern

```tsx
// ❌ This causes the error
<Link href="/some-path">
  <Button>Click me</Button>
</Link>
```

### Correct Pattern

```tsx
// ✅ Use the asChild prop on Button
<Button asChild>
  <Link href="/some-path">
    Click me
  </Link>
</Button>
```

### Files Fixed

1. **`/src/components/homepage/call-to-action.tsx`**
   - Fixed button in CTA section

2. **`/src/components/generic-header.tsx`**
   - Fixed desktop navigation "Book Now" button
   - Fixed mobile navigation "Book Now" button

### Implementation Details

The `asChild` prop tells the Button component to render its children instead of a button element, while still applying all the button styles and behaviors. This allows the Link component to be the actual rendered element while maintaining button appearance.

### Prevention Guidelines

1. Always use `asChild` prop when combining Button with Link
2. Button should wrap Link, not the other way around
3. Check for this pattern in code reviews
4. Consider creating a custom `LinkButton` component that encapsulates this pattern

### Example LinkButton Component

```tsx
// Optional: Create a reusable component
import { Button, ButtonProps } from '@/components/ui/button';
import Link, { LinkProps } from 'next/link';

interface LinkButtonProps extends ButtonProps {
  href: LinkProps['href'];
  children: React.ReactNode;
}

export function LinkButton({ href, children, ...buttonProps }: LinkButtonProps) {
  return (
    <Button {...buttonProps} asChild>
      <Link href={href}>
        {children}
      </Link>
    </Button>
  );
}
```

### Testing

After applying fixes:
1. Clear Next.js cache: `rm -rf .next`
2. Restart development server
3. Test all pages with Link/Button combinations
4. Verify no runtime errors in console