import Image from 'next/image';
import { User } from 'lucide-react'; // Import a fallback icon

interface HostInfo {
  name: string;
  imageUrl?: string | null; // Make optional
  welcomeMessage: string;
  backstory: string;
  'data-ai-hint'?: string;
}

interface HostIntroductionProps {
  host: HostInfo; // Accept the HostInfo object directly
}

export function HostIntroduction({ host }: HostIntroductionProps) {
  // Don't render if required host info is missing
  if (!host || !host.name || !host.welcomeMessage || !host.backstory) {
    return null;
  }

  return (
    <section className="py-16 md:py-24 bg-background" id="host"> {/* Added ID */}
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 max-w-4xl mx-auto">
          {/* Host Photo */}
          <div className="flex-shrink-0 w-40 h-40 md:w-48 md:h-48 relative rounded-full overflow-hidden shadow-lg border-4 border-primary/20 bg-muted">
            {host.imageUrl ? (
              <Image
                src={host.imageUrl}
                alt={`Photo of host, ${host.name}`}
                fill
                style={{ objectFit: 'cover' }}
                className="rounded-full"
                data-ai-hint={host['data-ai-hint'] || 'host portrait friendly'}
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
              A Warm Welcome from {host.name}
            </h3>
            <p className="text-lg text-muted-foreground mb-4 italic">
              "{host.welcomeMessage}"
            </p>
            <p className="text-muted-foreground">
              {host.backstory}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
