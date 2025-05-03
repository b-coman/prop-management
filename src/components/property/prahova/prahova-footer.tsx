import Link from 'next/link';

export function PrahovaFooter() {
  return (
    <footer className="border-t bg-gray-100">
      <div className="container py-8 text-center text-sm text-gray-500 md:flex md:items-center md:justify-between md:py-10">
        <p>&copy; {new Date().getFullYear()} Prahova Mountain Chalet. All rights reserved.</p>
        {/* Optional: Add specific links for Prahova */}
        <nav className="mt-4 flex justify-center gap-4 md:mt-0">
          <Link href="/properties/prahova-mountain-chalet#contact" className="hover:text-gray-800">
            Contact Us
          </Link>
           {/* <Link href="/terms-prahova" className="hover:text-gray-800">
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
