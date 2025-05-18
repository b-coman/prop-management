"use client";

import { Header } from '@/components/generic-header';
import { useLanguage } from '@/hooks/useLanguage';

interface ClientHeaderProps {
  propertyName: any; // Can be string or multilingual object
  propertySlug: string;
  menuItems?: Array<{label: string; href: string}>;
  logoSrc?: string;
  logoAlt?: string;
}

export function ClientHeader({ 
  propertyName, 
  propertySlug,
  menuItems,
  logoSrc,
  logoAlt
}: ClientHeaderProps) {
  const { tc } = useLanguage();
  
  // Translate property name if it's a multilingual object
  const translatedName = typeof propertyName === 'string' 
    ? propertyName 
    : tc(propertyName);

  return (
    <Header
      propertyName={translatedName}
      propertySlug={propertySlug}
      menuItems={menuItems}
      logoSrc={logoSrc}
      logoAlt={logoAlt}
    />
  );
}