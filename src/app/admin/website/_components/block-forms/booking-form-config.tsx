'use client';

import { MultilingualInput } from '../multilingual-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function BookingFormConfig({ content, onChange }: BlockFormProps) {
  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <MultilingualInput
        label="Description"
        value={content.description as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, description: v })}
        multiline
      />

      <div className="flex items-center justify-between">
        <Label>Show Calendar</Label>
        <Switch
          checked={!!content.showCalendar}
          onCheckedChange={(v) => onChange({ ...content, showCalendar: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Summary</Label>
        <Switch
          checked={!!content.showSummary}
          onCheckedChange={(v) => onChange({ ...content, showSummary: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Enable Coupons</Label>
        <Switch
          checked={!!content.enableCoupons}
          onCheckedChange={(v) => onChange({ ...content, enableCoupons: v })}
        />
      </div>
    </div>
  );
}
