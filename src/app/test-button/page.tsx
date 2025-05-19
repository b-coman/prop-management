"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function TestButtonPage() {
  return (
    <div className="p-10">
      <h1>Button Test Page</h1>
      
      <div className="space-y-4">
        {/* Standard button */}
        <div>
          <h2>Standard Button</h2>
          <Button>Click me</Button>
        </div>
        
        {/* Button with Link - WRONG way */}
        <div>
          <h2>Button with Link - Wrong Way</h2>
          <Link href="/test">
            <Button>Wrong Link</Button>
          </Link>
        </div>
        
        {/* Button with Link - RIGHT way */}
        <div>
          <h2>Button with Link - Right Way</h2>
          <Button asChild>
            <Link href="/test">Right Link</Link>
          </Button>
        </div>
        
        {/* Button with disabled state */}
        <div>
          <h2>Disabled Button</h2>
          <Button disabled>Disabled</Button>
        </div>
      </div>
    </div>
  );
}