'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Copies the guest guide link for one booking. The link is built server-side (it
 * needs the HMAC secret) and already carries the property's own domain. Only if
 * that property has no custom domain does it arrive relative, in which case the
 * current host is the best guess available.
 */
export function CopyGuideLink({ url: link }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const url =
    link.startsWith('http') || typeof window === 'undefined'
      ? link
      : `${window.location.origin}${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy the guest guide link:', url);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy guide link'}
      </Button>
      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
          Preview
        </a>
      </Button>
    </div>
  );
}
