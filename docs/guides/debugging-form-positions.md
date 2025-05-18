# Debugging Form Positions Guide

This guide explains how to use the Form Position Debug Tool to test and troubleshoot different booking form layouts without modifying Firestore data.

## Overview

The Form Position Debug Tool provides a visual interface for testing different booking form positions and sizes directly in the browser. This tool is useful for:

- Testing how different form positions look on a specific property
- Debugging layout issues with particular form positions
- Exploring how form positions work on different screen sizes
- Verifying responsive behavior of the positioning system

## Launching the Debug Tool

To launch the debug tool:

1. Open the property page in your browser
2. Open the browser's developer console:
   - Chrome/Edge: Press F12 or right-click → Inspect → Console
   - Firefox: Press F12 or right-click → Inspect Element → Console
   - Safari: Enable Developer menu in preferences, then Develop → Show JavaScript Console

3. Copy and paste the following code:
   ```javascript
   const script = document.createElement('script'); 
   script.src = '/debug-form-position.js'; 
   document.head.appendChild(script);
   ```

4. Press Enter to execute the code

A debug panel will appear in the bottom-right corner of your screen.

## Using the Debug Panel

The debug panel is divided into sections:

### 1. Schema Positions Section

![Schema Positions](../assets/form-debug-schema-positions.png)

This section includes buttons for positions defined in the Firestore schema:
- **top**: Positions the form at the top of the hero section
- **center**: Positions the form in the center of the hero section
- **bottom**: Positions the form at the bottom of the hero section (default)

When you click a button:
- The position is applied immediately
- The button turns blue to indicate it's active
- The form will reposition using the same logic as with Firestore data

### 2. Extended Positions Section

![Extended Positions](../assets/form-debug-extended-positions.png)

This section includes buttons for extended positions not yet in the schema:
- **top-left**: Positions the form in the top-left corner
- **top-right**: Positions the form in the top-right corner
- **bottom-left**: Positions the form in the bottom-left corner
- **bottom-right**: Positions the form in the bottom-right corner

When you click a button:
- The position is applied immediately
- The button turns yellow to indicate it's active
- The form will use the extended positioning logic

### 3. Form Size Section

![Form Size](../assets/form-debug-size.png)

This section lets you toggle between form sizes:
- **compressed**: Smaller, more compact form (default)
- **large**: Larger form with expanded layout

When you click a size button:
- You'll be prompted to reload the page (required for size changes to take effect)
- After reload, the form will display in the selected size
- The button turns green to indicate the active size

## Debug Tool Console Output

The debug tool also outputs useful information to the console:

- Current form position on initialization
- Position changes with source (schema-defined vs extended)
- Calculations for margin adjustments
- Warnings for non-schema positions

Example console output:
```
[Hero Form Position Testing]
Current form position: bottom
Position tester initialized. Use the buttons to test different form positions.
- Schema positions are fully supported in the Firestore configuration
- Extended positions are supported by the code but not in the current schema
[Changed position to schema position: center]
[Hero Form] Applied schema-defined position styling for: "center". Margin: 24px
```

## Troubleshooting Form Positions

If you encounter positioning issues:

1. **Form Not Appearing in Expected Position**
   - Verify the current position in the debug panel (button should be highlighted)
   - Check console for any warnings or errors
   - Try switching to a different position and back

2. **Form Size Not Updating**
   - Ensure you confirmed the page reload prompt
   - Verify the size indicator in the debug panel
   - Check for any JavaScript errors in console

3. **Form Layout Issues**
   - Test on different screen sizes using browser responsive mode
   - Compare behavior between schema and extended positions
   - Check console logs for position and margin calculations

4. **Debug Tool Not Loading**
   - Verify the path to the debug script is correct
   - Check for JavaScript errors in the console
   - Ensure the site is running in development mode

## Advanced Usage

### Testing Custom Positions

To test a position not included in the debug panel:

1. Open the console and run:
   ```javascript
   const heroSection = document.querySelector('#hero');
   heroSection.setAttribute('data-form-position', 'your-custom-position');
   window.dispatchEvent(new Event('resize'));
   ```

2. Observe how the positioning system handles the custom position
   (likely defaulting to 'bottom' behavior)

### Testing with Different Screen Sizes

1. Launch the debug panel
2. Open browser's responsive design mode (usually in the developer tools)
3. Change the viewport size while testing different positions
4. Observe how the form repositions based on screen size

## Developing the Debug Tool

The debug tool is located at `/public/debug-form-position.js` and can be modified to:

- Add new test positions
- Add additional configuration options
- Enhance visual feedback
- Add new debugging features

When updating the debug tool, consider:
- Making it compatible with all major browsers
- Keeping the UI simple and intuitive
- Providing useful console output
- Maintaining separate sections for schema vs extended features