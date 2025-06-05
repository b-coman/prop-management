#!/usr/bin/env tsx
/**
 * Test script for the availability API endpoint
 * This script tests the availability API with different date ranges and properties
 * 
 * Run with: npx tsx src/scripts/test-availability-api.ts
 */

import fetch from 'node-fetch';
import { addDays, format } from 'date-fns';

const API_BASE_URL = 'http://localhost:9002';
const PROPERTY_SLUGS = ['prahova-mountain-chalet', 'coltei-apartment-bucharest'];

async function testAvailabilityApi() {
  console.log('=== Testing Availability API ===\n');
  
  // Test different date ranges
  const today = new Date();
  const testCases = [
    {
      name: 'Short stay (3 days)',
      checkIn: today,
      checkOut: addDays(today, 3),
    },
    {
      name: 'Medium stay (7 days)',
      checkIn: addDays(today, 10),
      checkOut: addDays(today, 17),
    },
    {
      name: 'Long stay (14 days)',
      checkIn: addDays(today, 30),
      checkOut: addDays(today, 44),
    },
    {
      name: 'Far future dates (3 months ahead)',
      checkIn: addDays(today, 90),
      checkOut: addDays(today, 95),
    },
  ];

  // Run tests for each property and date range
  for (const propertySlug of PROPERTY_SLUGS) {
    console.log(`\nTesting property: ${propertySlug}`);
    console.log('----------------------------');
    
    // First test with no dates - just get all unavailable dates
    console.log('\n1. Testing GET /api/check-availability with just propertySlug');
    try {
      const response = await fetch(`${API_BASE_URL}/api/check-availability?propertySlug=${propertySlug}`);
      const data = await response.json();
      
      console.log(`  Status: ${response.status}`);
      console.log(`  Unavailable dates count: ${data.unavailableDates?.length || 0}`);
      if (data.unavailableDates?.length > 0) {
        console.log(`  First few unavailable dates: ${data.unavailableDates.slice(0, 3).join(', ')} ${data.unavailableDates.length > 3 ? '...' : ''}`);
      }
      console.log(`  Test: ${response.ok ? '✅ PASSED' : '❌ FAILED'}`);
    } catch (error) {
      console.error(`  ❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Test with different date ranges
    for (let i = 0; i < testCases.length; i++) {
      const { name, checkIn, checkOut } = testCases[i];
      const formattedCheckIn = format(checkIn, 'yyyy-MM-dd');
      const formattedCheckOut = format(checkOut, 'yyyy-MM-dd');
      
      console.log(`\n${i + 2}. Testing ${name}`);
      console.log(`  Date range: ${formattedCheckIn} to ${formattedCheckOut}`);
      
      try {
        const url = `${API_BASE_URL}/api/check-availability?propertySlug=${propertySlug}&checkIn=${formattedCheckIn}&checkOut=${formattedCheckOut}`;
        console.log(`  Request URL: ${url}`);
        
        const startTime = performance.now();
        const response = await fetch(url);
        const data = await response.json();
        const requestTime = Math.round(performance.now() - startTime);
        
        console.log(`  Status: ${response.status}`);
        console.log(`  Response time: ${requestTime}ms`);
        console.log(`  Unavailable dates count: ${data.unavailableDates?.length || 0}`);
        if (data.meta) {
          console.log(`  Meta: ${JSON.stringify(data.meta)}`);
        }
        console.log(`  Test: ${response.ok ? '✅ PASSED' : '❌ FAILED'}`);
      } catch (error) {
        console.error(`  ❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  console.log('\n=== Test Summary ===');
  console.log(`Tested ${PROPERTY_SLUGS.length} properties with ${testCases.length} date ranges each`);
  console.log('Done!');
}

// Run the tests
testAvailabilityApi().catch(console.error);