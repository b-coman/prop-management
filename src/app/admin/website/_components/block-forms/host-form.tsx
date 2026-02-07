'use client';

import { MultilingualInput } from '../multilingual-input';
import { ImagePicker } from '../image-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function HostForm({ content, onChange, propertySlug, propertyImages }: BlockFormProps) {
  const contact = (content.contact || {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Name"
        value={content.name as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, name: v })}
      />

      <div>
        <Label>Host Image</Label>
        <ImagePicker
          value={content.imageUrl as string | undefined}
          onChange={(v) => onChange({ ...content, imageUrl: v })}
          propertySlug={propertySlug}
          propertyImages={propertyImages}
        />
      </div>

      <MultilingualInput
        label="Description"
        value={content.description as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, description: v })}
        multiline
      />

      <MultilingualInput
        label="Backstory"
        value={content.backstory as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, backstory: v })}
        multiline
      />

      <div>
        <Label>Phone</Label>
        <Input
          value={(contact.phone as string) || ''}
          onChange={(e) => onChange({ ...content, contact: { ...contact, phone: e.target.value } })}
          placeholder="+40 7XX XXX XXX"
        />
      </div>

      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={(contact.email as string) || ''}
          onChange={(e) => onChange({ ...content, contact: { ...contact, email: e.target.value } })}
          placeholder="host@example.com"
        />
      </div>
    </div>
  );
}
