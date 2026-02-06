"use client";

import Link from 'next/link';
import { Facebook, Instagram, Twitter } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

const socialIcons: Record<string, React.FC<{ size?: string | number }>> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
};

interface FooterProps {
  quickLinks?: Array<{ label: string | Record<string, string>; url: string }>;
  contactInfo?: { email?: string; phone?: string };
  socialLinks?: Array<{ platform: string; url: string }>;
  propertyName?: string;
  propertySlug?: string;
}

export function Footer({
  quickLinks,
  contactInfo,
  socialLinks,
  propertyName,
  propertySlug,
}: FooterProps) {
  const { t, tc, getLocalizedPath } = useLanguage();

  const basePath = propertySlug ? `/properties/${propertySlug}` : '';

  const resolveUrl = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return getLocalizedPath(`${basePath}${url}`);
  };

  const hasQuickLinks = quickLinks && quickLinks.length > 0;
  const hasContact = contactInfo && (contactInfo.email || contactInfo.phone);
  const hasSocial = socialLinks && socialLinks.length > 0;

  return (
    <footer className="border-t bg-muted/50 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Quick Links */}
          {hasQuickLinks && (
            <div>
              <h4 className="font-semibold mb-4 text-foreground">
                {t('footer.quickLinks', 'Quick Links')}
              </h4>
              <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                {quickLinks.map((link, i) => (
                  <Link key={i} href={resolveUrl(link.url)} className="hover:text-foreground">
                    {tc(link.label)}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* Contact Info */}
          {hasContact && (
            <div>
              <h4 className="font-semibold mb-4 text-foreground">
                {t('footer.contact', 'Contact Us')}
              </h4>
              <address className="not-italic text-sm text-muted-foreground space-y-1">
                {contactInfo.email && <p>{contactInfo.email}</p>}
                {contactInfo.phone && <p>{contactInfo.phone}</p>}
              </address>
            </div>
          )}

          {/* Social Media */}
          {hasSocial && (
            <div>
              <h4 className="font-semibold mb-4 text-foreground">
                {t('footer.social', 'Follow Us')}
              </h4>
              <div className="flex gap-4 text-muted-foreground">
                {socialLinks.map((link, i) => {
                  const Icon = socialIcons[link.platform.toLowerCase()];
                  if (!Icon) return null;
                  return (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary"
                    >
                      <Icon size={20} />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border pt-8 text-center text-xs text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} {propertyName || 'RentalSpot'}.{' '}
            {t('footer.rights', 'All rights reserved.')}
          </p>
        </div>
      </div>
    </footer>
  );
}
