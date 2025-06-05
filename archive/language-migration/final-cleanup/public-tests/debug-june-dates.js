// Debug script to check June 2025 availability discrepancy
(async function() {
  console.log('=== Debugging June 2025 Availability ===');
  
  try {
    // 1. Check availability API
    console.log('\n1. Checking availability API:');
    const availResponse = await fetch('/api/check-availability?propertySlug=prahova-mountain-chalet&months=12');
    const availData = await availResponse.json();
    
    const juneUnavailable = availData.unavailableDates?.filter(d => d.startsWith('2025-06'));
    console.log('June 2025 unavailable dates from availability API:', juneUnavailable);
    
    // 2. Check pricing API for different date ranges
    console.log('\n2. Checking pricing API:');
    
    const dateRanges = [
      { checkIn: '2025-06-04', checkOut: '2025-06-05', label: 'June 4-5' },
      { checkIn: '2025-06-05', checkOut: '2025-06-06', label: 'June 5-6' },
      { checkIn: '2025-06-06', checkOut: '2025-06-07', label: 'June 6-7' },
      { checkIn: '2025-06-04', checkOut: '2025-06-07', label: 'June 4-7' }
    ];
    
    for (const range of dateRanges) {
      const response = await fetch('/api/check-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: 'prahova-mountain-chalet',
          checkIn: range.checkIn,
          checkOut: range.checkOut,
          guests: 2
        })
      });
      
      const data = await response.json();
      console.log(`\n${range.label}:`, {
        available: data.available,
        reason: data.reason,
        unavailableDates: data.unavailableDates,
        dailyRates: data.pricing?.dailyRates
      });
    }
    
    // 3. Summary
    console.log('\n=== Summary ===');
    console.log('Availability API says June 5th is unavailable');
    console.log('Pricing API behavior needs to be examined above');
    
  } catch (error) {
    console.error('Error:', error);
  }
})();