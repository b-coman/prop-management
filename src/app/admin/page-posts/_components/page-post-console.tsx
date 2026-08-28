'use client';

/**
 * Page-post console — generate a warm organic post, review it, and post it BY HAND (copy the caption,
 * open the photo, post from your own account, mark it done). Ban-safe, no page-scope needed. Mirrors
 * the ads generate flow + the wa.me manual-send philosophy.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Copy, ExternalLink, Check, Trash2, CalendarRange, Wand2 } from 'lucide-react';
import { generatePagePostAction, markPagePostedAction, discardPagePostAction, publishPagePostAction, syncPageEngagementAction, schedulePagePostAction, planFortnightAction, generateSlotAction } from '../actions';
import type { Slate, PlannedSlot } from '@/services/growth/fortnightPlanner';

interface PagePost {
  id: string;
  message: string;
  postType?: string;
  assetPath: string;
  assetUrl: string;
  assetUrls?: string[];
  status: string;
  /** What the page actually shows — set by the engagement sync, and not always what we published. */
  publishedMessage?: string;
  scheduledFor?: string;
  /** Set on drafts written by the fortnight planner — the time the slate intends for them. */
  plannedFor?: string;
  plannedWhy?: string;
  permalink?: string;
  reactions?: number;
  comments?: number;
  shares?: number;
  goal?: string | null;
  audience?: string | null;
}

interface Mix {
  counts: Record<string, number>;
  targets: Record<string, number>;
  total: number;
  suggestion: string;
}

/** What each type is for, in the words the strategy uses. */
const TYPE_HELP: Record<string, string> = {
  place: 'the chalet and the season · no offer, no link · earns reach',
  proof: 'guests, a review, the place in use · ends in a question · earns replies',
  offer: 'real dates and a real price · the only type that may link · converts',
};

/** An ISO instant as the value an `<input type="datetime-local">` wants: the BROWSER's wall clock,
 *  which is exactly what `new Date(value)` reads back on submit. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** The same instant as a Romanian reader would say it. */
const roWhen = (iso: string) =>
  new Date(iso).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function PagePostConsole({ propertyId, initialPosts, mix }: { propertyId: string; initialPosts: PagePost[]; mix?: Mix }) {
  const router = useRouter();
  const { toast } = useToast();
  const [generating, startGenerate] = useTransition();

  const [prompt, setPrompt] = useState('');
  // Defaults to whatever the mix is most short of, so the 60/25/15 ratio is the default rather than a
  // rule to remember. A page that managed 17 posts in six years needs one less thing to track.
  const [postType, setPostType] = useState<string>(mix?.suggestion ?? 'place');
  const [when, setWhen] = useState<Record<string, string>>({});
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('');
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [slate, setSlate] = useState<Slate | null>(null);
  const [planning, startPlan] = useTransition();
  const [slotBriefs, setSlotBriefs] = useState<Record<number, string>>({});
  /** null = idle; otherwise which slot of how many is being written right now. */
  const [filling, setFilling] = useState<{ at: number; of: number } | null>(null);

  /**
   * Every server action on this page goes through this. Next keys an action to an id baked into the
   * BUILD, so a deploy while the page sits open makes the call fail before our code runs. That is
   * exactly what happened on 28 Aug: a revision shipped 33 seconds after the draft was generated,
   * and Schedule then did NOTHING — no post, no error, no toast — because nothing here caught the
   * rejection. A button that fails silently is worse than one that fails loudly.
   */
  const call = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch {
      toast({
        title: 'That did not reach the server',
        description: 'This page is probably left over from an earlier version of the site. Reload it and try again — nothing was sent.',
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const generate = () => {
    if (!prompt.trim()) {
      toast({ title: 'Add a prompt', description: 'What should the post be about?', variant: 'destructive' });
      return;
    }
    startGenerate(async () => {
      const res = await call(() => generatePagePostAction({ propertyId, prompt: prompt.trim(), postType: postType as never, goal: goal.trim() || undefined, audience: audience.trim() || undefined }));
      if (!res) return;
      if (res.ok) {
        toast({ title: 'Post drafted', description: 'Review it below, then post it by hand.' });
        setPrompt('');
        router.refresh();
      } else {
        toast({ title: 'Could not generate', description: res.error, variant: 'destructive' });
      }
    });
  };

  const withPending = async (id: string, fn: () => Promise<void>) => {
    setPending((p) => new Set(p).add(id));
    await fn();
    setPending((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
  };

  const markPosted = (post: PagePost) =>
    withPending(post.id, async () => {
      const res = await call(() => markPagePostedAction(post.id, edited[post.id] ?? post.message));
      if (!res) return;
      if (res.ok) {
        toast({ title: 'Marked posted' });
        router.refresh();
      } else {
        toast({ title: 'Could not update', description: res.error, variant: 'destructive' });
      }
    });

  const discard = (id: string) =>
    withPending(id, async () => {
      const res = await call(() => discardPagePostAction(id));
      if (!res) return;
      if (res.ok) router.refresh();
      else toast({ title: 'Could not discard', description: res.error, variant: 'destructive' });
    });

  // 'scheduled' is NOT a draft. It showed in both lists after the first real schedule, which left a
  // live "Publish to page" button on a post Meta was already holding — one click from a double post.
  const drafts = initialPosts.filter((p) => p.status !== 'posted' && p.status !== 'scheduled');
  const posted = initialPosts.filter((p) => p.status === 'posted');
  const scheduled = initialPosts
    .filter((p) => p.status === 'scheduled')
    .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''));

  const publish = async (post: PagePost) => {
    setPending((p) => new Set(p).add(post.id));
    // Pass the EDITED caption, exactly as `markPosted` always has. Omitting it published the model's
    // draft instead of the operator's words, and reported success while doing it.
    const res = await call(() => publishPagePostAction(post.id, edited[post.id] ?? post.message));
    setPending((p) => { const n = new Set(p); n.delete(post.id); return n; });
    if (!res) return;
    if (res.ok) { toast({ title: 'Published to the page' }); router.refresh(); }
    else toast({ title: 'Could not publish', description: res.error, variant: 'destructive' });
  };

  const schedule = async (post: PagePost) => {
    // The field SHOWS the planned time for a planned draft, so pressing Schedule without touching it
    // must use that time rather than complain the field is empty.
    const at = when[post.id] ?? (post.plannedFor ? toLocalInput(post.plannedFor) : '');
    if (!at) { toast({ title: 'Pick a date and time first', variant: 'destructive' }); return; }
    setPending((p) => new Set(p).add(post.id));
    const res = await call(() => schedulePagePostAction(post.id, new Date(at).toISOString(), edited[post.id] ?? post.message));
    setPending((p) => { const n = new Set(p); n.delete(post.id); return n; });
    if (!res) return;
    if (res.ok) { toast({ title: `Scheduled for ${new Date(res.scheduledFor).toLocaleString('ro-RO')}` }); router.refresh(); }
    else toast({ title: 'Could not schedule', description: res.error, variant: 'destructive' });
  };

  const plan = () =>
    startPlan(async () => {
      const res = await call(() => planFortnightAction(propertyId, 4));
      if (!res) return;
      if (!res.ok) { toast({ title: 'Could not plan', description: res.error, variant: 'destructive' }); return; }
      setSlate(res.slate);
      setSlotBriefs({});
    });

  /**
   * Write the slate, one slot at a time. Sequential ON PURPOSE — each call reads the rotation the
   * previous one just wrote, so slot 2 cannot reuse slot 1's photos, and a slot that fails leaves
   * the ones before it intact instead of losing the batch.
   */
  const fillSlate = async () => {
    if (!slate) return;
    const failures: string[] = [];
    for (let i = 0; i < slate.slots.length; i++) {
      setFilling({ at: i + 1, of: slate.slots.length });
      const slot: PlannedSlot = { ...slate.slots[i], brief: slotBriefs[i] ?? slate.slots[i].brief };
      const res = await call(() => generateSlotAction(propertyId, slot));
      if (!res) { setFilling(null); return; }
      if (!res.ok) failures.push(`${slot.postType}: ${res.error}`);
    }
    setFilling(null);
    setSlate(null);
    router.refresh();
    toast(
      failures.length
        ? { title: `Wrote ${slate.slots.length - failures.length} of ${slate.slots.length}`, description: failures.join(' · '), variant: 'destructive' }
        : { title: `${slate.slots.length} drafts written`, description: 'Review them below, then schedule.' }
    );
  };

  /** Schedule every planned draft at the time the slate chose for it. */
  const scheduleAllPlanned = async () => {
    const queue = initialPosts.filter((p) => p.status === 'draft' && p.plannedFor);
    if (!queue.length) return;
    const failures: string[] = [];
    for (const post of queue) {
      const res = await call(() => schedulePagePostAction(post.id, post.plannedFor!, edited[post.id] ?? post.message));
      if (!res) return;
      if (!res.ok) failures.push(`${post.postType}: ${res.error}`);
    }
    router.refresh();
    toast(
      failures.length
        ? { title: `Scheduled ${queue.length - failures.length} of ${queue.length}`, description: failures.join(' · '), variant: 'destructive' }
        : { title: `${queue.length} posts scheduled`, description: 'Meta is holding them.' }
    );
  };

  const syncEngagement = async () => {
    const res = await call(() => syncPageEngagementAction(propertyId));
    if (!res) return;
    if (res.ok) { toast({ title: `Refreshed ${res.updated} post(s)` }); router.refresh(); }
    else toast({ title: 'Could not read engagement', description: res.error, variant: 'destructive' });
  };

  const plannedDrafts = initialPosts.filter((p) => p.status === 'draft' && p.plannedFor);

  return (
    <div className="space-y-6">
      {/* ── the fortnight planner ────────────────────────────────────────────
          Planning is READ-ONLY and free: no words are written until "Write these
          four" is pressed, so the operator argues with the plan, not with four
          finished posts he then has to throw away. */}
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" /> The next fortnight</CardTitle>
          <CardDescription>
            Two posts a week, planned against what is actually true right now — the free nights and their real prices, the
            holiday calendar, the reviews nobody has quoted yet, and the photos not used recently. Nothing is written until you say so.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!slate && (
            <Button onClick={plan} disabled={planning} variant="secondary">
              {planning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarRange className="mr-2 h-4 w-4" />}
              Plan the next fortnight
            </Button>
          )}

          {slate && (
            <div className="space-y-4">
              {slate.slots.map((slot, i) => {
                const alt = slot.anchor.kind === 'subject' ? slot.anchor.alternatives : [];
                return (
                  <div key={i} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="capitalize">{slot.postType}</Badge>
                      <span className="text-sm font-medium">{roWhen(slot.publishAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{slot.why}</p>
                    {/* The brief is editable: the planner proposes a subject from what is available,
                        but which subject makes a good post is the operator's call until the page has
                        enough engagement data to answer it. */}
                    <Textarea
                      rows={5}
                      className="font-mono text-[11px]"
                      value={slotBriefs[i] ?? slot.brief}
                      onChange={(e) => setSlotBriefs((prev) => ({ ...prev, [i]: e.target.value }))}
                    />
                    {alt.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        other subjects with enough free photos: {alt.map((a) => `${a.tag} (${a.photos})`).join(' · ')}
                      </p>
                    )}
                  </div>
                );
              })}

              <div className="space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p>
                  <strong>Photos:</strong> {slate.diagnostics.photoBudget.library} in the library, {slate.diagnostics.photoBudget.lockedByRotation} resting,
                  {' '}{slate.diagnostics.photoBudget.neededForSlate} needed here — about{' '}
                  <strong>{slate.diagnostics.photoBudget.weeksOfRunway} weeks</strong> before the page must repeat itself.
                </p>
                {slate.diagnostics.photoBudget.thin.map((t, i) => <p key={i}>· {t}</p>)}
                {slate.diagnostics.notes.map((n, i) => <p key={`n${i}`}>· {n}</p>)}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={fillSlate} disabled={!!filling}>
                  {filling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  {filling ? `Writing ${filling.at} of ${filling.of}…` : `Write these ${slate.slots.length}`}
                </Button>
                <Button variant="ghost" onClick={() => setSlate(null)} disabled={!!filling}>Discard the plan</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {plannedDrafts.length > 0 && (
        <Card className="max-w-4xl border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm">
              <strong>{plannedDrafts.length}</strong> planned draft{plannedDrafts.length === 1 ? '' : 's'} below, each with a time already chosen.
              Edit any caption first — scheduling sends what you see.
            </p>
            <Button size="sm" onClick={scheduleAllPlanned}>Schedule all at their planned times</Button>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" /> New page post
          </CardTitle>
          <CardDescription>Say what the post is about; the engine writes a warm caption in your voice and picks an album of real photos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* The 60/25/15 mix, visible instead of remembered. */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['place', 'proof', 'offer'] as const).map((t) => {
                const share = mix && mix.total ? Math.round(((mix.counts[t] ?? 0) / mix.total) * 100) : 0;
                const target = Math.round((mix?.targets[t] ?? 0) * 100);
                const selected = postType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPostType(t)}
                    className={`rounded-md border p-2 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'hover:border-foreground/30'}`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{t}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{share}% / {target}%</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{TYPE_HELP[t]}</span>
                  </button>
                );
              })}
            </div>
            {mix ? (
              <p className="text-xs text-muted-foreground">
                {mix.total
                  ? <>Last {mix.total} posted · most behind target: <strong className="capitalize">{mix.suggestion}</strong></>
                  : <>Nothing posted yet — start with <strong>place</strong> to re-earn reach.</>}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="prompt">What&apos;s the post about?</Label>
            <Textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="e.g. Early-autumn hello — golden leaves, quiet mornings, the fire pit ready for cool evenings" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="goal">Goal (optional)</Label>
              <Input id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. keep the page warm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="audience">Audience (optional)</Label>
              <Input id="audience" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. couples who love the outdoors" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate post
          </Button>
        </CardFooter>
      </Card>

      {drafts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Drafts — review, then publish</h3>
          {drafts.map((post) => {
            const busy = pending.has(post.id);
            const text = edited[post.id] ?? post.message;
            return (
              <Card key={post.id} className={post.plannedFor ? 'max-w-4xl border-primary/40' : 'max-w-4xl'}>
                {post.plannedFor && (
                  <CardHeader className="pb-0">
                    <CardDescription className="text-xs">
                      planned for <strong className="text-foreground">{roWhen(post.plannedFor)}</strong>
                      {post.plannedWhy ? ` · ${post.plannedWhy}` : ''}
                    </CardDescription>
                  </CardHeader>
                )}
                <CardContent className="grid gap-4 pt-6 sm:grid-cols-[160px_1fr]">
                  {/* Albums, shown as albums — this page's five best posts are all multi-photo. */}
                  {(post.assetUrls?.length ? post.assetUrls : [post.assetUrl]).filter(Boolean).length ? (
                    <div className="space-y-1">
                      <div className="grid grid-cols-2 gap-1">
                        {(post.assetUrls?.length ? post.assetUrls : [post.assetUrl]).filter(Boolean).slice(0, 4).map((u, i) => (
                          <div key={i} className="relative aspect-square overflow-hidden rounded border">
                            <Image src={u} alt="" fill className="object-cover" sizes="80px" />
                          </div>
                        ))}
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {(post.assetUrls?.length ?? 1)} photo{(post.assetUrls?.length ?? 1) === 1 ? '' : 's'}
                        {post.postType ? ` · ${post.postType}` : ''}
                      </p>
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-md border text-xs text-muted-foreground">no preview</div>
                  )}
                  <div className="space-y-2">
                    <Textarea value={text} onChange={(e) => setEdited((prev) => ({ ...prev, [post.id]: e.target.value }))} rows={5} className="text-sm" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(text); toast({ title: 'Caption copied' }); }}>
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copy caption
                      </Button>
                      {post.assetUrl && (
                        <a href={post.assetUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open photos
                          </Button>
                        </a>
                      )}
                      <Button size="sm" onClick={() => publish(post)} disabled={busy}>
                        {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />} Publish to page
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => markPosted(post)} disabled={busy}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Posted by hand
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => discard(post.id)} disabled={busy}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Discard
                      </Button>
                    </div>
                    {/* Meta holds scheduled posts and publishes them itself, so the queue survives us
                        being down. An offer must be seen BEFORE the weekend it is about — the action
                        refuses Fri/Sat/Sun for offers rather than letting one land too late. */}
                    <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                      <Input
                        type="datetime-local"
                        value={when[post.id] ?? (post.plannedFor ? toLocalInput(post.plannedFor) : '')}
                        onChange={(e) => setWhen((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        className="h-9 w-[210px] text-sm"
                      />
                      <Button size="sm" variant="secondary" onClick={() => schedule(post)} disabled={busy}>
                        Schedule
                      </Button>
                      {post.postType === 'offer' && (
                        <span className="text-[11px] text-muted-foreground">offers go out Tue or Wed, ahead of the weekend</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {scheduled.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Scheduled</h3>
          {scheduled.map((post) => (
            <div key={post.id} className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
              {post.assetUrl && (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                  <Image src={post.assetUrl} alt="" fill className="object-cover" sizes="40px" />
                </div>
              )}
              <p className="line-clamp-2 flex-1 text-muted-foreground">{post.message}</p>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {post.scheduledFor ? new Date(post.scheduledFor).toLocaleString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
              <Badge variant="outline" className="shrink-0">{post.postType ?? 'place'}</Badge>
            </div>
          ))}
        </div>
      )}

      {posted.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Posted</h3>
            <Button size="sm" variant="ghost" onClick={syncEngagement}>Refresh engagement</Button>
          </div>
          {posted.map((post) => (
            <div key={post.id} className="flex items-center gap-3 rounded-md border bg-muted/30 p-2 text-sm">
              {post.assetUrl && (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                  <Image src={post.assetUrl} alt="" fill className="object-cover" sizes="40px" />
                </div>
              )}
              {/* Prefer what is ON THE PAGE. The owner edited his first post on Facebook after
                  publishing, so our stored draft no longer matched what anyone can actually read —
                  and this list was showing him words that are not on his page. */}
              <p className="line-clamp-2 flex-1 text-muted-foreground">{post.publishedMessage ?? post.message}</p>
              {/* Six years, one comment. Comments first, because that is the number the strategy is
                  trying to move — reach on a revived page recovers on its own. */}
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {post.comments ?? 0} comm · {post.reactions ?? 0} react · {post.shares ?? 0} sh
              </span>
              {post.permalink ? (
                <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <Badge variant="outline" className="shrink-0 text-emerald-700">
                <Check className="mr-1 h-3 w-3" /> posted
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
