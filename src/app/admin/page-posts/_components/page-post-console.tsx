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
import { Loader2, Sparkles, Copy, ExternalLink, Check, Trash2 } from 'lucide-react';
import { generatePagePostAction, markPagePostedAction, discardPagePostAction, publishPagePostAction, syncPageEngagementAction } from '../actions';

interface PagePost {
  id: string;
  message: string;
  postType?: string;
  assetPath: string;
  assetUrl: string;
  assetUrls?: string[];
  status: string;
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

export function PagePostConsole({ propertyId, initialPosts, mix }: { propertyId: string; initialPosts: PagePost[]; mix?: Mix }) {
  const router = useRouter();
  const { toast } = useToast();
  const [generating, startGenerate] = useTransition();

  const [prompt, setPrompt] = useState('');
  // Defaults to whatever the mix is most short of, so the 60/25/15 ratio is the default rather than a
  // rule to remember. A page that managed 17 posts in six years needs one less thing to track.
  const [postType, setPostType] = useState<string>(mix?.suggestion ?? 'place');
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('');
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());

  const generate = () => {
    if (!prompt.trim()) {
      toast({ title: 'Add a prompt', description: 'What should the post be about?', variant: 'destructive' });
      return;
    }
    startGenerate(async () => {
      const res = await generatePagePostAction({ propertyId, prompt: prompt.trim(), postType: postType as never, goal: goal.trim() || undefined, audience: audience.trim() || undefined });
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
      const res = await markPagePostedAction(post.id, edited[post.id] ?? post.message);
      if (res.ok) {
        toast({ title: 'Marked posted' });
        router.refresh();
      } else {
        toast({ title: 'Could not update', description: res.error, variant: 'destructive' });
      }
    });

  const discard = (id: string) =>
    withPending(id, async () => {
      const res = await discardPagePostAction(id);
      if (res.ok) router.refresh();
      else toast({ title: 'Could not discard', description: res.error, variant: 'destructive' });
    });

  const drafts = initialPosts.filter((p) => p.status !== 'posted');
  const posted = initialPosts.filter((p) => p.status === 'posted');

  const publish = async (post: PagePost) => {
    setPending((p) => new Set(p).add(post.id));
    // Pass the EDITED caption, exactly as `markPosted` always has. Omitting it published the model's
    // draft instead of the operator's words, and reported success while doing it.
    const res = await publishPagePostAction(post.id, edited[post.id] ?? post.message);
    setPending((p) => { const n = new Set(p); n.delete(post.id); return n; });
    if (res.ok) { toast({ title: 'Published to the page' }); router.refresh(); }
    else toast({ title: 'Could not publish', description: res.error, variant: 'destructive' });
  };

  const syncEngagement = async () => {
    const res = await syncPageEngagementAction(propertyId);
    if (res.ok) { toast({ title: `Refreshed ${res.updated} post(s)` }); router.refresh(); }
    else toast({ title: 'Could not read engagement', description: res.error, variant: 'destructive' });
  };

  return (
    <div className="space-y-6">
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
              <Card key={post.id} className="max-w-4xl">
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
              <p className="line-clamp-2 flex-1 text-muted-foreground">{post.message}</p>
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
