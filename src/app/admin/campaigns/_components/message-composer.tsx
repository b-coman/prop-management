'use client';

/**
 * Gate 1 — compose + review + approve.
 *
 * The owner writes 2–3 short variants per language (v1 has no LLM drafter). We
 * render them against the real audience (fills {name}/{property}/{link}, rotates
 * variants, appends the STOP line) so the owner reads the ACTUAL messages before
 * committing. "Approve & queue" pushes every rendered message through the gateway
 * into the outbox — it does NOT send anything; the owner sends manually in Gate 2.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, Send, Plus, X, Users, Trash2 } from 'lucide-react';
import type { MessageVariant, LanguageCode } from '@/types';
import type { RenderedMessage, SkippedRender } from '@/services/campaignMessaging';
import { previewCampaignMessagesAction, approveAndQueueAction, discardDraftCampaignAction } from '../actions';

const LANGS: { code: LanguageCode; label: string }[] = [
  { code: 'ro', label: 'Romanian' },
  { code: 'en', label: 'English' },
];

const SKIP_LABEL: Record<SkippedRender['reason'], string> = {
  'guest-not-found': 'Guest not found',
  'no-phone': 'No WhatsApp number',
  'no-variant-for-language': 'No variant written for their language',
};

export function MessageComposer({
  campaignId,
  audienceCount,
  initialVariants,
}: {
  campaignId: string;
  audienceCount: number;
  initialVariants: MessageVariant[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [previewing, startPreview] = useTransition();
  const [approving, startApprove] = useTransition();
  const [discarding, startDiscard] = useTransition();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Group variants by language into editable text lists (default: one empty each).
  const [byLang, setByLang] = useState<Record<LanguageCode, string[]>>(() => {
    const init: Record<LanguageCode, string[]> = { ro: [], en: [] };
    for (const v of initialVariants) (init[v.language] ??= []).push(v.body);
    for (const { code } of LANGS) if (init[code].length === 0) init[code] = [''];
    return init;
  });

  const [rendered, setRendered] = useState<RenderedMessage[] | null>(null);
  const [skipped, setSkipped] = useState<SkippedRender[]>([]);
  // Any edit after a preview makes the preview stale — you must re-preview before
  // approving, so "approve exactly what you saw" always holds.
  const [dirty, setDirty] = useState(false);

  const setVariant = (lang: LanguageCode, i: number, value: string) => {
    setByLang((prev) => ({ ...prev, [lang]: prev[lang].map((v, idx) => (idx === i ? value : v)) }));
    setDirty(true);
  };
  const addVariant = (lang: LanguageCode) => {
    setByLang((prev) => ({ ...prev, [lang]: [...prev[lang], ''] }));
    setDirty(true);
  };
  const removeVariant = (lang: LanguageCode, i: number) => {
    setByLang((prev) => ({ ...prev, [lang]: prev[lang].filter((_, idx) => idx !== i) }));
    setDirty(true);
  };

  // Flatten to MessageVariant[], dropping blanks.
  const toVariants = (): MessageVariant[] =>
    LANGS.flatMap(({ code }) =>
      byLang[code].map((body) => body.trim()).filter(Boolean).map((body) => ({ language: code, body }))
    );

  const hasCopy = toVariants().length > 0;

  const preview = () =>
    startPreview(async () => {
      const res = await previewCampaignMessagesAction(campaignId, toVariants());
      if (res.success) {
        setRendered(res.rendered ?? []);
        setSkipped(res.skipped ?? []);
        setDirty(false);
      } else {
        toast({ title: 'Preview failed', description: res.error, variant: 'destructive' });
      }
    });

  const approve = () =>
    startApprove(async () => {
      const res = await approveAndQueueAction(campaignId, toVariants());
      if (res.success) {
        toast({
          title: `Queued ${res.queued ?? 0} message${res.queued === 1 ? '' : 's'}`,
          description: 'Nothing sent yet — send them from the list on the next screen.',
        });
        router.refresh(); // status → sending: page swaps to the send list (Gate 2)
      } else {
        toast({ title: 'Could not queue', description: res.error, variant: 'destructive' });
      }
    });

  const discard = () =>
    startDiscard(async () => {
      const res = await discardDraftCampaignAction(campaignId);
      if (res.success) {
        router.push('/admin/campaigns');
      } else {
        toast({ title: 'Could not discard', description: res.error, variant: 'destructive' });
        setConfirmDiscard(false);
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      {/* Compose */}
      <Card>
        <CardHeader>
          <CardTitle>Write the message</CardTitle>
          <CardDescription>
            2–3 short variants per language. We rotate them across guests (small wording
            differences keep WhatsApp happy). Use{' '}
            <code className="rounded bg-muted px-1">{'{name}'}</code>,{' '}
            <code className="rounded bg-muted px-1">{'{property}'}</code>,{' '}
            <code className="rounded bg-muted px-1">{'{link}'}</code> — filled per guest. A STOP
            opt-out line is appended automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {LANGS.map(({ code, label }) => (
            <div key={code} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="uppercase">
                  {code}
                </Badge>
                <span className="text-sm font-medium">{label}</span>
              </div>
              {byLang[code].map((body, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Textarea
                    value={body}
                    onChange={(e) => setVariant(code, i, e.target.value)}
                    placeholder={code === 'ro' ? 'Salut {name}, …' : 'Hi {name}, …'}
                    rows={3}
                    className="flex-1"
                  />
                  {byLang[code].length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="mt-1 h-8 w-8 shrink-0"
                      onClick={() => removeVariant(code, i)}
                      aria-label="Remove variant"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => addVariant(code)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add {label} variant
              </Button>
            </div>
          ))}

          <div className="flex items-center gap-2 border-t pt-4">
            <Button variant="outline" onClick={preview} disabled={!hasCopy || previewing}>
              {previewing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Eye className="mr-1 h-4 w-4" />}
              Preview messages
            </Button>
            <Button onClick={approve} disabled={!rendered || rendered.length === 0 || approving || dirty}>
              {approving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              Approve &amp; queue{rendered && !dirty ? ` (${rendered.length})` : ''}
            </Button>
          </div>
          {(!rendered || dirty) && hasCopy && (
            <p className="text-xs text-muted-foreground">
              {dirty ? 'Copy changed — preview again before approving.' : 'Preview first — you approve exactly what you saw.'}
            </p>
          )}

          <div className="pt-2">
            {confirmDiscard ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Delete this draft?</span>
                <Button size="sm" variant="destructive" className="h-7" onClick={discard} disabled={discarding}>
                  {discarding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Yes, discard'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setConfirmDiscard(false)} disabled={discarding}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmDiscard(true)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Discard draft
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> Review
          </CardTitle>
          <CardDescription>
            {rendered
              ? `${rendered.length} message${rendered.length === 1 ? '' : 's'} ready · ${skipped.length} skipped · ${audienceCount} in audience`
              : `${audienceCount} guest${audienceCount === 1 ? '' : 's'} selected. Preview to see each rendered message.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!rendered && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing to review yet — write your copy and hit “Preview messages”.
            </p>
          )}

          {rendered && rendered.length > 0 && (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {rendered.map((m) => (
                <div key={m.guestId} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{m.name || '(no name)'}</span>
                    <span>
                      {m.phone} · <span className="uppercase">{m.language}</span> · variant {m.variantIndex + 1}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                </div>
              ))}
            </div>
          )}

          {rendered && rendered.length === 0 && (
            <p className="py-6 text-center text-sm text-amber-600">
              No messages rendered. Check that you wrote a variant for each language below.
            </p>
          )}

          {skipped.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="mb-1 font-medium text-amber-800">Skipped ({skipped.length})</p>
              <ul className="space-y-0.5 text-amber-700">
                {skipped.map((s) => (
                  <li key={s.guestId}>
                    {s.name || s.guestId} — {SKIP_LABEL[s.reason]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
