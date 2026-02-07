'use client';

import { MultilingualInput } from '../multilingual-input';
import { ImagePicker } from '../image-picker';
import { SortableList } from '../sortable-list';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function RoomsForm({ content, onChange, propertySlug, propertyImages }: BlockFormProps) {
  const rooms = (content.rooms || []) as Array<Record<string, unknown>>;

  const addRoom = () => {
    onChange({
      ...content,
      rooms: [...rooms, { name: { en: '' }, description: { en: '' }, features: [], image: '' }],
    });
  };

  const removeRoom = (i: number) => {
    onChange({ ...content, rooms: rooms.filter((_, idx) => idx !== i) });
  };

  const updateRoom = (i: number, updates: Record<string, unknown>) => {
    const updated = rooms.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, rooms: updated });
  };

  const addFeature = (roomIndex: number) => {
    const room = rooms[roomIndex];
    const features = (room.features || []) as string[];
    updateRoom(roomIndex, { features: [...features, ''] });
  };

  const removeFeature = (roomIndex: number, featureIndex: number) => {
    const room = rooms[roomIndex];
    const features = (room.features || []) as string[];
    updateRoom(roomIndex, { features: features.filter((_, idx) => idx !== featureIndex) });
  };

  const updateFeature = (roomIndex: number, featureIndex: number, value: string) => {
    const room = rooms[roomIndex];
    const features = (room.features || []) as string[];
    const updated = features.map((f, idx) => (idx === featureIndex ? value : f));
    updateRoom(roomIndex, { features: updated });
  };

  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div className="space-y-4">
        <Label className="text-base font-semibold">Rooms</Label>

        <SortableList
          items={rooms}
          onReorder={(items) => onChange({ ...content, rooms: items })}
          onRemove={removeRoom}
          onAdd={addRoom}
          addLabel="Add Room"
          renderItem={(room, i) => (
            <div className="space-y-4">
              <MultilingualInput
                label="Name"
                value={room.name as string | Record<string, string> | undefined}
                onChange={(v) => updateRoom(i, { name: v })}
              />

              <MultilingualInput
                label="Description"
                value={room.description as string | Record<string, string> | undefined}
                onChange={(v) => updateRoom(i, { description: v })}
                multiline
              />

              <div>
                <Label>Image</Label>
                <ImagePicker
                  value={(room.image as string) || ''}
                  onChange={(v) => updateRoom(i, { image: v })}
                  propertySlug={propertySlug}
                  propertyImages={propertyImages}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Features</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => addFeature(i)}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                {((room.features || []) as string[]).map((feature, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Input
                      value={feature}
                      onChange={(e) => updateFeature(i, j, e.target.value)}
                      placeholder="Feature"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFeature(i, j)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
