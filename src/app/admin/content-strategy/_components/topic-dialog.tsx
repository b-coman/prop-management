'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultilingualInput } from '@/app/admin/website/_components/multilingual-input';
import { TagInput } from './tag-input';
import { useToast } from '@/hooks/use-toast';
import { saveContentTopic } from '../actions';
import { Loader2 } from 'lucide-react';
import type { ContentTopic } from '@/lib/content-schemas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'evergreen', label: 'Evergreen' },
  { value: 'event', label: 'Event' },
  { value: 'guide', label: 'Guide' },
];

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const TARGET_PAGES = [
  { value: 'homepage', label: 'Homepage' },
  { value: 'details', label: 'Details' },
  { value: 'location', label: 'Location' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'booking', label: 'Booking' },
  { value: 'area-guide', label: 'Area Guide' },
  { value: 'reviews', label: 'Reviews' },
];

const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
];

// ---------------------------------------------------------------------------
// Slugify helper
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ML = Record<string, string>;

interface FormState {
  title: ML;
  slug: string;
  category: 'seasonal' | 'evergreen' | 'event' | 'guide';
  targetMonth: number | undefined;
  targetPage: string;
  targetBlock: string;
  focusAreas: string[];
  requiredSections: string[];
  priority: 'high' | 'medium' | 'low';
  generateAfter: string;
  regenerateInterval: number;
  status: 'draft' | 'scheduled';
}

function topicToForm(topic?: ContentTopic): FormState {
  if (!topic) {
    return {
      title: { en: '', ro: '' },
      slug: '',
      category: 'evergreen',
      targetMonth: undefined,
      targetPage: 'homepage',
      targetBlock: '',
      focusAreas: [],
      requiredSections: [],
      priority: 'medium',
      generateAfter: '',
      regenerateInterval: 0,
      status: 'draft',
    };
  }

  const title =
    typeof topic.title === 'string'
      ? { en: topic.title, ro: '' }
      : { en: topic.title?.en || '', ro: topic.title?.ro || '' };

  return {
    title,
    slug: topic.slug || '',
    category: topic.category || 'evergreen',
    targetMonth: topic.targetMonth,
    targetPage: topic.targetPage || 'homepage',
    targetBlock: topic.targetBlock || '',
    focusAreas: topic.focusAreas || [],
    requiredSections: topic.requiredSections || [],
    priority: topic.priority || 'medium',
    generateAfter: topic.generateAfter || '',
    regenerateInterval: topic.regenerateInterval || 0,
    status: (topic.status === 'draft' || topic.status === 'scheduled')
      ? topic.status
      : 'draft',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  topic?: ContentTopic;
  onSaved: () => void;
}

export function TopicDialog({
  open,
  onOpenChange,
  propertyId,
  topic,
  onSaved,
}: TopicDialogProps) {
  const isEditing = !!topic?.id;
  const [form, setForm] = useState<FormState>(() => topicToForm(topic));
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Reset form when topic changes or dialog opens
  useEffect(() => {
    if (open) {
      setForm(topicToForm(topic));
    }
  }, [open, topic]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Auto-generate slug from English title (only for new topics)
  const handleTitleChange = (value: ML) => {
    updateForm('title', value);
    if (!isEditing && value.en) {
      updateForm('slug', slugify(value.en));
    }
  };

  const handleSave = async () => {
    if (!form.slug.trim()) {
      toast({ title: 'Validation', description: 'Slug is required.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const topicData: ContentTopic = {
      id: topic?.id,
      title: form.title,
      slug: form.slug.trim(),
      category: form.category,
      targetMonth: form.category === 'seasonal' ? form.targetMonth : undefined,
      targetPage: form.targetPage,
      targetBlock: form.targetBlock.trim(),
      focusAreas: form.focusAreas,
      requiredSections: form.requiredSections,
      priority: form.priority,
      generateAfter: form.generateAfter || undefined,
      regenerateInterval: form.regenerateInterval || undefined,
      status: form.status,
    };

    const result = await saveContentTopic(propertyId, topicData);
    setIsSaving(false);

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: isEditing ? 'Updated' : 'Created', description: `Topic "${form.slug}" saved.` });
      onOpenChange(false);
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Topic' : 'Add Topic'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <MultilingualInput
            label="Title"
            value={form.title}
            onChange={handleTitleChange}
            placeholder="Topic title"
          />

          <div className="space-y-1.5">
            <Label className="text-sm">Slug</Label>
            <Input
              value={form.slug}
              onChange={(e) => updateForm('slug', e.target.value)}
              placeholder="auto-generated-from-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => updateForm('category', v as FormState['category'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => updateForm('priority', v as FormState['priority'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.category === 'seasonal' && (
            <div className="space-y-1.5">
              <Label className="text-sm">Target Month</Label>
              <Select
                value={form.targetMonth?.toString() || ''}
                onValueChange={(v) => updateForm('targetMonth', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Target Page</Label>
              <Select
                value={form.targetPage}
                onValueChange={(v) => updateForm('targetPage', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_PAGES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Target Block</Label>
              <Input
                value={form.targetBlock}
                onChange={(e) => updateForm('targetBlock', e.target.value)}
                placeholder="e.g. hero, intro"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Focus Areas</Label>
            <TagInput
              tags={form.focusAreas}
              onChange={(v) => updateForm('focusAreas', v)}
              placeholder="e.g. skiing, local food"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Required Sections</Label>
            <TagInput
              tags={form.requiredSections}
              onChange={(v) => updateForm('requiredSections', v)}
              placeholder="e.g. introduction, tips"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Generate After</Label>
              <Input
                type="date"
                value={form.generateAfter}
                onChange={(e) => updateForm('generateAfter', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Regenerate Interval (days)</Label>
              <Input
                type="number"
                min={0}
                value={form.regenerateInterval || ''}
                onChange={(e) => updateForm('regenerateInterval', parseInt(e.target.value) || 0)}
                placeholder="0 = one-time"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => updateForm('status', v as FormState['status'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Topic'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
