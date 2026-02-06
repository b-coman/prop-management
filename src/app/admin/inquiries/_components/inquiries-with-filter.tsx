'use client';

import type { Inquiry } from '@/types';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import { InquiryTable } from './inquiry-table';
import { EmptyState } from '@/components/admin';
import { MessageSquare } from 'lucide-react';

interface InquiriesWithFilterProps {
  inquiries: Inquiry[];
}

export function InquiriesWithFilter({ inquiries }: InquiriesWithFilterProps) {
  const { selectedPropertyId } = usePropertySelector();

  const filtered = selectedPropertyId
    ? inquiries.filter(i => i.propertySlug === selectedPropertyId)
    : inquiries;

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title={selectedPropertyId ? 'No inquiries for this property' : 'No inquiries yet'}
        description={
          selectedPropertyId
            ? 'Select "All Properties" to see all inquiries'
            : 'Guest inquiries will appear here when they submit questions'
        }
      />
    );
  }

  return <InquiryTable inquiries={filtered} />;
}
