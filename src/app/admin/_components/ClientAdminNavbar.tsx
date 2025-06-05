'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, Building, Ticket, MessageSquare, CalendarCheck, Sliders } from 'lucide-react';
import { useAuth } from '@/contexts/SimpleAuthContext';

/**
 * Client-side admin navbar component
 */
export function ClientAdminNavbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Handle logout
  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // Check if link is active
  const isActive = (path: string) => {
    return pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and Site Name */}
        <Link href="/admin" className="text-lg font-semibold text-primary flex items-center">
          <LayoutDashboard className="mr-2 h-5 w-5" />
          RentalSpot Admin
        </Link>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <Sliders className="h-5 w-5" />
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-4">
          <Link 
            href="/admin/properties" 
            className={`text-sm hover:underline flex items-center ${isActive('/admin/properties') ? 'font-semibold text-primary' : ''}`}
          >
            <Building className="mr-1 h-4 w-4" /> Properties
          </Link>
          <Link 
            href="/admin/pricing" 
            className={`text-sm hover:underline flex items-center ${isActive('/admin/pricing') ? 'font-semibold text-primary' : ''}`}
          >
            <Sliders className="mr-1 h-4 w-4" /> Pricing
          </Link>
          <Link 
            href="/admin/bookings" 
            className={`text-sm hover:underline flex items-center ${isActive('/admin/bookings') ? 'font-semibold text-primary' : ''}`}
          >
            <CalendarCheck className="mr-1 h-4 w-4" /> Bookings
          </Link>
          <Link 
            href="/admin/coupons" 
            className={`text-sm hover:underline flex items-center ${isActive('/admin/coupons') ? 'font-semibold text-primary' : ''}`}
          >
            <Ticket className="mr-1 h-4 w-4" /> Coupons
          </Link>
          <Link 
            href="/admin/inquiries" 
            className={`text-sm hover:underline flex items-center ${isActive('/admin/inquiries') ? 'font-semibold text-primary' : ''}`}
          >
            <MessageSquare className="mr-1 h-4 w-4" /> Inquiries
          </Link>
          
          {/* Logout Button */}
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </nav>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="absolute top-16 left-0 right-0 bg-background border-b shadow-md md:hidden">
            <div className="container py-4 space-y-2">
              <Link 
                href="/admin/properties" 
                className={`block p-2 hover:bg-muted rounded-md ${isActive('/admin/properties') ? 'bg-muted' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <Building className="inline mr-2 h-4 w-4" /> Properties
              </Link>
              <Link 
                href="/admin/pricing" 
                className={`block p-2 hover:bg-muted rounded-md ${isActive('/admin/pricing') ? 'bg-muted' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <Sliders className="inline mr-2 h-4 w-4" /> Pricing
              </Link>
              <Link 
                href="/admin/bookings" 
                className={`block p-2 hover:bg-muted rounded-md ${isActive('/admin/bookings') ? 'bg-muted' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <CalendarCheck className="inline mr-2 h-4 w-4" /> Bookings
              </Link>
              <Link 
                href="/admin/coupons" 
                className={`block p-2 hover:bg-muted rounded-md ${isActive('/admin/coupons') ? 'bg-muted' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <Ticket className="inline mr-2 h-4 w-4" /> Coupons
              </Link>
              <Link 
                href="/admin/inquiries" 
                className={`block p-2 hover:bg-muted rounded-md ${isActive('/admin/inquiries') ? 'bg-muted' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <MessageSquare className="inline mr-2 h-4 w-4" /> Inquiries
              </Link>
              <Button 
                onClick={handleLogout} 
                variant="outline" 
                className="w-full justify-start mt-4"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}