import { Mountain, Users, Leaf, Map } from 'lucide-react'; // Import appropriate icons
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Define a type for the icon names we expect
type IconName = 'Mountain' | 'Users' | 'Leaf' | 'Map' | string; // Allow string for flexibility

interface Highlight {
  icon: IconName;
  title: string;
  description: string;
}

interface ExperienceSectionProps {
  title: string;
  welcomeText: string;
  highlights: Highlight[];
}

// Map icon names to actual Lucide components
const iconMap: { [key in IconName]: React.ElementType } = {
  Mountain: Mountain,
  Users: Users,
  Leaf: Leaf,
  Map: Map,
  // Add more mappings as needed
};

export function ExperienceSection({ title, welcomeText, highlights }: ExperienceSectionProps) {
  // Don't render if required props are missing
  if (!title || !welcomeText || !highlights || highlights.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-24 bg-secondary/50" id="experience"> {/* Added ID */}
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
            {title}
          </h2>
          <p className="text-lg text-muted-foreground">
            {welcomeText}
          </p>
        </div>

        {/* Use a fluid grid layout */}
        <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {highlights.map((highlight, index) => {
            const IconComponent = iconMap[highlight.icon] || Leaf; // Default to Leaf icon if not found
            return (
              // Apply text-center to the Card itself
              <Card key={index} className="text-center border-border hover:shadow-lg transition-shadow duration-300">
                 {/* Ensure CardHeader centers its items (icon and title) */}
                <CardHeader className="items-center">
                   <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <IconComponent className="h-6 w-6" />
                   </div>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    {highlight.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Ensure CardContent text is centered (already achieved by parent text-center) */}
                  <p className="text-muted-foreground text-sm">
                    {highlight.description}
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