"use client";

import Image from 'next/image';
import { User } from 'lucide-react'; // Import a fallback icon
import { useLanguage } from '@/hooks/useLanguage';

interface HostInfo {
  name: string | any; // Could be multilingual
  imageUrl?: string | null; // Make optional
  description?: string | any; // Alternative to welcomeMessage
  welcomeMessage?: string | any;
  backstory: string | any;
  'data-ai-hint'?: string;
}

interface HostIntroductionProps {
  content: HostInfo; // Use the common property name used in the renderer
}

export function HostIntroduction({ content }: HostIntroductionProps) {
  const { t, tc } = useLanguage();
  
  // Don't render if required host info is missing
  if (!content || !content.name || !content.backstory) {
    return null;
  }

  // Get the welcome message (support both field names)
  const welcomeMessage = content.welcomeMessage || content.description || "";

  return (
    <section className="py-10 md:py-16 bg-background" id="host"> {/* Added ID */}
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 max-w-4xl mx-auto">
          {/* Host Photo */}
          <div className="flex-shrink-0 w-40 h-40 md:w-48 md:h-48 relative rounded-full overflow-hidden shadow-lg border-4 border-primary/20 bg-muted">
            {content.imageUrl ? (
              <Image
                src={content.imageUrl}
                alt={`Photo of host, ${content.name}`}
                fill
                style={{ objectFit: 'cover' }}
                className="rounded-full"
                data-ai-hint={content['data-ai-hint'] || 'host portrait friendly'}
              />
            ) : (
              <div className="flex items-center justify-center h-full w-full">
                <User className="h-20 w-20 text-muted-foreground/50" /> {/* Fallback Icon */}
              </div>
            )}
          </div>

          {/* Host Message */}
          <div className="text-center md:text-left">
            <h3 className="text-2xl md:text-3xl font-semibold text-foreground mb-4">
              {t('host.warmWelcome', 'A Warm Welcome from')} {tc(content.name)}
            </h3>
            <p className="text-lg text-muted-foreground mb-4 italic">
              "{tc(welcomeMessage)}"
            </p>
            <p className="text-muted-foreground">
              {tc(content.backstory)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
