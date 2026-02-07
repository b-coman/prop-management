'use client';

import { MultilingualInput } from '../multilingual-input';
import { ImagePicker } from '../image-picker';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function HeroForm({ content, onChange, propertySlug, propertyImages }: BlockFormProps) {
  const bookingForm = (content.bookingForm || {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div>
        <Label>Background Image</Label>
        <ImagePicker
          value={content.backgroundImage as string | undefined}
          onChange={(v) => onChange({ ...content, backgroundImage: v })}
          propertySlug={propertySlug}
          propertyImages={propertyImages}
        />
      </div>

      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <MultilingualInput
        label="Subtitle"
        value={content.subtitle as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, subtitle: v })}
      />

      <div className="flex items-center justify-between">
        <Label>Show Booking Form</Label>
        <Switch
          checked={!!content.showBookingForm}
          onCheckedChange={(v) => onChange({ ...content, showBookingForm: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Rating</Label>
        <Switch
          checked={!!content.showRating}
          onCheckedChange={(v) => onChange({ ...content, showRating: v })}
        />
      </div>

      <div>
        <Label>Booking Form Position</Label>
        <Select
          value={(bookingForm.position as string) || 'right'}
          onValueChange={(v) => onChange({ ...content, bookingForm: { ...bookingForm, position: v } })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Booking Form Size</Label>
        <Select
          value={(bookingForm.size as string) || 'medium'}
          onValueChange={(v) => onChange({ ...content, bookingForm: { ...bookingForm, size: v } })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
