# V2 Debug Issues Found

## Issues Identified:

1. **Logger import error**: ✅ **FIXED**
   - Changed from `import { logger }` to `import { loggers }`
   - Updated all logger calls to use `loggers.bookingContext.xxx()`

2. **Infinite re-render loop**: ✅ **FIXED**
   - Caused by fetchUnavailableDates in useEffect dependency array  
   - Fixed: Removed dependency and added eslint-disable comment

## Quick Test Steps:

### Test 1: Disable V2 First
```bash
# In .env.local, set:
NEXT_PUBLIC_BOOKING_V2=false
```
Test if V1 loads without errors with your URL.

### Test 2: Enable V2 After Logger Fix
```bash
# In .env.local, set:
NEXT_PUBLIC_BOOKING_V2=true
```
Test if V2 loads now with the logger fixes.

## Expected Result:
- V1 should work normally
- V2 should load without logger errors  
- V2 should load without infinite loop errors

## Next Steps if Issues Persist:
1. Temporarily remove all session storage hooks
2. Use simple useState for basic functionality  
3. Add session storage back incrementally