import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-secondary">
      <div className="container py-8 text-center text-sm text-muted-foreground md:flex md:items-center md:justify-between md:py-12">
        <p>&copy; {new Date().getFullYear()} RentalSpot. All rights reserved.</p>
        <nav className="mt-4 flex justify-center gap-4 md:mt-0">
          <Link href="/privacy-policy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            Contact Us
          </Link>
        </nav>
      </div>
    </footer>
  );
}
