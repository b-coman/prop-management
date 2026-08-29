import { Leaf } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { ICON_MAP } from '@/lib/icon-map';

interface Highlight {
  icon: string;
  title: string | { [key: string]: string };
  description: string | { [key: string]: string };
  'data-ai-hint'?: string;
}

interface ExperienceContent {
  title: string | { [key: string]: string };
  description: string | { [key: string]: string };
  highlights: Highlight[];
  'data-ai-hint'?: string;
}

interface ExperienceSectionProps {
  content: ExperienceContent;
  language?: string;
}

export function ExperienceSection({ content, language = 'en' }: ExperienceSectionProps) {
  const { tc } = useLanguage();
  
  // Don't render if required props are missing
  if (!content) {
    console.warn("ExperienceSection received invalid content");
    return null;
  }

  // Extract properties with defaults to prevent destructuring errors
  const {
    title = "",
    description = "",
    highlights = []
  } = content;

  // The highlight cards are the block. Title and description are each optional,
  // so a property can lead with just the description — or omit both — without
  // leaving an empty heading behind.
  if (!highlights || highlights.length === 0) {
    return null;
  }

  const titleText = tc(title);
  const descriptionText = tc(description);

  return (
    <section className="py-10 md:py-16 bg-secondary/50" id="experience"> {/* Added ID */}
      <div className="container mx-auto px-4">
        {(titleText || descriptionText) && (
          <div className="max-w-3xl mx-auto text-center mb-8">
            {titleText && (
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
                {titleText}
              </h2>
            )}
            {descriptionText && (
              <p className="text-lg text-muted-foreground">
                {descriptionText}
              </p>
            )}
          </div>
        )}

        {/* Use a fluid grid layout */}
        <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {highlights.map((highlight, index) => {
            const IconComponent = ICON_MAP[highlight.icon] || Leaf;
            return (
              // Apply text-center to the Card itself
              <Card key={index} className="text-center border-border hover:shadow-lg transition-shadow duration-300">
                 {/* Ensure CardHeader centers its items (icon and title) */}
                <CardHeader className="items-center">
                   <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <IconComponent className="h-6 w-6" />
                   </div>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    {tc(highlight.title)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Ensure CardContent text is centered (already achieved by parent text-center) */}
                  <p className="text-muted-foreground text-sm">
                    {tc(highlight.description)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}