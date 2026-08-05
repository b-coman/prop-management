'use client';

/**
 * The capture surface for everything that happens off WhatsApp.
 *
 * Built for the moment right after hanging up, on a phone: type a few digits or letters, tap the
 * person (or open a record straight from an unknown number), say what happened, save. Anything that
 * is not that — the lead's reason, the dates they wanted, the fact toggle — sits below the fold and
 * stays optional, because a capture flow that asks for classification first is a capture flow that
 * does not get used.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Phone, User, Search, Trash2, Plus, MessageSquare, ExternalLink } from 'lucide-react';
import {
  addNoteAction, createLeadAction, deleteNoteAction, fetchContactDetailAction,
  setLeadReasonAction, addRequestedPeriodAction,
  type ContactRow, type ContactDetail,
} from '../actions';
import type { GuestNoteKind, NonConversionReason, RequestedPeriod } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);
const digits = (s: string) => s.replace(/[^0-9]/g, '');

const KIND_LABEL: Record<GuestNoteKind, string> = { call: 'Phone call', inperson: 'In person', observation: 'Noticed' };
const REASONS: Array<{ value: NonConversionReason; label: string; hint: string }> = [
  { value: 'unavailable', label: 'We were full', hint: 'We could not host them — nothing went wrong. Safe to reach out when something opens.' },
  { value: 'declined', label: 'They passed', hint: 'Price, or they went elsewhere. Do not re-offer the same terms.' },
  { value: 'unservable', label: 'We cannot serve it', hint: 'Structural — payment method, capacity, pets. Leave it unless something changed.' },
  { value: 'unresolved', label: 'Just fizzled', hint: 'No conclusion. A light re-open, not a follow-up.' },
];

export function ContactConsole({ contacts, propertyId, initialGuestId }: {
  contacts: ContactRow[];
  propertyId: string;
  initialGuestId?: string;   // deep link from a guest record: /admin/contacts?guestId=…
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ContactRow | null>(
    () => (initialGuestId ? contacts.find((c) => c.id === initialGuestId) ?? null : null),
  );
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [rows, setRows] = useState(contacts);

  // Load the deep-linked contact's detail once on mount; clicks go through open() instead.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || !selected) return;
    didInit.current = true;
    startTransition(async () => setDetail(await fetchContactDetailAction(selected.id)));
  }, [selected]);

  // note composer
  const [text, setText] = useState('');
  const [kind, setKind] = useState<GuestNoteKind>('call');
  const [occurredAt, setOccurredAt] = useState(today());
  const [assertable, setAssertable] = useState(false);
  const [factValue, setFactValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // lead extras
  const [reqStart, setReqStart] = useState('');
  const [reqEnd, setReqEnd] = useState('');
  const [reqOutcome, setReqOutcome] = useState<RequestedPeriod['outcome']>('unavailable');

  const q = query.trim().toLowerCase();
  const qDigits = digits(query);
  const matches = useMemo(() => {
    if (!q) return rows.slice(0, 12);
    return rows.filter((c) =>
      c.name.toLowerCase().includes(q) || (qDigits.length >= 3 && digits(c.phone).includes(qDigits))
    ).slice(0, 30);
  }, [rows, q, qDigits]);

  // A number we have never seen is the common case after a call from a stranger.
  const unknownNumber = qDigits.length >= 9 && !rows.some((c) => digits(c.phone).slice(-9) === qDigits.slice(-9));

  function open(c: ContactRow) {
    setSelected(c);
    setDetail(null);
    resetComposer();
    startTransition(async () => setDetail(await fetchContactDetailAction(c.id)));
  }

  function resetComposer() {
    setText(''); setKind('call'); setOccurredAt(today());
    setAssertable(false); setFactValue(''); setExpiresAt('');
    setReqStart(''); setReqEnd(''); setReqOutcome('unavailable');
  }

  function refreshDetail(id: string) {
    startTransition(async () => setDetail(await fetchContactDetailAction(id)));
  }

  function createLead() {
    startTransition(async () => {
      const res = await createLeadAction({ phone: query.trim(), propertyId, leadSource: 'phone' });
      if (!res.ok || !res.id) { toast({ title: 'Could not create', description: res.error, variant: 'destructive' }); return; }
      const row: ContactRow = {
        id: res.id, name: '', phone: query.trim(), kind: 'lead', lastStay: null,
        firstContactAt: today(), nonConversionReason: null, messages: 0, inbound: 0, notes: 0,
        lastContact: today(), unsubscribed: false,
      };
      setRows((prev) => [row, ...prev]);
      setQuery('');
      open(row);
      toast({ title: res.created ? 'Lead created' : 'Already known', description: 'Now write what happened.' });
    });
  }

  function saveNote() {
    if (!selected) return;
    startTransition(async () => {
      const res = await addNoteAction({
        guestId: selected.id, text, kind, occurredAt, assertable,
        ...(assertable && factValue.trim() ? { factKey: 'fromCall', factValue: factValue.trim() } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      });
      if (!res.ok) { toast({ title: 'Not saved', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Noted', description: assertable ? 'Usable as a fact in future messages.' : 'Kept as context.' });
      setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, notes: r.notes + 1, lastContact: occurredAt } : r)));
      resetComposer();
      refreshDetail(selected.id);
    });
  }

  function saveReason(reason: NonConversionReason) {
    if (!selected) return;
    startTransition(async () => {
      const res = await setLeadReasonAction(selected.id, reason);
      if (!res.ok) { toast({ title: 'Not saved', description: res.error, variant: 'destructive' }); return; }
      setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, nonConversionReason: reason } : r)));
      setSelected({ ...selected, nonConversionReason: reason });
      refreshDetail(selected.id);
    });
  }

  function savePeriod() {
    if (!selected || !reqStart || !reqEnd) return;
    startTransition(async () => {
      const res = await addRequestedPeriodAction({ guestId: selected.id, start: reqStart, end: reqEnd, outcome: reqOutcome });
      if (!res.ok) { toast({ title: 'Not saved', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Recorded', description: 'Also counted as demand we could not fill.' });
      setReqStart(''); setReqEnd('');
      refreshDetail(selected.id);
    });
  }

  function removeNote(noteId: string) {
    if (!selected) return;
    startTransition(async () => {
      await deleteNoteAction(noteId, selected.id);
      setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, notes: Math.max(0, r.notes - 1) } : r)));
      refreshDetail(selected.id);
    });
  }

  return (
    <div className="space-y-4">
      {/* ── search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or phone number…"
          className="pl-9 h-12 text-base"
          inputMode="search"
          autoComplete="off"
        />
      </div>

      {unknownNumber && (
        <Button onClick={createLead} disabled={pending} className="w-full h-12" variant="secondary">
          <Plus className="h-4 w-4 mr-2" />
          New lead from {query.trim()}
        </Button>
      )}

      {/* ── results ── */}
      {!selected && (
        <div className="space-y-2">
          {matches.length === 0 && !unknownNumber && (
            <p className="text-sm text-muted-foreground py-6 text-center">No one matches that.</p>
          )}
          {matches.map((c) => (
            <button
              key={c.id}
              onClick={() => open(c)}
              className="w-full text-left rounded-lg border p-3 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{c.name || <span className="text-muted-foreground italic">no name</span>}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {c.kind === 'lead' && <Badge variant="outline" className="text-xs">lead</Badge>}
                  {c.unsubscribed && <Badge variant="destructive" className="text-xs">unsub</Badge>}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">{c.phone}</span>
                {c.messages > 0 && <span>{c.messages} msg ({c.inbound} in)</span>}
                {c.notes > 0 && <span>{c.notes} note{c.notes > 1 ? 's' : ''}</span>}
                {c.lastContact && <span>last {c.lastContact}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── selected contact ── */}
      {selected && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-lg truncate">
                    {selected.name || <span className="text-muted-foreground italic font-normal">no name on WhatsApp</span>}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground font-mono mt-0.5">{selected.phone}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setDetail(null); }}>
                  Change
                </Button>
              </div>
              {detail && (
                <p className="text-xs text-muted-foreground pt-1">
                  {selected.kind === 'lead' ? 'Never stayed. ' : ''}
                  {detail.messageCount} message{detail.messageCount === 1 ? '' : 's'} ({detail.inboundCount} from them)
                  {detail.callCount > 0 && ` · ${detail.callCount} logged call${detail.callCount > 1 ? 's' : ''}`}
                  {selected.lastStay && ` · last stay ${selected.lastStay}`}
                </p>
              )}
            </CardHeader>
          </Card>

          {/* ── the primary action ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What happened?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="We spoke on the phone. He liked the place a lot, wanted 16–21 Aug but we were full. Said he'd come another time."
                className="text-base"
              />

              <div className="flex flex-wrap gap-2">
                {(Object.keys(KIND_LABEL) as GuestNoteKind[]).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant={kind === k ? 'default' : 'outline'}
                    onClick={() => setKind(k)}
                  >
                    {KIND_LABEL[k]}
                  </Button>
                ))}
                <Input
                  type="date"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="h-9 w-auto"
                />
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="assertable" className="text-sm">Can be mentioned back to them</Label>
                    <p className="text-xs text-muted-foreground">
                      Off by default: the note still shapes tone and counts as contact, but nothing here will be
                      stated as fact in a future message.
                    </p>
                  </div>
                  <Switch id="assertable" checked={assertable} onCheckedChange={setAssertable} />
                </div>

                {assertable && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <Label htmlFor="fact" className="text-xs">The one thing worth saying back (optional)</Label>
                      <Input
                        id="fact"
                        value={factValue}
                        onChange={(e) => setFactValue(e.target.value)}
                        placeholder="said he'd like to come another time"
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty to make the whole note usable.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="expires" className="text-xs">Stop using it after (optional)</Label>
                      <Input id="expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="text-sm w-auto" />
                      <p className="text-xs text-muted-foreground">
                        For anything with a shelf life — &ldquo;planning something for October&rdquo; is useless in December.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={saveNote} disabled={pending || text.trim().length < 3} className="w-full h-11">
                Save note
              </Button>
            </CardContent>
          </Card>

          {/* ── lead-only: why it didn't happen, and what they wanted ── */}
          {selected.kind === 'lead' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Why it didn&apos;t happen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {REASONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => saveReason(r.value)}
                      disabled={pending}
                      className={`w-full text-left rounded-md border p-2.5 transition-colors ${
                        detail?.nonConversionReason === r.value ? 'border-primary bg-accent' : 'hover:bg-accent'
                      }`}
                    >
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.hint}</div>
                    </button>
                  ))}
                </div>

                <div className="border-t pt-3 space-y-2">
                  <Label className="text-sm">Dates they asked for</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="date" value={reqStart} onChange={(e) => setReqStart(e.target.value)} className="h-9 w-auto" />
                    <span className="text-muted-foreground text-sm">→</span>
                    <Input type="date" value={reqEnd} onChange={(e) => setReqEnd(e.target.value)} className="h-9 w-auto" />
                    <Select value={reqOutcome} onValueChange={(v) => setReqOutcome(v as RequestedPeriod['outcome'])}>
                      <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unavailable">we were full</SelectItem>
                        <SelectItem value="declined">they passed</SelectItem>
                        <SelectItem value="booked">they booked</SelectItem>
                        <SelectItem value="unresolved">unresolved</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="secondary" onClick={savePeriod} disabled={pending || !reqStart || !reqEnd}>
                      Add
                    </Button>
                  </div>
                  {detail?.requestedPeriods.length ? (
                    <ul className="text-xs text-muted-foreground space-y-1 pt-1">
                      {detail.requestedPeriods.map((p, i) => (
                        <li key={i}>{p.start} → {p.end} · {p.outcome} <span className="opacity-70">(asked {p.askedOn})</span></li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Worth adding even when they never book — a window we keep missing is a pricing signal.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── history ── */}
          {detail && (detail.notes.length > 0 || detail.recentMessages.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {detail.notes.length > 0 && (
                  <ul className="space-y-2">
                    {detail.notes.slice().reverse().map((n) => (
                      <li key={n.id} className="rounded-md border p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{n.occurredAt}</span>
                              <span>{KIND_LABEL[n.kind]}</span>
                              {n.assertable
                                ? <Badge variant="secondary" className="text-[10px] py-0">quotable</Badge>
                                : <Badge variant="outline" className="text-[10px] py-0">context</Badge>}
                              {n.expiresAt && <span className="opacity-70">until {n.expiresAt}</span>}
                            </div>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{n.text}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => removeNote(n.id)} disabled={pending}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {detail.recentMessages.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" /> Last WhatsApp messages
                    </p>
                    {detail.recentMessages.map((m, i) => (
                      <div key={i} className="text-xs">
                        <span className="text-muted-foreground font-mono">{m.ts.slice(0, 10)} {m.direction === 'out' ? '→' : '←'} </span>
                        <span className="text-muted-foreground">{m.text.slice(0, 140)}{m.text.length > 140 ? '…' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selected.kind === 'guest' && (
                  <Button variant="ghost" size="sm" asChild className="px-0">
                    <Link href={`/admin/guests/${selected.id}`}>
                      <User className="h-3.5 w-3.5 mr-1.5" /> Full guest record
                      <ExternalLink className="h-3 w-3 ml-1.5" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
