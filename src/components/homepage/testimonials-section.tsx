import Image from 'next/image';
import { Star, StarHalf, UserCircle } from 'lucide-react'; // Added UserCircle
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Review {
  id?: string; // Make optional if not always present
  name: string;
  date?: string; // Add date field
  rating: number;
  text: string; // Renamed from comment for consistency
  imageUrl?: string | null; // Optional guest image
   'data-ai-hint'?: string; // Optional AI hint for image generation
}

interface TestimonialsData {
  overallRating: number;
  reviews: Review[];
}

interface TestimonialsSectionProps {
  testimonials: TestimonialsData; // Accept the structured data
}

// Helper function to render stars
const renderStars = (rating: number) => {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  const stars = [];

  for (let i = 0; i < fullStars; i++) {
    stars.push(<Star key={`full-${i}`} className="h-5 w-5 text-amber-400 fill-amber-400" />);
  }
  if (halfStar) {
    stars.push(<StarHalf key="half" className="h-5 w-5 text-amber-400 fill-amber-400" />);
  }
  for (let i = 0; i < emptyStars; i++) {
    stars.push(<Star key={`empty-${i}`} className="h-5 w-5 text-amber-200 fill-amber-200" />);
  }
  return stars;
};

export function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  // Don't render if no testimonials data or no reviews
  if (!testimonials || !testimonials.reviews || testimonials.reviews.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-24 bg-secondary/50" id="testimonials"> {/* Added ID */}
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
            What Our Guests Say
          </h2>
          {testimonials.overallRating > 0 && (
             <div className="flex items-center justify-center gap-2">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                 Overall Rating: {testimonials.overallRating.toFixed(1)} / 5
                </Badge>
                <div className="flex">
                 {renderStars(testimonials.overallRating)}
                </div>
            </div>
          )}

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.reviews.slice(0, 3).map((review, index) => ( // Show first 3 reviews
            <Card key={review.id || index} className="flex flex-col border-border"> {/* Use index as fallback key */}
              <CardContent className="p-6 flex-grow flex flex-col">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 w-12 h-12 relative rounded-full overflow-hidden mr-4 border-2 border-primary/20 bg-muted">
                    {review.imageUrl ? (
                        <Image
                            src={review.imageUrl}
                            alt={`Photo of ${review.name}`}
                            fill
                            style={{ objectFit: 'cover' }}
                            className="rounded-full"
                            data-ai-hint={review['data-ai-hint'] || 'guest portrait'}
                        />
                    ) : (
                         <div className="flex items-center justify-center h-full w-full">
                             <UserCircle className="h-8 w-8 text-muted-foreground/50" /> {/* Fallback Icon */}
                         </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{review.name}</p>
                     {review.date && <p className="text-xs text-muted-foreground">{review.date}</p>} {/* Display date */}
                    <div className="flex mt-1">
                       {renderStars(review.rating)}
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm italic flex-grow">
                  "{review.text}"
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
         {/* TODO: Add a link to a dedicated reviews page if one exists */}
         {/* <div className="text-center mt-12">
           <Link href="/reviews" passHref>
             <Button variant="outline">See All Reviews</Button>
           </Link>
         </div> */}
      </div>
    </section>
  );
}
