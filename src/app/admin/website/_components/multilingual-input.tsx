'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type MultilingualValue = string | Record<string, string> | undefined;

interface MultilingualInputProps {
  value: MultilingualValue;
  onChange: (value: Record<string, string>) => void;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  /** Inline mode: label + EN/RO tabs + input all on one row */
  inline?: boolean;
}

function normalize(value: MultilingualValue): Record<string, string> {
  if (!value) return { en: '' };
  if (typeof value === 'string') return { en: value };
  return { en: value.en || '', ro: value.ro || '' };
}

export function MultilingualInput({
  value,
  onChange,
  label,
  placeholder,
  multiline = false,
  className,
  inline = false,
}: MultilingualInputProps) {
  const [activeTab, setActiveTab] = useState<'en' | 'ro'>('en');
  const normalized = normalize(value);

  const handleChange = (lang: string, text: string) => {
    onChange({ ...normalized, [lang]: text });
  };

  const roMissing = !normalized.ro;
  const InputComp = multiline ? Textarea : Input;

  const langSwitcher = (
    <div className="flex rounded-md border text-xs overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => setActiveTab('en')}
        className={cn(
          'px-2 py-0.5 transition-colors',
          activeTab === 'en'
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted'
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('ro')}
        className={cn(
          'px-2 py-0.5 transition-colors relative',
          activeTab === 'ro'
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted'
        )}
      >
        RO
        {roMissing && activeTab !== 'ro' && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-400" />
        )}
      </button>
    </div>
  );

  if (inline) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {langSwitcher}
        <InputComp
          value={normalized[activeTab] || ''}
          onChange={(e) => handleChange(activeTab, e.target.value)}
          placeholder={placeholder || `${label} (${activeTab.toUpperCase()})`}
          rows={multiline ? 3 : undefined}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        {langSwitcher}
      </div>
      <InputComp
        value={normalized[activeTab] || ''}
        onChange={(e) => handleChange(activeTab, e.target.value)}
        placeholder={placeholder || `${label} (${activeTab.toUpperCase()})`}
        rows={multiline ? 3 : undefined}
      />
    </div>
  );
}
