'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultilingualInput } from '@/app/admin/website/_components/multilingual-input';
import { SortableList } from '@/app/admin/website/_components/sortable-list';
import { saveGuide, type GuideDraft } from '../actions';

/**
 * The guest guide editor.
 *
 * Two panels, because the guide holds two very different kinds of content. The SECTIONS are copy
 * the owner rewrites often. The OPERATIONAL block — Wi-Fi, contacts, arrival — is edited rarely
 * and is the part that reaches an arriving guest through two channels at once, since the emails
 * read the same fields. A wrong Wi-Fi password or gate number here is wrong in both places.
 */

const TIERS = [
  { value: 'guest', label: 'Guest only' },
  { value: 'public', label: 'Public' },
];
const GROUPS = [
  { value: 'intro', label: 'Intro' },
  { value: 'house', label: 'In the house' },
  { value: 'around', label: 'Around' },
  { value: 'place', label: 'The place' },
];

export function GuideEditor({ propertyId, initial }: { propertyId: string; initial: GuideDraft }) {
  const [guide, setGuide] = useState<GuideDraft>(initial);
  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const patch = (next: Partial<GuideDraft>) => {
    setGuide((g) => ({ ...g, ...next }));
    setMessage(null);
  };
  const patchArrival = (next: Record<string, unknown>) =>
    patch({ arrival: { ...(guide.arrival ?? {}), ...next } });

  const sections = guide.sections ?? [];
  const contacts = guide.contacts ?? [];

  const setSection = (i: number, next: Record<string, unknown>) =>
    patch({ sections: sections.map((s, j) => (j === i ? { ...s, ...next } : s)) });
  const setContact = (i: number, next: Record<string, unknown>) =>
    patch({ contacts: contacts.map((c, j) => (j === i ? { ...c, ...next } : c)) });

  const onSave = () =>
    startSaving(async () => {
      const res = await saveGuide(propertyId, guide);
      setMessage(res.error ? { kind: 'error', text: res.error } : { kind: 'ok', text: 'Saved.' });
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 sticky top-0 z-10 bg-background/95 py-3 border-b">
        <div className="text-sm text-muted-foreground">
          {sections.length} sections · {contacts.length} contacts
          {guide.enabled === false && <span className="ml-2 text-destructive">· guide disabled</span>}
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <span className={message.kind === 'ok' ? 'text-sm text-green-600' : 'text-sm text-destructive'}>
              {message.text}
            </span>
          )}
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save guide'}
          </Button>
        </div>
      </div>

      {/* ---------------- operational ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Arrival</CardTitle>
          <CardDescription>
            These fields are read by the guest guide <strong>and</strong> by the pre-arrival email.
            A change here reaches the guest through both.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Waze link</Label>
              <Input
                value={guide.arrival?.wazeUrl ?? ''}
                onChange={(e) => patchArrival({ wazeUrl: e.target.value })}
                placeholder="https://www.waze.com/…"
              />
            </div>
            <div className="space-y-2">
              <Label>Google Maps link</Label>
              <Input
                value={guide.arrival?.mapsUrl ?? ''}
                onChange={(e) => patchArrival({ mapsUrl: e.target.value })}
                placeholder="https://www.google.com/maps/…"
              />
            </div>
            <div className="space-y-2">
              <Label>Gate number</Label>
              <Input
                value={guide.arrival?.gateNumber ?? ''}
                onChange={(e) => patchArrival({ gateNumber: e.target.value })}
              />
            </div>
          </div>
          <MultilingualInput
            label="Handover note (guide only)"
            multiline
            value={guide.arrival?.call}
            onChange={(v) => patchArrival({ call: v })}
          />
          <MultilingualInput
            label="Access & luggage note (guide and pre-arrival email)"
            multiline
            value={guide.arrival?.access}
            onChange={(v) => patchArrival({ access: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wi-Fi</CardTitle>
          <CardDescription>Shown to guests with a valid link. Not on the public page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Network</Label>
            <Input
              value={guide.wifi?.network ?? ''}
              onChange={(e) => patch({ wifi: { ...(guide.wifi ?? {}), network: e.target.value } })}
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              value={guide.wifi?.password ?? ''}
              onChange={(e) => patch({ wifi: { ...(guide.wifi ?? {}), password: e.target.value } })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who to call</CardTitle>
          <CardDescription>
            The <strong>first</strong> contact is the one the emails use for the host name and phone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SortableList
            items={contacts}
            addLabel="Add contact"
            onReorder={(items) => patch({ contacts: items })}
            onRemove={(i) => patch({ contacts: contacts.filter((_, j) => j !== i) })}
            onAdd={() => patch({ contacts: [...contacts, { phone: '', channel: 'whatsapp' }] })}
            renderItem={(c: any, i) => (
              <div className="space-y-3">
                {i === 0 && (
                  <p className="text-xs text-muted-foreground">Used by the guest emails.</p>
                )}
                <MultilingualInput
                  label="Name"
                  inline
                  value={c.displayName}
                  onChange={(v) => setContact(i, { displayName: v })}
                />
                <MultilingualInput
                  label="Role"
                  inline
                  value={c.role}
                  onChange={(v) => setContact(i, { role: v })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={c.phone ?? ''}
                      onChange={(e) => setContact(i, { phone: e.target.value })}
                      placeholder="+40…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <select
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={c.channel ?? 'whatsapp'}
                      onChange={(e) => setContact(i, { channel: e.target.value })}
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="call">Call</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* ---------------- sections ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
          <CardDescription>
            Order here is the order on the page. <strong>Guest only</strong> sections need a valid
            link; <strong>public</strong> ones show to anyone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SortableList
            items={sections}
            addLabel="Add section"
            onReorder={(items) => patch({ sections: items })}
            onRemove={(i) => patch({ sections: sections.filter((_, j) => j !== i) })}
            onAdd={() =>
              patch({ sections: [...sections, { id: '', tier: 'guest', group: 'house' }] })
            }
            renderItem={(s: any, i) => (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Id</Label>
                    <Input
                      value={s.id ?? ''}
                      onChange={(e) => setSection(i, { id: e.target.value })}
                      placeholder="things-to-know"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <select
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={s.tier ?? 'guest'}
                      onChange={(e) => setSection(i, { tier: e.target.value })}
                    >
                      {TIERS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Group</Label>
                    <select
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={s.group ?? 'house'}
                      onChange={(e) => setSection(i, { group: e.target.value })}
                    >
                      {GROUPS.map((g) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <MultilingualInput
                  label="Title"
                  value={s.title}
                  onChange={(v) => setSection(i, { title: v })}
                />
                <MultilingualInput
                  label="Body"
                  multiline
                  value={s.body}
                  onChange={(v) => setSection(i, { body: v })}
                />
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
