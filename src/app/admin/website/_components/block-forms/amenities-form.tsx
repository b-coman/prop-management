'use client';

import { useEffect, useState } from 'react';
import { MultilingualInput } from '../multilingual-input';
import { SortableList } from '../sortable-list';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { fetchAllAmenities, type AmenityItem } from '@/app/admin/website/actions';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

// Icon map for displaying amenity icons in the picker
const iconMap: Record<string, string> = {
  Wifi: '📶', Tv: '📺', Thermometer: '🌡️',
  ParkingSquare: '🅿️', Trees: '🌲', Flame: '🔥',
  ChefHat: '👨‍🍳', Utensils: '🍴', Car: '🚗',
  Mountain: '⛰️', Building: '🏢', Coffee: '☕',
  Dumbbell: '💪', Gamepad2: '🎮', Popcorn: '🍿',
  Baby: '👶', PawPrint: '🐾', Bath: '🛁',
  Wind: '💨', Droplets: '💧', Waves: '🌊',
  Gem: '💎', AirVent: '❄️', LampDesk: '💡',
};

function getIconEmoji(icon: string): string {
  return iconMap[icon] || '•';
}

export function AmenitiesForm({ content, onChange }: BlockFormProps) {
  const categories = (content.categories || []) as Array<Record<string, unknown>>;
  const [allAmenities, setAllAmenities] = useState<AmenityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all amenities from the central collection on mount
  useEffect(() => {
    fetchAllAmenities().then((amenities) => {
      setAllAmenities(amenities);
      setLoading(false);
    });
  }, []);

  const addCategory = () => {
    onChange({
      ...content,
      categories: [...categories, { name: { en: '' }, amenityRefs: [] }],
    });
  };

  const removeCategory = (i: number) => {
    onChange({ ...content, categories: categories.filter((_, idx) => idx !== i) });
  };

  const updateCategory = (i: number, updates: Record<string, unknown>) => {
    const updated = categories.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, categories: updated });
  };

  const toggleAmenityRef = (catIndex: number, amenityId: string) => {
    const cat = categories[catIndex];
    const refs = (cat.amenityRefs || []) as string[];
    const newRefs = refs.includes(amenityId)
      ? refs.filter(r => r !== amenityId)
      : [...refs, amenityId];
    // Store amenityRefs and remove old plain-string amenities field
    const { amenities: _removed, ...catWithoutOld } = cat;
    updateCategory(catIndex, { ...catWithoutOld, amenityRefs: newRefs });
  };

  // Filter amenities by search query
  const filteredAmenities = allAmenities.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nameEn = (a.name?.en || '').toLowerCase();
    const nameRo = (a.name?.ro || '').toLowerCase();
    const catEn = (a.category?.en || '').toLowerCase();
    return nameEn.includes(q) || nameRo.includes(q) || catEn.includes(q) || a.id.includes(q);
  });

  // Group amenities by category for display
  const amenitiesByCategory = filteredAmenities.reduce<Record<string, AmenityItem[]>>((acc, a) => {
    const catName = a.category?.en || 'Other';
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div className="space-y-4">
        <Label className="text-base font-semibold">Categories</Label>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground p-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading amenities...
          </div>
        ) : (
          <>
            {/* Search bar for amenity picker */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search amenities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <SortableList
              items={categories}
              onReorder={(items) => onChange({ ...content, categories: items })}
              onRemove={removeCategory}
              onAdd={addCategory}
              addLabel="Add Category"
              renderItem={(category, i) => {
                const selectedRefs = (category.amenityRefs || []) as string[];

                return (
                  <div className="space-y-4">
                    <MultilingualInput
                      label="Category Name"
                      value={category.name as string | Record<string, string> | undefined}
                      onChange={(v) => updateCategory(i, { name: v })}
                    />

                    <div className="space-y-2">
                      <Label>
                        Amenities ({selectedRefs.length} selected)
                      </Label>

                      <div className="border rounded-md p-3 max-h-60 overflow-y-auto space-y-3">
                        {Object.entries(amenitiesByCategory).map(([catName, amenities]) => (
                          <div key={catName}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                              {catName}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {amenities.map((amenity) => (
                                <label
                                  key={amenity.id}
                                  className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer"
                                >
                                  <Checkbox
                                    checked={selectedRefs.includes(amenity.id)}
                                    onCheckedChange={() => toggleAmenityRef(i, amenity.id)}
                                  />
                                  <span className="text-sm">
                                    {getIconEmoji(amenity.icon)} {amenity.name?.en || amenity.id}
                                    {amenity.name?.ro && (
                                      <span className="text-muted-foreground"> / {amenity.name.ro}</span>
                                    )}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        {filteredAmenities.length === 0 && (
                          <p className="text-sm text-muted-foreground py-2">
                            No amenities found{searchQuery ? ` matching "${searchQuery}"` : ''}.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
