# Multilanguage System - Implementation Guide

This document serves as the single source of truth for implementing multilanguage support in RentalSpot-Builder. It outlines the architecture, implementation steps, and technical specifications.

## Overview

The multilanguage system will support English (default) and Romanian for guest-facing property websites. The admin interface remains English-only in this phase.

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
├─────────────────────────────────────────────────────────┤
│  Language Context │ Language Selector │ Translation Hook │
├─────────────────────────────────────────────────────────┤
│                    Routing Layer                         │
├─────────────────────────────────────────────────────────┤
│  Language Detection │ URL Structure │ Route Handling     │
├─────────────────────────────────────────────────────────┤
│                    Data Layer                            │
├─────────────────────────────────────────────────────────┤
│  Firestore (Content) │ JSON Files (UI) │ Template System │
└─────────────────────────────────────────────────────────┘
```

### URL Structure (Multipage)

```
/properties/[slug]                    # English homepage
/properties/[slug]/ro                 # Romanian homepage
/properties/[slug]/details           # English details page
/properties/[slug]/ro/details        # Romanian details page
/properties/[slug]/gallery           # English gallery
/properties/[slug]/ro/gallery        # Romanian gallery
```

### Data Structure

#### 1. Static UI Translations

Location: `/locales/`
```
/locales/
  ├── en.json    # English UI strings
  └── ro.json    # Romanian UI strings
```

Example structure:
```json
{
  "common": {
    "bookNow": "Book Now",
    "checkIn": "Check-in",
    "checkOut": "Check-out",
    "guests": "Guests",
    "nights": "nights",
    "total": "Total"
  },
  "booking": {
    "checkAvailability": "Check Availability",
    "selectDates": "Select your dates",
    "confirmBooking": "Confirm Booking"
  },
  "errors": {
    "required": "This field is required",
    "invalidEmail": "Invalid email address"
  }
}
```

#### 2. Dynamic Content Translations

Property data structure with translations:
```json
{
  "name": {
    "en": "Prahova Mountain Chalet",
    "ro": "Cabana de Munte Prahova"
  },
  "description": {
    "en": "Escape to our charming chalet...",
    "ro": "Evadați la cabana noastră fermecătoare..."
  },
  "shortDescription": {
    "en": "Charming chalet with stunning mountain views",
    "ro": "Cabană fermecătoare cu vederi montane uimitoare"
  },
  "amenities": {
    "en": ["WiFi", "Kitchen", "Parking", "Fireplace"],
    "ro": ["WiFi", "Bucătărie", "Parcare", "Șemineu"]
  },
  "rules": {
    "en": ["No smoking", "No parties", "Respect quiet hours"],
    "ro": ["Fumatul interzis", "Fără petreceri", "Respectați orele de liniște"]
  }
}
```

Property overrides structure:
```json
{
  "homepage": {
    "hero": {
      "title": {
        "en": "Welcome to Paradise",
        "ro": "Bine ați venit în Paradis"
      },
      "subtitle": {
        "en": "Your mountain retreat awaits",
        "ro": "Refugiul tău montan te așteaptă"
      }
    }
  },
  "details": {
    "amenities": {
      "title": {
        "en": "Property Amenities",
        "ro": "Facilități Proprietate"
      }
    }
  }
}
```

## Implementation Components

### 1. Language Hook

```typescript
// src/hooks/useLanguage.ts
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface LanguageHook {
  currentLang: string;
  switchLanguage: (lang: string) => void;
  t: (key: string) => string;
  getLocalizedPath: (path: string, lang?: string) => string;
}

export function useLanguage(): LanguageHook {
  const pathname = usePathname();
  const router = useRouter();
  const [translations, setTranslations] = useState<Record<string, any>>({});
  
  // Extract current language from URL
  const getCurrentLang = (): string => {
    const segments = pathname.split('/');
    const propertyIndex = segments.indexOf('properties');
    
    if (propertyIndex >= 0 && segments[propertyIndex + 2] === 'ro') {
      return 'ro';
    }
    
    return localStorage.getItem('preferredLanguage') || 'en';
  };
  
  const currentLang = getCurrentLang();
  
  // Load translations
  useEffect(() => {
    import(`/locales/${currentLang}.json`)
      .then(module => setTranslations(module.default))
      .catch(() => console.error(`Failed to load ${currentLang} translations`));
  }, [currentLang]);
  
  // Translation function
  const t = (key: string): string => {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };
  
  // Get localized path
  const getLocalizedPath = (path: string, lang?: string): string => {
    const targetLang = lang || currentLang;
    
    if (targetLang === 'en') {
      // Remove language segment if present
      return path.replace(/\/ro(?=\/|$)/, '');
    } else {
      // Add language segment if not present
      const segments = path.split('/');
      const propertyIndex = segments.indexOf('properties');
      
      if (propertyIndex >= 0 && segments[propertyIndex + 1]) {
        if (segments[propertyIndex + 2] !== 'ro') {
          segments.splice(propertyIndex + 2, 0, 'ro');
        }
      }
      
      return segments.join('/');
    }
  };
  
  // Switch language
  const switchLanguage = (lang: string): void => {
    localStorage.setItem('preferredLanguage', lang);
    const newPath = getLocalizedPath(pathname, lang);
    router.push(newPath);
  };
  
  return { currentLang, switchLanguage, t, getLocalizedPath };
}
```

### 2. Language Provider

```typescript
// src/contexts/LanguageContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

interface LanguageContextType {
  currentLang: string;
  switchLanguage: (lang: string) => void;
  t: (key: string) => string;
  tc: (content: any) => string; // Content translation
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLang, setCurrentLang] = useState('en');
  const [translations, setTranslations] = useState<Record<string, any>>({});
  
  // Initialize language
  useEffect(() => {
    const savedLang = localStorage.getItem('preferredLanguage');
    const browserLang = navigator.language.toLowerCase();
    
    if (savedLang && ['en', 'ro'].includes(savedLang)) {
      setCurrentLang(savedLang);
    } else if (browserLang.startsWith('ro')) {
      setCurrentLang('ro');
    }
  }, []);
  
  // Load translations
  useEffect(() => {
    import(`/locales/${currentLang}.json`)
      .then(module => setTranslations(module.default))
      .catch(console.error);
  }, [currentLang]);
  
  // UI translation
  const t = (key: string): string => {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };
  
  // Content translation
  const tc = (content: any): string => {
    if (typeof content === 'object' && content[currentLang]) {
      return content[currentLang];
    }
    if (typeof content === 'object' && content.en) {
      return content.en;
    }
    return content || '';
  };
  
  const switchLanguage = (lang: string): void => {
    setCurrentLang(lang);
    localStorage.setItem('preferredLanguage', lang);
  };
  
  return (
    <LanguageContext.Provider value={{ currentLang, switchLanguage, t, tc }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguageContext = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguageContext must be used within LanguageProvider');
  }
  return context;
};
```

### 3. Language Selector Component

```typescript
// src/components/language-selector.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' }
];

export function LanguageSelector() {
  const { currentLang, switchLanguage } = useLanguage();
  const currentLanguage = languages.find(lang => lang.code === currentLang);
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {currentLanguage?.flag} {currentLanguage?.name}
          </span>
          <span className="sm:hidden">{currentLanguage?.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => switchLanguage(lang.code)}
            className={currentLang === lang.code ? 'bg-accent' : ''}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
            {currentLang === lang.code && (
              <span className="ml-auto">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 4. Property Page with Language Support

```typescript
// src/app/properties/[slug]/[...path]/page.tsx
import { PropertyPageRenderer } from "@/components/property/property-page-renderer";
import { LanguageProvider } from "@/contexts/LanguageContext";

export default async function PropertyMultiPageRoute({ params }) {
  const { slug, path } = params;
  
  // Extract language from path
  let language = 'en';
  let actualPath = path || [];
  
  if (actualPath[0] === 'ro') {
    language = 'ro';
    actualPath = actualPath.slice(1);
  }
  
  // Fetch property data
  const property = await getProperty(slug);
  const template = await getTemplate(property.templateId);
  const overrides = await getPropertyOverrides(slug);
  
  return (
    <LanguageProvider>
      <PropertyPageRenderer
        property={property}
        template={template}
        overrides={overrides}
        pagePath={actualPath.join('/')}
        language={language}
      />
    </LanguageProvider>
  );
}
```

### 5. Update Generic Header for Multipage

```typescript
// src/components/generic-header-multipage.tsx
import { useLanguage } from "@/hooks/useLanguage";
import { LanguageSelector } from "@/components/language-selector";

export function GenericHeaderMultipage({ property, menuItems }) {
  const { currentLang, t, getLocalizedPath } = useLanguage();
  
  return (
    <header className="...">
      <div className="container">
        <nav>
          {menuItems.map((item) => (
            <Link
              key={item.url}
              href={getLocalizedPath(item.url)}
              className="..."
            >
              {item.label[currentLang] || item.label}
            </Link>
          ))}
        </nav>
        
        <div className="flex items-center gap-4">
          <LanguageSelector />
          <CurrencySwitcher />
        </div>
      </div>
    </header>
  );
}
```

## Email Notifications

### Bilingual Email Template

```typescript
// src/services/emailService.ts
interface BilingualEmailTemplate {
  subject: {
    en: string;
    ro: string;
  };
  getBody: (data: any) => string;
}

const emailTemplates: Record<string, BilingualEmailTemplate> = {
  bookingConfirmation: {
    subject: {
      en: "Booking Confirmation",
      ro: "Confirmare Rezervare"
    },
    getBody: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <!-- English Section -->
        <div style="margin-bottom: 30px;">
          <h2 style="color: #333;">Booking Confirmation</h2>
          <p>Dear ${data.guestName},</p>
          <p>Thank you for booking ${data.propertyName.en}. Your reservation is confirmed.</p>
          
          <div style="background: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 8px;">
            <h3>Booking Details:</h3>
            <p><strong>Check-in:</strong> ${data.checkIn}</p>
            <p><strong>Check-out:</strong> ${data.checkOut}</p>
            <p><strong>Guests:</strong> ${data.guestCount}</p>
            <p><strong>Total Price:</strong> ${data.totalPrice}</p>
          </div>
          
          <p>We look forward to welcoming you!</p>
        </div>
        
        <hr style="border: 1px solid #ddd; margin: 30px 0;">
        
        <!-- Romanian Section -->
        <div>
          <h2 style="color: #333;">Confirmare Rezervare</h2>
          <p>Dragă ${data.guestName},</p>
          <p>Vă mulțumim pentru rezervarea la ${data.propertyName.ro}. Rezervarea dumneavoastră este confirmată.</p>
          
          <div style="background: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 8px;">
            <h3>Detalii Rezervare:</h3>
            <p><strong>Check-in:</strong> ${data.checkIn}</p>
            <p><strong>Check-out:</strong> ${data.checkOut}</p>
            <p><strong>Oaspeți:</strong> ${data.guestCount}</p>
            <p><strong>Preț Total:</strong> ${data.totalPrice}</p>
          </div>
          
          <p>Vă așteptăm cu drag!</p>
        </div>
      </div>
    `
  },
  
  holdConfirmation: {
    subject: {
      en: "Booking Hold Confirmation",
      ro: "Confirmare Rezervare Temporară"
    },
    getBody: (data) => `...similar structure...`
  }
};

export async function sendBilingualEmail(
  templateName: string,
  recipientEmail: string,
  data: any
) {
  const template = emailTemplates[templateName];
  if (!template) {
    throw new Error(`Email template ${templateName} not found`);
  }
  
  const subject = `${template.subject.en} / ${template.subject.ro}`;
  const html = template.getBody(data);
  
  // Send email using your email service
  return await sendEmail({
    to: recipientEmail,
    subject,
    html
  });
}
```

## Migration Steps

### Phase 1: Core Infrastructure
1. Create `/locales` directory with `en.json` and `ro.json`
2. Implement `useLanguage` hook
3. Create `LanguageProvider` context
4. Build `LanguageSelector` component

### Phase 2: Update Routing
1. Modify multipage catch-all route to handle language segments
2. Update middleware for language detection
3. Implement URL generation helpers

### Phase 3: Update Components
1. Update `GenericHeaderMultipage` with language support
2. Update `PropertyPageRenderer` to pass language context
3. Modify block components to accept and use translations

### Phase 4: Update Data
1. Convert property data to multilingual format
2. Update property overrides with translations
3. Modify template menu items to support languages

### Phase 5: Email Templates
1. Create bilingual email templates
2. Update email service to send bilingual emails
3. Test all notification types

## Testing Checklist

### Functional Testing
- [ ] Language detection from browser works correctly
- [ ] Language selector changes URL appropriately
- [ ] Language preference persists across sessions
- [ ] All text content switches languages correctly
- [ ] Menu items update with language change
- [ ] Email notifications show both languages

### URL Testing
- [ ] English URLs work without language segment
- [ ] Romanian URLs include `/ro` segment correctly
- [ ] Language switching maintains current page
- [ ] Direct URL access respects language segment

### Edge Cases
- [ ] Missing translations fall back to English
- [ ] Invalid language codes are handled gracefully
- [ ] Mixed content (some translated, some not) displays correctly
- [ ] Browser back/forward maintains language state

## Performance Considerations

1. **Translation Loading**: 
   - Load JSON files once and cache
   - Use dynamic imports for language files
   - Minimize translation file sizes

2. **Route Optimization**:
   - Avoid unnecessary re-renders on language change
   - Use shallow routing when possible
   - Cache translated content

3. **SEO Optimization**:
   - Add hreflang tags for language alternatives
   - Ensure proper canonical URLs
   - Create language-specific sitemaps

## Future Enhancements

1. **Admin Interface Translation** (Phase 2)
2. **Additional Languages** (Phase 3)
3. **Translation Management System** (Phase 4)
4. **Regional Variations** (Phase 5)
5. **AI-Powered Translation Suggestions** (Phase 6)

## Troubleshooting Guide

### Common Issues

1. **Language not switching**:
   - Check localStorage for saved preference
   - Verify URL structure is correct
   - Ensure router navigation is working

2. **Missing translations**:
   - Verify JSON files are loaded
   - Check translation key paths
   - Ensure fallback mechanism works

3. **URL problems**:
   - Check middleware logic
   - Verify route parameters
   - Test with different URL patterns

## Code Standards

1. Always use translation keys for UI text
2. Keep translation keys organized and hierarchical
3. Provide English fallbacks for all content
4. Test with both languages before committing
5. Document any language-specific logic

This document will be updated as implementation progresses and new requirements emerge.