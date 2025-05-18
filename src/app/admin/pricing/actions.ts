'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

/**
 * Create a new seasonal pricing rule
 */
export async function createSeasonalPricing(formData: FormData) {
  try {
    const propertyId = formData.get('propertyId') as string;
    const name = formData.get('name') as string;
    const seasonType = formData.get('seasonType') as 'minimum' | 'low' | 'standard' | 'medium' | 'high';
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const priceMultiplierValue = formData.get('priceMultiplier') as string;
    const minimumStayValue = formData.get('minimumStay') as string;

    // Validate input
    if (!propertyId || !name || !seasonType || !startDate || !endDate) {
      throw new Error('Missing required fields');
    }

    const priceMultiplier = parseFloat(priceMultiplierValue) || 1.0;
    const minimumStay = parseInt(minimumStayValue, 10) || 1;

    // Create the seasonal pricing object
    const seasonalPricing = {
      propertyId,
      name,
      seasonType,
      startDate,
      endDate,
      priceMultiplier,
      minimumStay,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to Firestore
    await addDoc(collection(db, 'seasonalPricing'), seasonalPricing);
    
    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
    
    // Redirect back to the pricing page
    redirect(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    console.error('[Server] Error creating seasonal pricing:', error);
    throw new Error(`Failed to create seasonal pricing: ${error}`);
  }
}

/**
 * Update an existing seasonal pricing rule
 */
export async function updateSeasonalPricing(formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const propertyId = formData.get('propertyId') as string;
    const name = formData.get('name') as string;
    const seasonType = formData.get('seasonType') as 'minimum' | 'low' | 'standard' | 'medium' | 'high';
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const priceMultiplierValue = formData.get('priceMultiplier') as string;
    const minimumStayValue = formData.get('minimumStay') as string;
    const enabledValue = formData.get('enabled') as string;

    // Validate input
    if (!id || !propertyId || !name || !seasonType || !startDate || !endDate) {
      throw new Error('Missing required fields');
    }

    const priceMultiplier = parseFloat(priceMultiplierValue) || 1.0;
    const minimumStay = parseInt(minimumStayValue, 10) || 1;
    const enabled = enabledValue === 'true';

    // Create the update object
    const updatedSeason = {
      propertyId,
      name,
      seasonType,
      startDate,
      endDate,
      priceMultiplier,
      minimumStay,
      enabled,
      updatedAt: new Date().toISOString()
    };

    // Update in Firestore
    const seasonRef = doc(db, 'seasonalPricing', id);
    await updateDoc(seasonRef, updatedSeason);
    
    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
    
    // Redirect back to the pricing page
    redirect(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    console.error('[Server] Error updating seasonal pricing:', error);
    throw new Error(`Failed to update seasonal pricing: ${error}`);
  }
}

/**
 * Create a new date override
 */
export async function createDateOverride(formData: FormData) {
  try {
    const propertyId = formData.get('propertyId') as string;
    const date = formData.get('date') as string;
    const customPriceValue = formData.get('customPrice') as string;
    const reason = formData.get('reason') as string;
    const minimumStayValue = formData.get('minimumStay') as string;
    const availableValue = formData.get('available') as string;
    const flatRateValue = formData.get('flatRate') as string;

    // Validate input
    if (!propertyId || !date || !customPriceValue) {
      throw new Error('Missing required fields');
    }

    const customPrice = parseFloat(customPriceValue);
    const minimumStay = parseInt(minimumStayValue, 10) || 1;
    const available = availableValue !== 'false';
    const flatRate = flatRateValue === 'true';

    // Create the date override object
    const dateOverride = {
      propertyId,
      date,
      customPrice,
      reason: reason || '',
      minimumStay,
      available,
      flatRate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to Firestore
    await addDoc(collection(db, 'dateOverrides'), dateOverride);
    
    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
    
    // Redirect back to the pricing page
    redirect(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    console.error('[Server] Error creating date override:', error);
    throw new Error(`Failed to create date override: ${error}`);
  }
}

/**
 * Update an existing date override
 */
export async function updateDateOverride(formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const propertyId = formData.get('propertyId') as string;
    const date = formData.get('date') as string;
    const customPriceValue = formData.get('customPrice') as string;
    const reason = formData.get('reason') as string;
    const minimumStayValue = formData.get('minimumStay') as string;
    const availableValue = formData.get('available') as string;
    const flatRateValue = formData.get('flatRate') as string;

    // Validate input
    if (!id || !propertyId || !date || !customPriceValue) {
      throw new Error('Missing required fields');
    }

    const customPrice = parseFloat(customPriceValue);
    const minimumStay = parseInt(minimumStayValue, 10) || 1;
    const available = availableValue === 'true';
    const flatRate = flatRateValue === 'true';

    // Create the update object
    const updatedOverride = {
      propertyId,
      date,
      customPrice,
      reason: reason || '',
      minimumStay,
      available,
      flatRate,
      updatedAt: new Date().toISOString()
    };

    // Update in Firestore
    const overrideRef = doc(db, 'dateOverrides', id);
    await updateDoc(overrideRef, updatedOverride);
    
    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
    
    // Redirect back to the pricing page
    redirect(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    console.error('[Server] Error updating date override:', error);
    throw new Error(`Failed to update date override: ${error}`);
  }
}

/**
 * Delete a seasonal pricing rule
 */
export async function deleteSeasonalPricing(formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const propertyId = formData.get('propertyId') as string;

    // Validate input
    if (!id || !propertyId) {
      throw new Error('Missing required fields');
    }

    // Delete from Firestore
    const seasonRef = doc(db, 'seasonalPricing', id);
    await deleteDoc(seasonRef);
    
    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
    
    // Redirect back to the pricing page
    redirect(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    console.error('[Server] Error deleting seasonal pricing:', error);
    throw new Error(`Failed to delete seasonal pricing: ${error}`);
  }
}

/**
 * Delete a date override
 */
export async function deleteDateOverride(formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const propertyId = formData.get('propertyId') as string;

    // Validate input
    if (!id || !propertyId) {
      throw new Error('Missing required fields');
    }

    // Delete from Firestore
    const overrideRef = doc(db, 'dateOverrides', id);
    await deleteDoc(overrideRef);
    
    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
    
    // Redirect back to the pricing page
    redirect(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    console.error('[Server] Error deleting date override:', error);
    throw new Error(`Failed to delete date override: ${error}`);
  }
}