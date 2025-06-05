import { NextRequest, NextResponse } from 'next/server';
import { globalTranslationCache } from '@/lib/language-system/translation-cache';

export async function GET(request: NextRequest) {
  try {
    // Test loading Romanian translations
    const roTranslations = await globalTranslationCache.getTranslations('ro');
    const enTranslations = await globalTranslationCache.getTranslations('en');
    
    const stats = globalTranslationCache.getStats();
    
    return NextResponse.json({
      success: true,
      romanianLoaded: !!roTranslations.content,
      englishLoaded: !!enTranslations.content,
      romanianFromCache: roTranslations.fromCache,
      englishFromCache: enTranslations.fromCache,
      stats,
      romanianSampleKeys: Object.keys(roTranslations.content).slice(0, 5),
      romanianBookingKeys: roTranslations.content.booking ? Object.keys(roTranslations.content.booking).slice(0, 10) : 'NO_BOOKING_SECTION',
      romanianBookingSelectYourDates: roTranslations.content.booking?.selectYourDates || 'KEY_NOT_FOUND',
      englishBookingSelectYourDates: enTranslations.content.booking?.selectYourDates || 'KEY_NOT_FOUND'
    }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}