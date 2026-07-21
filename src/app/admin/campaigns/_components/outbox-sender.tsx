'use client';

/**
 * Gate 2 — the manual send list (ban-safe by design: the server never touches
 * WhatsApp). For each queued message the owner taps "Open WhatsApp" (a wa.me
 * click-to-chat link that pre-fills the text — no auto-send), sends it by hand,
 * then taps "Mark sent". Marking sent records the final text and advances the
 * guest's frequency cap. The text stays editable up to the moment of sending.
 */
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageCircle, Check, CheckCheck } from 'lucide-react';
import type { OutboxMessage } from '@/types';
import { fetchCampaignOutboxAction, markSentAction, markCampaignSentAction } from '../actions';

/** wa.me needs digits only; the text is pre-filled but not auto-sent. */
function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export function OutboxSender({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<OutboxMessage[] | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [completing, startComplete] = useTransition();

  useEffect(() => {
    let alive = true;
    fetchCampaignOutboxAction(campaignId).then((res) => {
      if (!alive) return;
      if (res.success && res.rows) {
        setRows(res.rows);
        setEdited(Object.fromEntries(res.rows.map((r) => [r.id, r.finalText ?? r.body])));
      } else {
        toast({ title: 'Could not load the send list', description: res.error, variant: 'destructive' });
      }
    });
    return () => {
      alive = false;
    };
  }, [campaignId, toast]);

  const markSent = async (row: OutboxMessage) => {
    setPending((p) => new Set(p).add(row.id));
    const text = edited[row.id] ?? row.body;
    const res = await markSentAction(row.id, text);
    setPending((p) => {
      const next = new Set(p);
      next.delete(row.id);
      return next;
    });
    if (res.success) {
      setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, status: 'sent', finalText: text } : r)) ?? prev);
    } else {
      toast({ title: 'Could not mark sent', description: res.error, variant: 'destructive' });
    }
  };

  const complete = () =>
    startComplete(async () => {
      const res = await markCampaignSentAction(campaignId);
      if (res.success) {
        toast({ title: 'Campaign marked complete' });
        router.refresh();
      } else {
        toast({ title: 'Could not update campaign', description: res.error, variant: 'destructive' });
      }
    });

  if (!rows) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the send list…
        </CardContent>
      </Card>
    );
  }

  const sentCount = rows.filter((r) => r.status === 'sent').length;
  const total = rows.length;
  const allSent = total > 0 && sentCount === total;
  const pct = total > 0 ? Math.round((sentCount / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Send list</span>
          <Badge variant={status === 'sent' ? 'default' : 'secondary'}>{status}</Badge>
        </CardTitle>
        <CardDescription>
          Tap “Open WhatsApp”, send the message by hand, then “Mark sent”. You send from your own
          number — this is what keeps it ban-safe. Text stays editable until you send.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {sentCount} of {total} sent
            </span>
            {status !== 'sent' && (
              <Button size="sm" variant={allSent ? 'default' : 'outline'} onClick={complete} disabled={completing}>
                {completing ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="mr-1 h-4 w-4" />
                )}
                Mark campaign complete
              </Button>
            )}
          </div>
          <Progress value={pct} />
        </div>

        {total === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing queued. (If you expected messages here, some guests may have been skipped at the
            gateway — consent, suppression, an upcoming stay, or a recent message.)
          </p>
        )}

        <div className="space-y-3">
          {rows.map((row) => {
            const isSent = row.status === 'sent';
            const busy = pending.has(row.id);
            const text = edited[row.id] ?? row.body;
            return (
              <div key={row.id} className={`rounded-md border p-3 ${isSent ? 'bg-muted/40' : ''}`}>
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{row.phone}</span>
                  <span className="flex items-center gap-2">
                    <span className="uppercase">{row.language}</span>
                    {isSent ? (
                      <Badge variant="outline" className="text-emerald-700">
                        <Check className="mr-1 h-3 w-3" /> sent
                      </Badge>
                    ) : (
                      <Badge variant="secondary">pending</Badge>
                    )}
                  </span>
                </div>

                {isSent ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{row.finalText ?? row.body}</p>
                ) : (
                  <Textarea
                    value={text}
                    onChange={(e) => setEdited((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    rows={4}
                    className="text-sm"
                  />
                )}

                {!isSent && (
                  <div className="mt-2 flex items-center gap-2">
                    <a href={waLink(row.phone, text)} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">
                        <MessageCircle className="mr-1 h-4 w-4" /> Open WhatsApp
                      </Button>
                    </a>
                    <Button size="sm" onClick={() => markSent(row)} disabled={busy}>
                      {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                      Mark sent
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
