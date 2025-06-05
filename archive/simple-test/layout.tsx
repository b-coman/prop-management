/**
 * @fileoverview Test layout for simple authentication
 * @module app/simple-test/layout
 * 
 * @description
 * Test layout that only includes the new simple authentication.
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/SimpleAuthContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'RentalSpot Admin - Simple Auth Test',
  description: 'Testing the new simple authentication system',
};

export default function SimpleTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}