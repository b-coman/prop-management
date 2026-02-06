
import Image from 'next/image';
import { Star, StarHalf, UserCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

interface Review {
  id?: string;
  name: string;
  date?: string;
  rating: number;
  text: string | { [key: string]: string };
  imageUrl?: string | null;
  'data-ai-hint'?: string;
  source?: string;
  sourceUrl?: string;
}

interface TestimonialsContent {
  title: string | { [key: string]: string }; // Title for the section
  overallRating: number; // Overall rating for the property
  reviewCount?: number; // Total number of reviews
  reviews: Review[]; // Array of review objects
  'data-ai-hint'?: string;
}

interface TestimonialsSectionProps {
  content: TestimonialsContent; // Use content property name for consistency
  language?: string;
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

export function TestimonialsSection({ content, language = 'en' }: TestimonialsSectionProps) {
  const { tc, t } = useLanguage();
  
  // Don't render if content is missing
  if (!content) {
    console.warn("TestimonialsSection received invalid content");
    return null;
  }

  // Extract properties with defaults to prevent destructuring errors
  const {
    title = t('testimonials.title', 'What Our Guests Say'),
    overallRating = 0,
    reviewCount = 0,
    reviews = []
  } = content;

  // Don't render if no reviews
  if (!reviews || reviews.length === 0) {
    return null;
  }

  // Detect if reviews are real (have a source field) vs override-only
  const hasRealReviews = reviews.some(r => r.source);

  return (
    <section className="py-16 md:py-24 bg-secondary/50" id="testimonials"> {/* Added ID */}
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
             {tc(title)}
          </h2>
          {overallRating > 0 && (
             <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-bold text-foreground">{overallRating.toFixed(1)}</span>
                <div>
                  <div className="flex">{renderStars(overallRating)}</div>
                  {(reviewCount || reviews.length) > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {reviewCount || reviews.length} {(reviewCount || reviews.length) === 1 ? t('reviews.review') : t('reviews.reviews').toLowerCase()}
                    </p>
                  )}
                </div>
            </div>
          )}

        </div>

         {/* Use a fluid grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.slice(0, hasRealReviews ? 6 : 3).map((review, index) => (
            <Card key={review.id || index} className="flex flex-col border-border">
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
                             <UserCircle className="h-8 w-8 text-muted-foreground/50" />
                         </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{review.name}</p>
                      {review.source && review.source !== 'direct' && review.source !== 'manual' && (
                        review.sourceUrl ? (
                          <a href={review.sourceUrl} target="_blank" rel="noopener noreferrer">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {review.source === 'booking.com' ? 'Booking.com' : review.source.charAt(0).toUpperCase() + review.source.slice(1)}
                            </Badge>
                          </a>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {review.source === 'booking.com' ? 'Booking.com' : review.source.charAt(0).toUpperCase() + review.source.slice(1)}
                          </Badge>
                        )
                      )}
                    </div>
                     {review.date && <p className="text-xs text-muted-foreground">{review.date}</p>}
                    <div className="flex mt-1">
                       {renderStars(review.rating)}
                    </div>
                  </div>
                </div>
                {review.text && tc(review.text) !== '(Rating only)' && (
                  <p className="text-muted-foreground text-sm italic line-clamp-4">
                    &quot;{tc(review.text)}&quot;
                  </p>
                )}
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