'use client';

import { useLanguage } from '@/hooks/useLanguage';
import { LanguageSelector } from '@/components/language-selector';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Script from 'next/script';

export default function MultilingualTestPage() {
  const { t, tc, currentLang, switchLanguage } = useLanguage();

  // Sample multilingual content
  const sampleContent = {
    en: {
      welcome: 'Welcome to our test page',
      description: 'This page tests the multilingual functionality',
      currentLang: 'Current language',
      switchLang: 'Switch language',
      testButton: 'Test Button'
    },
    ro: {
      welcome: 'Bine ați venit pe pagina noastră de test',
      description: 'Această pagină testează funcționalitatea multilingvă',
      currentLang: 'Limba curentă',
      switchLang: 'Schimbă limba',
      testButton: 'Buton de Test'
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Script src="/browser-test-multilingual.js" strategy="lazyOnload" />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">
          {tc(sampleContent.welcome)}
        </h1>
        <p className="text-lg text-gray-600">
          {tc(sampleContent.description)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Language Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-semibold mb-2">{tc(sampleContent.currentLang)}:</p>
                <p className="text-2xl">{currentLang?.toUpperCase() || 'EN'}</p>
              </div>
              
              <div>
                <p className="font-semibold mb-2">{tc(sampleContent.switchLang)}:</p>
                <LanguageSelector />
              </div>
              
              <div>
                <Button 
                  onClick={() => switchLanguage(currentLang === 'en' ? 'ro' : 'en')}
                  className="w-full"
                >
                  {tc(sampleContent.switchLang)} ({currentLang === 'en' ? 'RO' : 'EN'})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>UI Translation Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-semibold">Common UI Strings:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('common.book_now')}</li>
                  <li>{t('common.check_in')}</li>
                  <li>{t('common.check_out')}</li>
                  <li>{t('common.guests')}</li>
                  <li>{t('booking.total_price')}</li>
                </ul>
              </div>
              
              <div>
                <p className="font-semibold">Navigation:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('navigation.home')}</li>
                  <li>{t('navigation.properties')}</li>
                  <li>{t('navigation.about')}</li>
                  <li>{t('navigation.contact')}</li>
                </ul>
              </div>
              
              <Button className="w-full">
                {tc(sampleContent.testButton)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div id="test-results">
            <p className="text-gray-600">Test results will appear here after page load...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}