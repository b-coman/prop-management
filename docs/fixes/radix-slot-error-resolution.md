# Radix Slot Error Resolution

## Date: May 18, 2025

### Problem
```
Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined. You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.

Check the render method of `Primitive.button.SlotClone`.
```

### Root Cause
This error occurs when Next.js `Link` components wrap `Button` components that use Radix UI's `Slot` internally. The incorrect nesting causes a conflict between how Next.js handles links and how Radix's Slot component clones elements.

### Files Fixed

1. **`/src/components/homepage/call-to-action.tsx`**
   - Changed from: `<Link><Button>Text</Button></Link>`
   - Changed to: `<Button asChild><Link>Text</Link></Button>`

2. **`/src/components/generic-header.tsx`**
   - Fixed two instances: desktop "Book Now" and mobile "Book Now" buttons

3. **`/src/components/generic-header-multipage.tsx`**
   - Fixed button items mapping in desktop navigation

### Resolution Steps

1. **Clear Next.js cache**:
   ```bash
   rm -rf .next
   ```

2. **Clear browser cache**:
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Or open Developer Tools → Application → Clear Storage

3. **Restart development server**:
   ```bash
   npm run dev
   ```

### Verification

1. All Button/Link combinations now use the correct pattern
2. No more SlotClone errors in console
3. Homepage loads correctly

### Pattern to Use

❌ **Incorrect:**
```tsx
<Link href="/path">
  <Button>Click me</Button>
</Link>
```

✅ **Correct:**
```tsx
<Button asChild>
  <Link href="/path">Click me</Link>
</Button>
```

### Prevention

1. Always use `asChild` prop when combining Button with Link
2. Button wraps Link, not the other way around
3. Add to code review checklist