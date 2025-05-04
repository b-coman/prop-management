
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-8 text-center text-sm text-muted-foreground md:flex md:items-center md:justify-between md:py-10">
        <p>&copy; {new Date().getFullYear()} RentalSpot. All rights reserved.</p>
        <nav className="mt-4 flex justify-center gap-4 md:mt-0">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          {/* Add other relevant global links */}
          {/* <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link> */}
           <Link href="#contact" className="hover:text-foreground"> {/* Assuming a contact section exists on most pages */}
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
