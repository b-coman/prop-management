import Link from 'next/link';

export function ColteiFooter() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="container py-8 text-center text-sm text-gray-500 md:flex md:items-center md:justify-between md:py-10">
        <p>&copy; {new Date().getFullYear()} Coltei Apartment Bucharest. All rights reserved.</p>
        {/* Optional: Add specific links for Coltei */}
        <nav className="mt-4 flex justify-center gap-4 md:mt-0">
          <Link href="/properties/coltei-apartment-bucharest#contact" className="hover:text-gray-800">
            Contact Us
          </Link>
           {/* <Link href="/terms-coltei" className="hover:text-gray-800">
            Terms
          </Link> */}
           <Link href="/" className="hover:text-gray-800">
             Main Site
           </Link>
        </nav>
      </div>
    </footer>
  );
}
