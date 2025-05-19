import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Import Inter font
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider
import { OptimizedCurrencyProvider } from '@/contexts/OptimizedCurrencyContext'; // Import OptimizedCurrencyProvider
import { ThemeProvider } from '@/contexts/ThemeContext'; // Import ThemeProvider
import { ErrorBoundary } from '@/components/error-boundary'; // Import ErrorBoundary
import TestScriptLoader from '@/components/debug/TestScriptLoader'; // Import TestScriptLoader

// Instantiate the Inter font
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter', // Define CSS variable
});

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
      {/* Apply font variable to body */}
      <body className={`${inter.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <AuthProvider> {/* Wrap children with AuthProvider */}
            <OptimizedCurrencyProvider> {/* Wrap with OptimizedCurrencyProvider */}
              <ThemeProvider> {/* Wrap with ThemeProvider */}
                {children}
                <Toaster /> {/* Add Toaster here */}
                <TestScriptLoader /> {/* Add script loader for test mode */}
              </ThemeProvider>
            </OptimizedCurrencyProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}