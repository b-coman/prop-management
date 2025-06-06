# Visual Regression Testing Framework

## Overview
Comprehensive visual regression testing suite for PropertyPageRenderer validation, ensuring consistent rendering across browsers, devices, and configurations.

## Purpose
This testing framework validates the unified PropertyPageRenderer system by:
- **Visual Parity**: Ensuring consistent rendering across all configurations
- **Cross-browser Compatibility**: Testing Chrome, Firefox, Safari, Edge
- **Responsive Design**: Validating mobile, tablet, and desktop viewports
- **Theme Consistency**: Testing all theme variations
- **Language Support**: Validating multilingual content rendering

## Test Structure

### Core Test Files
- `renderer-parity.test.ts` - Main visual regression tests
- `fixtures/test-property-data.ts` - Standardized test data
- `utils/test-helpers.ts` - Utility functions for testing
- `global-setup.ts` - Test environment preparation
- `global-teardown.ts` - Test cleanup and reporting

### Test Categories

#### 1. Homepage Visual Tests
- Standard homepage rendering
- Hero section validation
- Booking form component testing
- Mobile/tablet viewport testing

#### 2. Theme Variation Tests
- Default theme validation
- Forest theme testing
- Ocean theme testing
- Modern theme testing

#### 3. Language Support Tests
- English content rendering
- Romanian content rendering
- Language switching functionality

#### 4. Cross-browser Tests
- Chrome rendering consistency
- Firefox compatibility
- Safari validation
- Edge compatibility

#### 5. Performance Visual Tests
- Load time validation
- Fully loaded state confirmation
- Performance budget compliance

## Running Tests

### Basic Commands
```bash
# Run all visual tests
npm run test:visual

# Run tests with browser UI (for debugging)
npm run test:visual:headed

# Debug specific test
npm run test:visual:debug

# Update screenshot baselines
npm run test:visual:update
```

### Playwright Specific Commands
```bash
# Run specific test file
npx playwright test renderer-parity.test.ts

# Run tests for specific browser
npx playwright test --project=chromium

# Generate test report
npx playwright show-report
```

## Configuration

### Browser Support
- **Chromium** (Chrome-based)
- **Firefox** 
- **Webkit** (Safari-based)
- **Mobile Chrome** (Pixel 5)
- **Mobile Safari** (iPhone 12)
- **Microsoft Edge**

### Screenshot Settings
- **Threshold**: 0.1% pixel difference allowed
- **Max Diff Pixels**: 1000 pixels
- **Animation**: Disabled for consistency
- **Full Page**: Enabled by default

### Viewport Configurations
- **Mobile**: 375×667 (iPhone SE)
- **Tablet**: 768×1024 (iPad)
- **Desktop**: 1280×720 (Standard laptop)
- **Large**: 1920×1080 (Desktop monitor)

## Test Data

### Standard Test Property
```typescript
{
  name: 'Beautiful Mountain Retreat',
  location: 'Alpine Valley',
  price: '$150/night',
  amenities: ['wifi', 'kitchen', 'parking', 'fireplace'],
  theme: 'forest'
}
```

### Test Scenarios
1. **Standard Content**: Typical property with full data
2. **Minimal Content**: Reduced data to test edge cases
3. **Maximum Content**: Full data load testing
4. **Error States**: 404 and loading state validation

## Screenshot Organization

```
test-results/
├── visual/
│   ├── homepage-standard-chromium-darwin.png
│   ├── homepage-mobile-chromium-darwin.png
│   ├── homepage-forest-theme-chromium-darwin.png
│   ├── booking-form-component-chromium-darwin.png
│   └── test-summary.json
```

## Debugging Failed Tests

### Visual Diff Analysis
1. **Review HTML Report**: `npx playwright show-report`
2. **Compare Screenshots**: Use diff images in report
3. **Debug Mode**: `npm run test:visual:debug`
4. **Update Baselines**: `npm run test:visual:update` (if changes are intentional)

### Common Issues
- **Font Loading**: Tests wait for fonts to load
- **Animation Timing**: All animations disabled for consistency
- **Network Dependencies**: API responses mocked for reliability
- **Browser Differences**: Small differences expected and accounted for

## CI/CD Integration

### GitHub Actions Integration
```yaml
- name: Install Playwright
  run: npx playwright install

- name: Run Visual Tests
  run: npm run test:visual

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  with:
    name: visual-test-results
    path: test-results/
```

### Baseline Management
- **Development**: Update baselines locally
- **CI**: Fail on visual differences
- **Review**: Use HTML reports for visual diff review

## Performance Validation

### Load Time Assertions
- Homepage: < 5 seconds
- Property page: < 3 seconds
- Navigation: < 1 second

### Bundle Size Monitoring
- Screenshots capture fully loaded state
- Performance metrics logged in teardown
- Bundle size impact tracked

## Maintenance

### Regular Tasks
1. **Update Baselines**: When intentional design changes occur
2. **Browser Updates**: Regenerate baselines for major browser updates
3. **Test Data**: Keep test property data realistic and current
4. **Dependencies**: Update Playwright and related tools regularly

### Best Practices
- **Stable Selectors**: Use data-testid attributes for reliable element selection
- **Consistent Environment**: Mock external dependencies
- **Incremental Updates**: Update baselines incrementally, not all at once
- **Documentation**: Update this README when adding new test categories

---

**Framework Version**: 1.0.0  
**Last Updated**: June 6, 2025  
**Playwright Version**: ^1.52.0