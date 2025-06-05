import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Import and test the unified system components
    const languageSystem = await import('@/lib/language-system');
    const legacyHook = await import('@/hooks/useLanguage');
    
    const results = {
      unifiedSystemImport: !!languageSystem,
      legacyHookImport: !!legacyHook,
      unifiedExports: Object.keys(languageSystem),
      hasUseLanguage: typeof languageSystem.useLanguage === 'function',
      hasLanguageProvider: !!languageSystem.LanguageProvider,
      supportedLanguages: languageSystem.SUPPORTED_LANGUAGES || ['en', 'ro'],
      defaultLanguage: languageSystem.DEFAULT_LANGUAGE || 'en'
    };
    
    return NextResponse.json({
      status: 'success',
      message: 'Unified language system is operational',
      results
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to test unified system',
      error: (error as Error).message
    }, { status: 500 });
  }
}