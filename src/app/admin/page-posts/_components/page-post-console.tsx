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
import { generatePagePostAction, markPagePostedAction, discardPagePostAction } from '../actions';

interface PagePost {
  id: string;
  message: string;
  assetPath: string;
  assetUrl: string;
  status: string;
  goal?: string | null;
  audience?: string | null;
}

export function PagePostConsole({ propertyId, initialPosts }: { propertyId: string; initialPosts: PagePost[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [generating, startGenerate] = useTransition();

  const [prompt, setPrompt] = useState('');
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
      const res = await generatePagePostAction({ propertyId, prompt: prompt.trim(), goal: goal.trim() || undefined, audience: audience.trim() || undefined });
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

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" /> New page post
          </CardTitle>
          <CardDescription>Say what the post is about; the engine writes a warm caption in your voice and picks a fitting real photo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
          <h3 className="text-sm font-medium">Drafts — post these by hand</h3>
          {drafts.map((post) => {
            const busy = pending.has(post.id);
            const text = edited[post.id] ?? post.message;
            return (
              <Card key={post.id}>
                <CardContent className="grid gap-4 pt-6 sm:grid-cols-[160px_1fr]">
                  {post.assetUrl ? (
                    <div className="relative aspect-square overflow-hidden rounded-md border">
                      <Image src={post.assetUrl} alt="" fill className="object-cover" sizes="160px" />
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
                            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open photo
                          </Button>
                        </a>
                      )}
                      <Button size="sm" onClick={() => markPosted(post)} disabled={busy}>
                        {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />} Mark posted
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
          <h3 className="text-sm font-medium text-muted-foreground">Posted</h3>
          {posted.map((post) => (
            <div key={post.id} className="flex items-center gap-3 rounded-md border bg-muted/30 p-2 text-sm">
              {post.assetUrl && (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                  <Image src={post.assetUrl} alt="" fill className="object-cover" sizes="40px" />
                </div>
              )}
              <p className="line-clamp-2 flex-1 text-muted-foreground">{post.message}</p>
              <Badge variant="outline" className="text-emerald-700">
                <Check className="mr-1 h-3 w-3" /> posted
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
