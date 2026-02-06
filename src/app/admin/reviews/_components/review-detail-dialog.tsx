'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import type { Review, SerializableTimestamp } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Star, StarHalf, ExternalLink, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  togglePublishReview,
  deleteReviewAction,
  setOwnerResponseAction,
  removeOwnerResponseAction,
} from '../actions';

interface ReviewDetailDialogProps {
  review: Review | null;
  onClose: () => void;
}

const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string') {
    try { return parseISO(dateStr); } catch { return null; }
  }
  if (typeof dateStr === 'number') return new Date(dateStr);
  return null;
};

const renderStars = (rating: number) => {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  const stars = [];

  for (let i = 0; i < fullStars; i++) {
    stars.push(<Star key={`full-${i}`} className="h-5 w-5 text-amber-400 fill-amber-400" />);
  }
  if (halfStar) {
    stars.push(<StarHalf key="half" className="h-5 w-5 text-amber-400 fill-amber-400" />);
  }
  const remaining = 5 - fullStars - (halfStar ? 1 : 0);
  for (let i = 0; i < remaining; i++) {
    stars.push(<Star key={`empty-${i}`} className="h-5 w-5 text-amber-200 fill-amber-200" />);
  }
  return stars;
};

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct',
  google: 'Google',
  'booking.com': 'Booking.com',
  airbnb: 'Airbnb',
  manual: 'Manual',
};

export function ReviewDetailDialog({ review, onClose }: ReviewDetailDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [responseText, setResponseText] = useState('');
  const [showResponseForm, setShowResponseForm] = useState(false);

  // Reset form state when review changes
  React.useEffect(() => {
    if (review?.ownerResponse) {
      setResponseText(review.ownerResponse.comment);
    } else {
      setResponseText('');
    }
    setShowResponseForm(false);
  }, [review?.id, review?.ownerResponse]);

  if (!review) return null;

  const reviewDate = parseDateSafe(review.date);
  const responseDate = review.ownerResponse ? parseDateSafe(review.ownerResponse.date) : null;

  const handleTogglePublish = () => {
    startTransition(async () => {
      const result = await togglePublishReview({
        reviewId: review.id,
        isPublished: !review.isPublished,
      });
      if (result.success) {
        toast({ title: review.isPublished ? 'Review unpublished' : 'Review published' });
        router.refresh();
        onClose();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteReviewAction(review.id);
      if (result.success) {
        toast({ title: 'Review deleted' });
        router.refresh();
        onClose();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleSaveResponse = () => {
    if (!responseText.trim()) return;
    startTransition(async () => {
      const result = await setOwnerResponseAction({
        reviewId: review.id,
        comment: responseText.trim(),
      });
      if (result.success) {
        toast({ title: 'Response saved' });
        router.refresh();
        onClose();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleRemoveResponse = () => {
    startTransition(async () => {
      const result = await removeOwnerResponseAction(review.id);
      if (result.success) {
        toast({ title: 'Response removed' });
        router.refresh();
        onClose();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={!!review} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Details</DialogTitle>
          <DialogDescription>
            Review by {review.guestName} for {review.propertyId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rating + Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {renderStars(review.rating)}
              <span className="ml-2 text-sm font-medium">{review.rating}/5</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {reviewDate ? format(reviewDate, 'MMM d, yyyy') : '-'}
            </span>
          </div>

          {/* Source */}
          <div className="flex items-center gap-2">
            <Badge variant="outline">{SOURCE_LABELS[review.source] || review.source}</Badge>
            {review.sourceUrl && (
              <a
                href={review.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs text-blue-600 hover:underline"
              >
                View original <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            )}
          </div>

          {/* Review text */}
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-sm italic">&quot;{review.comment}&quot;</p>
          </div>

          {/* Photos */}
          {review.photos && review.photos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {review.photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Review photo ${i + 1}`}
                    className="h-16 w-16 object-cover rounded border"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Owner Response Section */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                Owner Response
              </h4>
              {review.ownerResponse && !showResponseForm && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResponseText(review.ownerResponse!.comment);
                      setShowResponseForm(true);
                    }}
                    disabled={isPending}
                  >
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={isPending}>
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove owner response?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove your response from this review.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveResponse}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            {review.ownerResponse && !showResponseForm ? (
              <div className="bg-blue-50 rounded-md p-3">
                <p className="text-sm">{review.ownerResponse.comment}</p>
                {responseDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Responded on {format(responseDate, 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            ) : (
              <>
                {!showResponseForm && !review.ownerResponse ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResponseForm(true)}
                    disabled={isPending}
                  >
                    Add Response
                  </Button>
                ) : null}

                {showResponseForm && (
                  <div className="space-y-2">
                    <Textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Write your response..."
                      rows={3}
                      disabled={isPending}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveResponse}
                        disabled={isPending || !responseText.trim()}
                      >
                        {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                        Save Response
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowResponseForm(false)}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Publish toggle + Delete */}
          <div className="border-t pt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="publish-toggle"
                checked={review.isPublished}
                onCheckedChange={handleTogglePublish}
                disabled={isPending}
              />
              <Label htmlFor="publish-toggle" className="text-sm">
                {review.isPublished ? 'Published' : 'Unpublished'}
              </Label>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isPending}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this review?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the review by {review.guestName}.
                    {review.isPublished && ' Property ratings will be recalculated.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
