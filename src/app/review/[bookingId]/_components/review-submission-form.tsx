'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitGuestReview } from '../actions';

const translations = {
  en: {
    title: 'How Was Your Stay?',
    stayAt: 'Your stay at',
    dates: 'Dates',
    yourName: 'Your Name',
    rating: 'Rating',
    ratingRequired: 'Please select a rating',
    comment: 'Your Review',
    commentPlaceholder: 'Tell us about your experience... What did you enjoy? What could be improved?',
    commentMinLength: 'Minimum 20 characters',
    submit: 'Submit Review',
    submitting: 'Submitting...',
    thankYouTitle: 'Thank You!',
    thankYouMessage: 'Your review has been submitted successfully. It will be published after review by our team.',
    characters: 'characters',
  },
  ro: {
    title: 'Cum a Fost Sejurul Dvs.?',
    stayAt: 'Sejurul dvs. la',
    dates: 'Date',
    yourName: 'Numele Dvs.',
    rating: 'Evaluare',
    ratingRequired: 'Selectați o evaluare',
    comment: 'Recenzia Dvs.',
    commentPlaceholder: 'Spuneți-ne despre experiența dvs... Ce v-a plăcut? Ce ar putea fi îmbunătățit?',
    commentMinLength: 'Minimum 20 de caractere',
    submit: 'Trimite Recenzia',
    submitting: 'Se trimite...',
    thankYouTitle: 'Vă Mulțumim!',
    thankYouMessage: 'Recenzia dvs. a fost trimisă cu succes. Va fi publicată după verificarea de către echipa noastră.',
    characters: 'caractere',
  },
};

interface ReviewSubmissionFormProps {
  bookingId: string;
  token: string;
  guestName: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  language: string;
}

export default function ReviewSubmissionForm({
  bookingId,
  token,
  guestName: initialGuestName,
  propertyName,
  checkInDate,
  checkOutDate,
  language,
}: ReviewSubmissionFormProps) {
  const t = translations[language as keyof typeof translations] || translations.en;

  const [state, setState] = useState<'form' | 'submitting' | 'thank-you'>('form');
  const [name, setName] = useState(initialGuestName);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (rating === 0) {
      setError(t.ratingRequired);
      return;
    }

    if (comment.length < 20) {
      setError(t.commentMinLength);
      return;
    }

    setState('submitting');

    const result = await submitGuestReview({
      bookingId,
      token,
      guestName: name,
      rating,
      comment,
      language,
    });

    if (result.success) {
      setState('thank-you');
    } else {
      setError(result.error || 'Something went wrong.');
      setState('form');
    }
  }

  if (state === 'thank-you') {
    return (
      <Card className="max-w-lg w-full">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t.thankYouTitle}</h2>
          <p className="text-gray-600">{t.thankYouMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t.title}</CardTitle>
        <p className="text-gray-600 mt-1">{t.stayAt} <span className="font-medium">{propertyName}</span></p>
        {checkInDate && checkOutDate && (
          <p className="text-sm text-gray-500">{t.dates}: {checkInDate} &mdash; {checkOutDate}</p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Star Rating */}
          <div>
            <Label className="mb-2 block">{t.rating}</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoveredRating || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-300'
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Guest Name */}
          <div>
            <Label htmlFor="guestName">{t.yourName}</Label>
            <Input
              id="guestName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              className="mt-1"
            />
          </div>

          {/* Comment */}
          <div>
            <Label htmlFor="comment">{t.comment}</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.commentPlaceholder}
              required
              minLength={20}
              maxLength={2000}
              rows={5}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {comment.length}/2000 {t.characters}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>
          )}

          <Button
            type="submit"
            disabled={state === 'submitting'}
            className="w-full"
          >
            {state === 'submitting' ? t.submitting : t.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
