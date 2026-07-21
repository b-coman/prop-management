'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Users, Search, Loader2, ArrowRight } from 'lucide-react';
import type { AudienceCandidate, IneligibleReason } from '@/services/audienceService';
import { createManualCampaignAction } from '../actions';

// Operator-facing labels for the (only) automatic exclusions.
const REASON_LABEL: Record<IneligibleReason, string> = {
  unsubscribed: 'Opted out',
  'no-contact': 'No WhatsApp',
  suppressed: 'Suppressed',
  'frequency-cap': 'Messaged recently',
  'active-future-booking': 'Has upcoming stay',
};

type LangFilter = 'all' | 'ro' | 'en';
type RepeatFilter = 'all' | 'repeat' | 'once';

export function AudiencePicker({
  candidates,
  eligibleCount,
  perRunCap,
  propertyId,
}: {
  candidates: AudienceCandidate[];
  eligibleCount: number;
  perRunCap: number;
  propertyId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, startCreate] = useTransition();
  const [name, setName] = useState(`Reach-out ${new Date().toISOString().slice(0, 10)}`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState<LangFilter>('all');
  const [repeat, setRepeat] = useState<RepeatFilter>('all');
  const [eligibleOnly, setEligibleOnly] = useState(true);

  const handleContinue = () =>
    startCreate(async () => {
      const res = await createManualCampaignAction({
        name: name.trim() || `Reach-out ${new Date().toISOString().slice(0, 10)}`,
        propertyId,
        guestIds: [...selected],
      });
      if (res.success && res.id) {
        router.push(`/admin/campaigns/${res.id}`);
      } else {
        toast({ title: 'Could not create campaign', description: res.error, variant: 'destructive' });
      }
    });

  // Filters narrow the VIEW only; they never remove anyone from eligibility.
  // Sorted most-recent-stay first (recency is a soft signal, so it's a sort, not
  // a filter — a winter-stayer is just as eligible for a summer offer).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates
      .filter((c) => (eligibleOnly ? c.eligible : true))
      .filter((c) => (lang === 'all' ? true : c.language === lang))
      .filter((c) => (repeat === 'all' ? true : repeat === 'repeat' ? c.isRepeat : !c.isRepeat))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .sort((a, b) => (b.lastStayDate || '').localeCompare(a.lastStayDate || ''));
  }, [candidates, search, lang, repeat, eligibleOnly]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectableFiltered = filtered.filter((c) => c.eligible);
  const allFilteredSelected =
    selectableFiltered.length > 0 && selectableFiltered.every((c) => selected.has(c.guestId));
  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) selectableFiltered.forEach((c) => next.delete(c.guestId));
      else selectableFiltered.forEach((c) => next.add(c.guestId));
      return next;
    });

  const selectedCount = selected.size;
  const overCap = selectedCount > perRunCap;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name…"
            className="w-52 pl-8"
          />
        </div>
        <FilterGroup
          label="Lang"
          value={lang}
          onChange={(v) => setLang(v as LangFilter)}
          options={[['all', 'All'], ['ro', 'RO'], ['en', 'EN']]}
        />
        <FilterGroup
          label="Guest"
          value={repeat}
          onChange={(v) => setRepeat(v as RepeatFilter)}
          options={[['all', 'All'], ['repeat', 'Repeat'], ['once', 'One-time']]}
        />
        <Button
          size="sm"
          variant={eligibleOnly ? 'default' : 'outline'}
          className="h-7 px-2 text-xs"
          onClick={() => setEligibleOnly((v) => !v)}
        >
          Eligible only
        </Button>
      </div>

      {/* Count bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <strong>{selectedCount}</strong> selected · {eligibleCount} eligible · {filtered.length} shown
        </span>
        {overCap && (
          <span className="text-amber-600">
            Over the ~{perRunCap} WhatsApp-safe batch — consider splitting into rounds.
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  aria-label="Select all shown"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Lang</TableHead>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">Stays</TableHead>
              <TableHead>Last stay</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.guestId} className={c.eligible ? '' : 'opacity-60'}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    disabled={!c.eligible}
                    checked={selected.has(c.guestId)}
                    onChange={() => toggle(c.guestId)}
                    aria-label={`Select ${c.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="uppercase text-muted-foreground">{c.language}</TableCell>
                <TableCell className="text-muted-foreground">{c.country || '—'}</TableCell>
                <TableCell className="text-right">
                  {c.totalBookings}
                  {c.isRepeat ? <span className="ml-1 text-xs text-emerald-600">repeat</span> : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.lastStayDate || '—'}
                  {c.lastStaySeason ? <span className="ml-1 text-xs">({c.lastStaySeason})</span> : null}
                </TableCell>
                <TableCell>
                  {c.eligible ? (
                    <Badge variant="outline" className="text-emerald-700">
                      eligible
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{REASON_LABEL[c.ineligibleReason!]}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No guests match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Handoff to the message step (Gate 1): name the campaign, create it with the
          chosen audience, and move to compose. */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        <div className="flex items-center gap-2">
          <label htmlFor="campaign-name" className="text-sm text-muted-foreground">
            Name
          </label>
          <Input
            id="campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name"
            className="w-56"
          />
        </div>
        <Button disabled={selectedCount === 0 || creating} onClick={handleContinue}>
          {creating ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="mr-1 h-4 w-4" />
          )}
          Continue with {selectedCount} guest{selectedCount === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {options.map(([val, lbl]) => (
        <Button
          key={val}
          size="sm"
          variant={value === val ? 'default' : 'outline'}
          className="h-7 px-2 text-xs"
          onClick={() => onChange(val)}
        >
          {lbl}
        </Button>
      ))}
    </div>
  );
}
