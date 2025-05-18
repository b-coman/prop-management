'use client';

// This file provides direct data loading from JSON files for testing the pricing UI
// without requiring Firestore. This is useful during development or when Firestore
// connection fails.

import { Property } from './client-props';

export type SeasonalPricing = {
  id: string;
  propertyId: string;
  name: string;
  seasonType: 'minimum' | 'low' | 'standard' | 'medium' | 'high';
  startDate: string;
  endDate: string;
  priceMultiplier: number;
  minimumStay?: number;
  enabled: boolean;
};

export type DateOverride = {
  id: string;
  propertyId: string;
  date: string;
  customPrice: number;
  reason?: string;
  minimumStay?: number;
  available: boolean;
  flatRate: boolean;
};

// Sample property data
export const sampleProperties: Property[] = [
  {
    id: 'prahova-mountain-chalet',
    name: 'Prahova Mountain Chalet [Local]',
    location: 'Comarnic, Romania',
    status: 'active'
  },
  {
    id: 'coltei-apartment-bucharest',
    name: 'Coltei Apartment Bucharest [Local]',
    location: 'Bucharest, Romania',
    status: 'active'
  }
];

// Sample seasonal pricing data
export const sampleSeasonalPricing: Record<string, SeasonalPricing[]> = {
  'prahova-mountain-chalet': [
    {
      id: 'winter-season-2023',
      propertyId: 'prahova-mountain-chalet',
      name: 'Winter Season 2023',
      seasonType: 'high',
      startDate: '2023-12-01',
      endDate: '2024-02-28',
      priceMultiplier: 1.5,
      minimumStay: 3,
      enabled: true
    },
    {
      id: 'summer-season-2024',
      propertyId: 'prahova-mountain-chalet',
      name: 'Summer Season 2024',
      seasonType: 'medium',
      startDate: '2024-06-01',
      endDate: '2024-08-31',
      priceMultiplier: 1.3,
      minimumStay: 2,
      enabled: true
    }
  ],
  'coltei-apartment-bucharest': [
    {
      id: 'summer-season-2023',
      propertyId: 'coltei-apartment-bucharest',
      name: 'Summer 2023',
      seasonType: 'high',
      startDate: '2023-06-01',
      endDate: '2023-08-31',
      priceMultiplier: 1.3,
      minimumStay: 2,
      enabled: true
    }
  ]
};

// Sample date overrides data
export const sampleDateOverrides: Record<string, DateOverride[]> = {
  'prahova-mountain-chalet': [
    {
      id: 'christmas-2023',
      propertyId: 'prahova-mountain-chalet',
      date: '2023-12-25',
      customPrice: 220,
      reason: 'Christmas Day',
      minimumStay: 3,
      available: true,
      flatRate: true
    },
    {
      id: 'new-years-eve-2023',
      propertyId: 'prahova-mountain-chalet',
      date: '2023-12-31',
      customPrice: 250,
      reason: 'New Year\'s Eve',
      minimumStay: 3,
      available: true,
      flatRate: true
    }
  ],
  'coltei-apartment-bucharest': [
    {
      id: 'national-day-2023',
      propertyId: 'coltei-apartment-bucharest',
      date: '2023-12-01',
      customPrice: 180,
      reason: 'National Day',
      minimumStay: 2,
      available: true,
      flatRate: true
    }
  ]
};

// Helper hooks for accessing the sample data
export function useDirectProperties() {
  return {
    properties: sampleProperties,
    loading: false,
    error: null
  };
}

export function useDirectSeasonalPricing(propertyId: string) {
  const seasons = sampleSeasonalPricing[propertyId] || [];
  return {
    seasons,
    loading: false,
    error: null
  };
}

export function useDirectDateOverrides(propertyId: string) {
  const overrides = sampleDateOverrides[propertyId] || [];
  return {
    overrides,
    loading: false,
    error: null
  };
}