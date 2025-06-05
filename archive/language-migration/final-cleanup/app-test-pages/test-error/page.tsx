"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function TestErrorPage() {
  return (
    <div className="p-10">
      <h1>Testing the Error</h1>
      <p>If you see this page, the error is isolated elsewhere.</p>
      
      {/* This is the pattern that causes the error */}
      <Link href="/test">
        <Button>This should cause error</Button>
      </Link>
    </div>
  );
}