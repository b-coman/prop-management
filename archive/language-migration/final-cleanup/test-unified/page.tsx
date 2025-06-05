'use client';

import { useLanguage } from '@/hooks/useLanguage';
import { useEffect, useState } from 'react';

export default function TestUnifiedPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const language = useLanguage();
  
  useEffect(() => {
    const results: string[] = [];
    
    // Test 1: Check if all methods exist
    results.push(`✅ currentLang exists: ${typeof language.currentLang === 'string'}`);
    results.push(`✅ currentLanguage exists: ${typeof language.currentLanguage === 'string'}`);
    results.push(`✅ t function exists: ${typeof language.t === 'function'}`);
    results.push(`✅ tc function exists: ${typeof language.tc === 'function'}`);
    results.push(`✅ switchLanguage exists: ${typeof language.switchLanguage === 'function'}`);
    results.push(`✅ changeLanguage exists: ${typeof language.changeLanguage === 'function'}`);
    results.push(`✅ getLocalizedPath exists: ${typeof language.getLocalizedPath === 'function'}`);
    results.push(`✅ isLanguageSupported exists: ${typeof language.isLanguageSupported === 'function'}`);
    
    // Test 2: Check current language
    results.push(`\nCurrent Language: ${language.currentLang}`);
    results.push(`Current Language (alias): ${language.currentLanguage}`);
    
    // Test 3: Test translation function
    try {
      const translation = language.t('common.hello');
      results.push(`\nTranslation test: ${translation}`);
    } catch (error) {
      results.push(`❌ Translation error: ${(error as Error).message}`);
    }
    
    // Test 4: Test content translation
    try {
      const content = { en: 'Hello', ro: 'Salut' };
      const result = language.tc(content);
      results.push(`Content translation: ${result}`);
    } catch (error) {
      results.push(`❌ Content translation error: ${(error as Error).message}`);
    }
    
    // Test 5: Test language support check
    results.push(`\nIs 'en' supported: ${language.isLanguageSupported('en')}`);
    results.push(`Is 'ro' supported: ${language.isLanguageSupported('ro')}`);
    results.push(`Is 'fr' supported: ${language.isLanguageSupported('fr')}`);
    
    // Test 6: Test localized path
    try {
      const path = language.getLocalizedPath('/properties/test-property');
      results.push(`\nLocalized path: ${path}`);
    } catch (error) {
      results.push(`❌ Localized path error: ${(error as Error).message}`);
    }
    
    setTestResults(results);
  }, [language]);
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Unified Language System Test</h1>
      <div className="bg-gray-100 p-4 rounded">
        <pre className="whitespace-pre-wrap">
          {testResults.join('\n')}
        </pre>
      </div>
      
      <div className="mt-4">
        <h2 className="text-xl font-semibold mb-2">Language Switch Test</h2>
        <button 
          onClick={() => language.switchLanguage('en')}
          className="mr-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Switch to EN
        </button>
        <button 
          onClick={() => language.switchLanguage('ro')}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Switch to RO
        </button>
      </div>
    </div>
  );
}