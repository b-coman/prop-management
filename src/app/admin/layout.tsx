
import { Header } from '@/components/header'; // Or an admin-specific header
// Removed Footer import: import { Footer } from '@/components/footer'; // Or an admin-specific footer
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Consider an Admin specific header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
            <Link href="/admin" className="text-lg font-semibold text-primary">Admin Panel</Link>
             <nav>
                {/* Add admin navigation links here */}
                <Link href="/admin/coupons/new" className="mr-4 text-sm hover:underline">Create Coupon</Link>
                {/* <Link href="/admin/bookings" className="mr-4 text-sm hover:underline">View Bookings</Link> */}
                {/* <Link href="/admin/properties" className="text-sm hover:underline">Manage Properties</Link> */}
             </nav>
        </div>
      </header>

      <main className="flex-grow">{children}</main>

      {/* Removed Footer usage */}
      {/* <Footer /> */}

      {/* Optional: Add a simple inline footer for the admin section */}
       <footer className="border-t bg-muted/50">
         <div className="container py-4 text-center text-xs text-muted-foreground">
           RentalSpot Admin Panel &copy; {new Date().getFullYear()}
         </div>
       </footer>
    </div>
  );
}
