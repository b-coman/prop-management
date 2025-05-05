import type { Metadata } from 'next';
// Removed geist/font import: import { Geist_Sans, Geist_Mono } from 'geist/font'; // Correct Geist import
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster

// If using Circular font, ensure it's loaded via @font-face in globals.css
// or using next/font if available through a provider.
// Example with next/font (replace with actual loading method):
// import localFont from 'next/font/local'
// const circular = localFont({
//   src: [
//     { path: '../fonts/CircularStd-Book.woff2', weight: '400', style: 'normal' },
//     { path: '../fonts/CircularStd-Medium.woff2', weight: '500', style: 'normal' },
//     { path: '../fonts/CircularStd-Bold.woff2', weight: '700', style: 'normal' },
//   ],
//   variable: '--font-circular',
// })

// Assuming Circular font is loaded elsewhere or using fallback system fonts
// const fontVariables = circular ? circular.variable : ''; // Adjust based on actual font loading

export const metadata: Metadata = {
  title: 'RentalSpot - Your Vacation Getaway', // More specific title
  description: 'Book unique vacation rentals like the Prahova Mountain Chalet and Coltei Apartment Bucharest.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Apply font variables. If using Circular, add fontVariables here */}
      <body className={`antialiased`}> {/* Removed Geist font variables */}
        {/* Header is removed, will be added in page layouts */}
        {children}
        <Toaster /> {/* Add Toaster here */}
      </body>
    </html>
  );
}
