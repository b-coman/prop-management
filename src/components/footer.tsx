
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram, Twitter } from 'lucide-react'; // Add social icons

export function Footer() {
  return (
    <footer className="border-t bg-muted/50 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Quick Links</h4>
            <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Home</Link>
              <Link href="#experience" className="hover:text-foreground">Experience</Link> {/* Assuming section IDs */}
              <Link href="#features" className="hover:text-foreground">Features</Link>
              <Link href="#location" className="hover:text-foreground">Location</Link>
              <Link href="#testimonials" className="hover:text-foreground">Reviews</Link>
            </nav>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Contact Us</h4>
            <address className="not-italic text-sm text-muted-foreground space-y-1">
              {/* Add actual contact info or link */}
              <p>info@prahovachalet.com</p> {/* Placeholder */}
              <p>+40 123 456 789</p> {/* Placeholder */}
              <p>Comarnic, Prahova, Romania</p> {/* Placeholder */}
            </address>
          </div>

           {/* Social Media */}
           <div>
             <h4 className="font-semibold mb-4 text-foreground">Follow Us</h4>
             <div className="flex gap-4 text-muted-foreground">
               <a href="#" target="_blank" rel="noopener noreferrer" className="hover:text-primary"><Facebook size={20} /></a>
               <a href="#" target="_blank" rel="noopener noreferrer" className="hover:text-primary"><Instagram size={20} /></a>
               <a href="#" target="_blank" rel="noopener noreferrer" className="hover:text-primary"><Twitter size={20} /></a>
             </div>
           </div>

           {/* Newsletter Signup */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Stay Updated</h4>
            <p className="text-sm text-muted-foreground mb-3">Get special offers and updates.</p>
            <form className="flex gap-2">
              <Input type="email" placeholder="Enter your email" className="bg-background" />
              <Button type="submit" variant="secondary" size="sm">Subscribe</Button>
            </form>
          </div>
        </div>

        <div className="border-t border-border pt-8 text-center text-xs text-muted-foreground md:flex md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} Prahova Mountain Chalet. All rights reserved.</p> {/* Update name */}
          <nav className="mt-4 flex justify-center gap-4 md:mt-0">
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link> {/* Add links if needed */}
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
