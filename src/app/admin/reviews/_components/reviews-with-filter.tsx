'use client';

import { useState } from 'react';
import type { Review, ReviewSource } from '@/types';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import { ReviewTable } from './review-table';
import { EmptyState } from '@/components/admin';
import { Star } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ReviewsWithFilterProps {
  reviews: Review[];
}

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'direct', label: 'Direct' },
  { value: 'google', label: 'Google' },
  { value: 'booking.com', label: 'Booking.com' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'manual', label: 'Manual' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'published', label: 'Published' },
  { value: 'unpublished', label: 'Unpublished' },
];

export function ReviewsWithFilter({ reviews }: ReviewsWithFilterProps) {
  const { selectedPropertyId } = usePropertySelector();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  let filtered = reviews;

  if (selectedPropertyId) {
    filtered = filtered.filter(r => r.propertyId === selectedPropertyId);
  }

  if (sourceFilter !== 'all') {
    filtered = filtered.filter(r => r.source === sourceFilter);
  }

  if (statusFilter !== 'all') {
    if (statusFilter === 'published') {
      filtered = filtered.filter(r => r.isPublished);
    } else {
      filtered = filtered.filter(r => !r.isPublished);
    }
  }

  if (filtered.length === 0) {
    return (
      <>
        <FilterBar
          sourceFilter={sourceFilter}
          onSourceChange={setSourceFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />
        <EmptyState
          icon={Star}
          title={selectedPropertyId ? 'No reviews for this property' : 'No reviews yet'}
          description={
            selectedPropertyId
              ? 'Select "All Properties" to see all reviews'
              : 'Reviews will appear here when they are added'
          }
        />
      </>
    );
  }

  return (
    <>
      <FilterBar
        sourceFilter={sourceFilter}
        onSourceChange={setSourceFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />
      <ReviewTable reviews={filtered} />
    </>
  );
}

function FilterBar({
  sourceFilter,
  onSourceChange,
  statusFilter,
  onStatusChange,
}: {
  sourceFilter: string;
  onSourceChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Select value={sourceFilter} onValueChange={onSourceChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
