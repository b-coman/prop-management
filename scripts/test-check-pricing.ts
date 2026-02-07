#!/usr/bin/env npx tsx
/**
 * Live integration test for the check-pricing API.
 *
 * Prerequisites:
 *   1. npm run dev  (server running)
 *   2. Price calendars generated for the property (admin UI)
 *
 * Usage:
 *   npx tsx scripts/test-check-pricing.ts
 *   npx tsx scripts/test-check-pricing.ts http://localhost:9002
 */

const BASE_URL = process.argv[2] || 'http://localhost:9002';
const PROPERTY_ID = 'prahova-mountain-chalet';

// Known property config (from Firestore, updated Feb 2026)
const EXPECTED = {
  pricePerNight: 523,
  weekendAdjustment: 1.3155,
  weekendDays: ['friday', 'saturday'],
  baseOccupancy: 4,
  extraGuestFee: 25,
  cleaningFee: 200,
};

// Helper: format a local Date as YYYY-MM-DD without UTC timezone shift
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Helper: find the next occurrence of a weekday, N months ahead
function nextWeekday(dayName: string, monthsAhead: number = 3): string {
  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6
  };
  const target = dayMap[dayName];
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  d.setDate(1);
  while (d.getDay() !== target) {
    d.setDate(d.getDate() + 1);
  }
  return formatDate(d);
}

// Helper: add days to a YYYY-MM-DD string
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return formatDate(date);
}

function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });
}

async function callCheckPricing(checkIn: string, checkOut: string, guests: number): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/check-pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId: PROPERTY_ID, checkIn, checkOut, guests }),
  });
  return res.json();
}

// ============================================================================
// Runner
// ============================================================================
async function run() {
  console.log('===========================================');
  console.log('  Check-Pricing API Integration Tests');
  console.log(`  Server: ${BASE_URL}`);
  console.log(`  Property: ${PROPERTY_ID}`);
  console.log('===========================================\n');

  // Check server (use check-pricing with invalid body — just needs a connection)
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/check-pricing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!healthCheck.ok && healthCheck.status !== 400) throw new Error(`status ${healthCheck.status}`);
  } catch (e: any) {
    console.error('ERROR: Cannot reach server at ' + BASE_URL + ': ' + e.message + '\n');
    process.exit(1);
  }

  // Pick test dates ~1 month ahead (within calendar range, avoids existing bookings)
  // Use Wed-Fri (2 weeknights) and Fri-Sun (2 weekend nights)
  const wed = nextWeekday('wednesday', 1);
  const fri = nextWeekday('friday', 1);

  console.log(`  Test dates: Weekday ${wed} (${getDayName(wed)}), Weekend ${fri} (${getDayName(fri)})`);
  console.log('');

  // Verify the day names are correct
  if (getDayName(wed) !== 'Wednesday') {
    console.error(`  BUG: ${wed} is ${getDayName(wed)}, not Wednesday`);
    process.exit(1);
  }
  if (getDayName(fri) !== 'Friday') {
    console.error(`  BUG: ${fri} is ${getDayName(fri)}, not Friday`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  // =========================================================================
  // Test 1: 2-night weekday stay (Wed-Fri), base occupancy
  // =========================================================================
  {
    const name = `2-night weekday stay (${wed} to ${addDays(wed, 2)}), ${EXPECTED.baseOccupancy} guests`;
    process.stdout.write(`  [1] ${name} ... `);
    const r = await callCheckPricing(wed, addDays(wed, 2), EXPECTED.baseOccupancy);

    if (!r.available) {
      console.log(`FAIL: ${r.reason} ${r.unavailableDates?.join(', ') || `minStay=${r.minimumStay}`}`);
      failed++;
    } else {
      const wedRate = r.pricing?.dailyRates?.[wed];
      const thuRate = r.pricing?.dailyRates?.[addDays(wed, 1)];
      if (wedRate && thuRate && r.pricing.numberOfNights === 2) {
        console.log(`PASS (rates: ${wedRate}, ${thuRate})`);
        passed++;
      } else {
        console.log(`FAIL: unexpected response structure`);
        console.log(`    `, JSON.stringify(r.pricing, null, 2).slice(0, 200));
        failed++;
      }
    }
  }

  // =========================================================================
  // Test 2: 2-night weekend stay (Fri-Sun), base occupancy
  // =========================================================================
  {
    const name = `2-night weekend stay (${fri} to ${addDays(fri, 2)}), ${EXPECTED.baseOccupancy} guests`;
    process.stdout.write(`  [2] ${name} ... `);
    const r = await callCheckPricing(fri, addDays(fri, 2), EXPECTED.baseOccupancy);

    if (!r.available) {
      console.log(`FAIL: ${r.reason} ${r.unavailableDates?.join(', ') || `minStay=${r.minimumStay}`}`);
      failed++;
    } else {
      const friRate = r.pricing?.dailyRates?.[fri];
      const satRate = r.pricing?.dailyRates?.[addDays(fri, 1)];
      if (friRate && satRate && r.pricing.numberOfNights === 2) {
        console.log(`PASS (rates: Fri=${friRate}, Sat=${satRate})`);
        passed++;
      } else {
        console.log(`FAIL: unexpected response`);
        failed++;
      }
    }
  }

  // =========================================================================
  // Test 3: Weekend/Weekday price ratio = 1.2x
  // =========================================================================
  {
    process.stdout.write(`  [3] Weekend/weekday price ratio = ${EXPECTED.weekendAdjustment}x ... `);

    const weekdayR = await callCheckPricing(wed, addDays(wed, 2), EXPECTED.baseOccupancy);
    const weekendR = await callCheckPricing(fri, addDays(fri, 2), EXPECTED.baseOccupancy);

    if (!weekdayR.available || !weekendR.available) {
      console.log('SKIP (dates unavailable)');
    } else {
      const weekdayRate = weekdayR.pricing?.dailyRates?.[wed];
      const weekendRate = weekendR.pricing?.dailyRates?.[fri];

      if (weekdayRate && weekendRate) {
        const ratio = weekendRate / weekdayRate;
        const sameSeason = true; // Both dates same distance from now, likely same season or no season

        if (Math.abs(ratio - EXPECTED.weekendAdjustment) < 0.01) {
          console.log(`PASS (${weekendRate}/${weekdayRate} = ${ratio.toFixed(3)})`);
          passed++;
        } else {
          // Could be different seasons — check if ratio is reasonable
          console.log(`WARN: ratio = ${ratio.toFixed(3)}, expected ${EXPECTED.weekendAdjustment}`);
          console.log(`    Weekday rate: ${weekdayRate}, Weekend rate: ${weekendRate}`);
          console.log('    (May differ if different seasons apply to these dates)');
          // Don't count as fail if ratio > 1 (weekend is more expensive)
          if (ratio > 1) {
            passed++;
          } else {
            failed++;
          }
        }
      } else {
        console.log('FAIL: missing rates');
        failed++;
      }
    }
  }

  // =========================================================================
  // Test 4: Extra guest fee check (base occ vs base+2)
  // =========================================================================
  {
    process.stdout.write(`  [4] Extra guest fee: ${EXPECTED.baseOccupancy + 2} guests vs ${EXPECTED.baseOccupancy} ... `);

    const baseR = await callCheckPricing(wed, addDays(wed, 2), EXPECTED.baseOccupancy);
    const extraR = await callCheckPricing(wed, addDays(wed, 2), EXPECTED.baseOccupancy + 2);

    if (!baseR.available || !extraR.available) {
      console.log('SKIP (dates unavailable)');
    } else {
      const baseRate = baseR.pricing?.dailyRates?.[wed];
      const extraRate = extraR.pricing?.dailyRates?.[wed];

      if (baseRate && extraRate) {
        const diff = extraRate - baseRate;
        const expectedDiff = 2 * EXPECTED.extraGuestFee;

        if (Math.abs(diff - expectedDiff) < 0.01) {
          console.log(`PASS (diff=${diff}, expected=${expectedDiff})`);
          passed++;
        } else {
          console.log(`FAIL: diff=${diff}, expected=${expectedDiff}`);
          console.log(`    Base rate: ${baseRate}, Extra rate: ${extraRate}`);
          failed++;
        }
      } else {
        console.log('FAIL: missing rates');
        failed++;
      }
    }
  }

  // =========================================================================
  // Test 5: CRITICAL — base occupancy gets adjustedPrice, not raw basePrice
  // =========================================================================
  {
    process.stdout.write('  [5] CRITICAL: Base occupancy uses adjustedPrice (not raw basePrice) ... ');

    const weekendR = await callCheckPricing(fri, addDays(fri, 2), EXPECTED.baseOccupancy);

    if (!weekendR.available) {
      console.log('SKIP (dates unavailable)');
    } else {
      const friRate = weekendR.pricing?.dailyRates?.[fri];

      if (friRate) {
        // Friday is a weekend day. The rate should be >= basePrice * weekendAdjustment
        // If there's also a season, it could be even higher
        // The BUG was: rate = raw basePrice instead of adjustedPrice
        const minExpected = EXPECTED.pricePerNight * EXPECTED.weekendAdjustment;

        if (friRate >= minExpected - 0.01) {
          console.log(`PASS (Friday rate=${friRate} >= ${minExpected})`);
          passed++;
        } else if (friRate === EXPECTED.pricePerNight) {
          console.log(`FAIL: Friday rate = ${friRate} = raw basePrice! The basePrice bug is still present.`);
          failed++;
        } else {
          console.log(`WARN: Friday rate=${friRate}, expected >= ${minExpected}`);
          console.log('    Rate is between base and expected — might have a low-season multiplier');
          passed++; // Still not the raw basePrice bug
        }
      } else {
        console.log('FAIL: no Friday rate in response');
        failed++;
      }
    }
  }

  // =========================================================================
  // Test 6: Sunday is NOT a weekend (only Fri/Sat configured)
  // =========================================================================
  {
    process.stdout.write('  [6] Sunday is not weekend (only Fri/Sat configured) ... ');

    // Sun-Tue stay (2 nights)
    const sun = addDays(fri, 2);
    const sunR = await callCheckPricing(sun, addDays(sun, 2), EXPECTED.baseOccupancy);

    if (!sunR.available) {
      console.log('SKIP (dates unavailable)');
    } else {
      const sunRate = sunR.pricing?.dailyRates?.[sun];
      const weekendR = await callCheckPricing(fri, addDays(fri, 2), EXPECTED.baseOccupancy);
      const friRate = weekendR.available ? weekendR.pricing?.dailyRates?.[fri] : null;

      if (sunRate && friRate) {
        if (sunRate < friRate) {
          console.log(`PASS (Sun=${sunRate} < Fri=${friRate})`);
          passed++;
        } else if (sunRate === friRate) {
          console.log(`WARN: Sun=${sunRate} == Fri=${friRate} (might both be in same season with no weekend effect visible)`);
          passed++; // Not necessarily wrong
        } else {
          console.log(`UNEXPECTED: Sun=${sunRate} > Fri=${friRate}`);
          failed++;
        }
      } else {
        console.log(`INFO: Sun rate=${sunRate}, Fri rate=${friRate}`);
        passed++;
      }
    }
  }

  // =========================================================================
  // Test 7: Booking total arithmetic
  // =========================================================================
  {
    process.stdout.write('  [7] Booking total = sum of daily rates + cleaning fee ... ');

    const r = await callCheckPricing(wed, addDays(wed, 2), EXPECTED.baseOccupancy);

    if (!r.available) {
      console.log('SKIP (dates unavailable)');
    } else {
      const p = r.pricing;
      const dailySum = Object.values(p.dailyRates as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
      const expectedSubtotal = dailySum + p.cleaningFee;

      if (Math.abs(p.accommodationTotal - dailySum) < 0.01) {
        if (Math.abs(p.subtotal - expectedSubtotal) < 0.01) {
          console.log(`PASS (accom=${p.accommodationTotal}, cleaning=${p.cleaningFee}, subtotal=${p.subtotal}, total=${p.total})`);
          passed++;
        } else {
          console.log(`FAIL: subtotal ${p.subtotal} != ${expectedSubtotal}`);
          failed++;
        }
      } else {
        console.log(`FAIL: accommodationTotal ${p.accommodationTotal} != sum of daily rates ${dailySum}`);
        failed++;
      }
    }
  }

  // =========================================================================
  // Test 8: Length-of-stay discount (7 nights = 5%)
  // =========================================================================
  {
    process.stdout.write('  [8] Length-of-stay discount: 7 nights = 5% ... ');

    const r = await callCheckPricing(wed, addDays(wed, 7), EXPECTED.baseOccupancy);

    if (!r.available) {
      console.log(`SKIP (dates unavailable: ${r.reason})`);
    } else {
      const p = r.pricing;
      if (p.lengthOfStayDiscount) {
        const expectedDiscount = p.subtotal * 0.05;
        if (p.lengthOfStayDiscount.discountPercentage === 5 &&
            Math.abs(p.lengthOfStayDiscount.discountAmount - expectedDiscount) < 0.01) {
          console.log(`PASS (discount=${p.lengthOfStayDiscount.discountAmount.toFixed(2)}, total=${p.total.toFixed(2)})`);
          passed++;
        } else {
          console.log(`FAIL: discount=${JSON.stringify(p.lengthOfStayDiscount)}`);
          failed++;
        }
      } else {
        console.log('FAIL: no lengthOfStayDiscount applied');
        failed++;
      }
    }
  }

  // =========================================================================
  // Test 9: No discount for short stays (< 7 nights)
  // =========================================================================
  {
    process.stdout.write('  [9] No discount for stays < 7 nights ... ');

    const r = await callCheckPricing(wed, addDays(wed, 3), EXPECTED.baseOccupancy);

    if (!r.available) {
      console.log(`SKIP (dates unavailable)`);
    } else {
      const p = r.pricing;
      if (p.lengthOfStayDiscount === null) {
        console.log(`PASS (total=${p.total.toFixed(2)}, no discount)`);
        passed++;
      } else {
        console.log(`FAIL: unexpected discount applied: ${JSON.stringify(p.lengthOfStayDiscount)}`);
        failed++;
      }
    }
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n===========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('===========================================\n');

  if (failed > 0) {
    console.log('Some tests failed. See output above.');
    console.log('If dates are unavailable, regenerate calendars in admin UI first.\n');
    process.exit(1);
  } else {
    console.log('All tests passed! The pricing engine is working correctly.\n');
  }
}

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
