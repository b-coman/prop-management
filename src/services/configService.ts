// src/services/configService.ts
'use server'; // Mark as server-only if fetching logic could potentially run server-side, though CurrencyContext runs client-side

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Client SDK Firestore instance
import type { ExchangeRates } from '@/contexts/CurrencyContext'; // Import type

/**
 * Fetches the currency exchange rates from the 'appConfig/currencyRates' document in Firestore.
 *
 * @returns A promise that resolves to the ExchangeRates object or null if not found or invalid.
 */
export async function getCurrencyRates(): Promise<ExchangeRates | null> {
  console.log("[ConfigService] Attempting to fetch currency rates from Firestore...");
  const ratesDocRef = doc(db, 'appConfig', 'currencyRates');
  try {
    const docSnap = await getDoc(ratesDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Validate the structure basic check
      if (data && typeof data.rates === 'object' && data.rates !== null && data.rates.USD === 1) {
        console.log("[ConfigService] Successfully fetched and validated rates.");
        return data.rates as ExchangeRates;
      } else {
        console.warn("[ConfigService] Fetched 'currencyRates' document exists but has invalid data format or USD rate is not 1:", data);
        return null;
      }
    } else {
      console.warn("[ConfigService] Document 'appConfig/currencyRates' does not exist.");
      return null;
    }
  } catch (error) {
    console.error("❌ [ConfigService] Error fetching currency rates:", error);
    // Depending on requirements, you might want to re-throw or return null/default
    return null;
  }
}
