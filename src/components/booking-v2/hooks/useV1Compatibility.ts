/**
 * V1 Compatibility Hook for Booking Forms
 * 
 * @file-status: ACTIVE
 * @v2-role: ADAPTER - Provides V1-compatible interface for existing forms
 * @created: 2025-05-31
 * @description: Maps V2 booking context to V1 expected interface to preserve
 *               existing form functionality without modifications
 * @dependencies: V2 BookingContext
 * @migration-note: This hook can be removed once forms are updated to use V2 directly
 */

import { useBooking } from '../contexts';

/**
 * Provides V1-compatible interface for booking forms
 * Maps V2 state structure to V1 expected fields
 */
export function useV1CompatibleBooking() {
  const v2Context = useBooking();
  
  // Return V1-compatible interface
  return {
    // Date fields
    checkInDate: v2Context.checkInDate,
    checkOutDate: v2Context.checkOutDate,
    
    // Guest info fields (flat structure like V1)
    firstName: v2Context.guestInfo.firstName,
    lastName: v2Context.guestInfo.lastName,
    email: v2Context.guestInfo.email,
    phone: v2Context.guestInfo.phone,
    message: v2Context.guestInfo.message || '',
    
    // Pricing (V1 uses pricingDetails)
    pricingDetails: v2Context.pricing,
    
    // Coupon
    appliedCoupon: v2Context.appliedCoupon,
    
    // Setters
    setFirstName: v2Context.setFirstName,
    setLastName: v2Context.setLastName,
    setEmail: v2Context.setEmail,
    setPhone: v2Context.setPhone,
    setMessage: v2Context.setMessage,
    setAppliedCoupon: v2Context.setAppliedCoupon,
    
    // Other V2 fields that might be needed
    property: v2Context.property,
    propertySlug: v2Context.propertySlug,
    guestCount: v2Context.guestCount,
    selectedAction: v2Context.selectedAction
  };
}