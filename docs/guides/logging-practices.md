# Logging Best Practices

This document outlines the logging approach used in RentalSpot to ensure consistent, helpful, and maintainable logging throughout the application.

## Core Principles

1. **Never Remove Logs** - Even after resolving issues, maintain logging statements in the codebase. These logs are essential for future debugging and understanding the application flow.

2. **Clear Identification** - Use prefixes like `[SERVER]` or `[CLIENT]` to immediately identify the context of each log.

3. **Use Visual Indicators** - Use emojis or symbols to indicate log types (✅ success, ⚠️ warning, ❌ error, ℹ️ info, 🔍 debug).

4. **Structured Format** - Use consistent formatting with section headers and proper indentation for related logs.

5. **Include Timestamps** - Always include timestamps for time-sensitive operations to trace sequence of events.

## Logging Standards

### Server-Side Logs

Server-side logs should use this format:

```javascript
console.log("\n================================");
console.log("🔍 [SERVER] Operation Description");
console.log("================================");
console.log(`📆 Date/Time: ${new Date().toISOString()}`);
console.log(`📄 Context Info: ${relevantData}`);
// Log specific details...
console.log("================================\n");

// Success log example
console.log(`✅ [SERVER] Operation successful: "${result}"`);

// Warning log example
console.warn("⚠️ [SERVER] Warning condition detected:");
console.warn(`   Details: ${details}`);

// Error log example
console.error("❌ [SERVER] Operation failed:");
console.error(`   Error: ${error}`);
```

### Client-Side Logs

Client-side logs should use this format:

```javascript
console.log("\n--------------------------------");
console.log("🔄 [CLIENT] Operation Description");
console.log("--------------------------------");
console.log(`📆 Date/Time: ${new Date().toISOString()}`);
console.log(`📄 Context Info: ${relevantData}`);
// Log specific details...
console.log("--------------------------------\n");

// Success log example
console.log("✅ [CLIENT] Operation successful");

// Warning log example
console.warn("⚠️ [CLIENT] Warning condition detected");

// Error log example
console.error("❌ [CLIENT] Operation failed");
```

## Logging in Key Areas

### Booking Flow Logging

The booking flow has particularly thorough logging to track:

1. **URL Parameter Parsing** - Log all URL parameters and parsed dates
2. **Context Initialization** - Log when booking context values are set
3. **Availability Checking** - Log when availability checks start, complete, or are skipped
4. **State Changes** - Log all key state changes in the booking process
5. **Timeouts and Cleanup** - Log all timeout scheduling and cleanup operations

### Firebase/Data Logging

When interacting with Firebase:

1. **Request Logging** - Log queries before they're sent
2. **Response Logging** - Log responses from Firebase 
3. **Error Handling** - Log detailed error information including relevant parameters

## Integration With Error Handling

Logging should be integrated with error handling:

```javascript
try {
  // Operation
  console.log("✅ [CLIENT] Operation successful");
} catch (error) {
  console.error("❌ [CLIENT] Operation failed:");
  console.error(`   Error: ${error.message}`);
  console.error(`   Stack: ${error.stack}`);
  // Error handling
}
```

## Maintaining Logs

1. **Never remove logs during refactoring** - Keep logs even after resolving issues
2. **Improve existing logs** - Enhance logs with more context if needed
3. **Keep log prefixes consistent** - Stick to the established naming conventions

Remember: thorough logging is crucial throughout the entire development lifecycle, not just during initial debugging.