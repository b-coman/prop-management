'use client';

import { useState } from 'react';
import type { Review, ReviewSource } from '@/types';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import { ReviewTable } from './review-table';
import { EmptyState } from '@/components/admin';
import { Star, Upload, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImportReviewsDialog } from './import-reviews-dialog';
import { GoogleSyncDialog } from './google-sync-dialog';

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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [googleSyncOpen, setGoogleSyncOpen] = useState(false);

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
          onImport={() => setImportDialogOpen(true)}
          onGoogleSync={() => setGoogleSyncOpen(true)}
          googleSyncDisabled={!selectedPropertyId}
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
        <ImportReviewsDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
        {selectedPropertyId && (
          <GoogleSyncDialog open={googleSyncOpen} onOpenChange={setGoogleSyncOpen} propertyId={selectedPropertyId} />
        )}
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
        onImport={() => setImportDialogOpen(true)}
        onGoogleSync={() => setGoogleSyncOpen(true)}
        googleSyncDisabled={!selectedPropertyId}
      />
      <ReviewTable reviews={filtered} />
      <ImportReviewsDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
      {selectedPropertyId && (
        <GoogleSyncDialog open={googleSyncOpen} onOpenChange={setGoogleSyncOpen} propertyId={selectedPropertyId} />
      )}
    </>
  );
}

function FilterBar({
  sourceFilter,
  onSourceChange,
  statusFilter,
  onStatusChange,
  onImport,
  onGoogleSync,
  googleSyncDisabled,
}: {
  sourceFilter: string;
  onSourceChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  onImport: () => void;
  onGoogleSync: () => void;
  googleSyncDisabled: boolean;
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
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onGoogleSync} disabled={googleSyncDisabled} title={googleSyncDisabled ? 'Select a property first' : 'Sync Google Reviews'}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Google Sync
        </Button>
        <Button variant="outline" size="sm" onClick={onImport}>
          <Upload className="h-4 w-4 mr-1" />
          Import
        </Button>
      </div>
    </div>
  );
}
