'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Send, Loader2, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import {
  DEFAULT_RO_MESSAGE_TEMPLATE,
  buildReengagementCsv,
  buildReengagementMessage,
  seasonPhraseRO,
  tidyFirstName,
  type ReengagementContact,
} from '@/lib/guest-reengagement';
import { fetchReengagementContactsAction } from '../actions';

interface LoadResult {
  contacts: ReengagementContact[];
  unsubscribedExcluded: number;
  noPhoneExcluded: number;
  calendarLink: string;
}

/** Resolve a possibly-relative calendar link to an absolute URL using the current origin. */
function absoluteLink(link: string): string {
  if (!link) return '';
  if (link.startsWith('/') && typeof window !== 'undefined') return window.location.origin + link;
  return link;
}

export function ReengagementExportDialog() {
  const { selectedPropertyId } = usePropertySelector();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LoadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState(DEFAULT_RO_MESSAGE_TEMPLATE);
  const [link, setLink] = useState('');

  const load = useCallback(async (propertyId: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    const res = await fetchReengagementContactsAction(propertyId);
    if (res.success && res.contacts) {
      const resolved = absoluteLink(res.calendarLink || '');
      setData({
        contacts: res.contacts,
        unsubscribedExcluded: res.unsubscribedExcluded || 0,
        noPhoneExcluded: res.noPhoneExcluded || 0,
        calendarLink: resolved,
      });
      setLink(resolved);
    } else {
      setError(res.error || 'Failed to load contacts.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen && selectedPropertyId) load(selectedPropertyId);
  }, [isOpen, selectedPropertyId, load]);

  const handleDownload = () => {
    if (!data || !selectedPropertyId) return;
    const csv = buildReengagementCsv(data.contacts, { template, link });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `romanian-guests-${selectedPropertyId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'CSV downloaded',
      description: `${data.contacts.length} contacts exported with personalized messages.`,
    });
  };

  // Live preview of the first contact's message as the user edits the template / link.
  const preview = data && data.contacts.length > 0
    ? buildReengagementMessage(template, {
        name: tidyFirstName(data.contacts[0].firstName) || data.contacts[0].firstName,
        phrase: seasonPhraseRO(new Date(data.contacts[0].lastCheckIn), new Date()),
        link,
      })
    : '';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="h-4 w-4 mr-2" />
          Re-engagement export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Re-engagement export — Romanian past guests</DialogTitle>
          <DialogDescription>
            Builds a CSV of past Romanian guests (with a phone), one personalized message per row.
            The time reference (&quot;vara trecuta&quot;, etc.) is computed from each guest&apos;s last stay.
            Unsubscribed guests are excluded automatically.
          </DialogDescription>
        </DialogHeader>

        {!selectedPropertyId ? (
          <p className="text-sm text-muted-foreground py-6">
            Select a single property from the property selector above to build the list — the message
            and calendar link are property-specific.
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-6">{error}</p>
        ) : data ? (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <span className="font-medium">{data.contacts.length}</span> Romanian past guests with a phone.
              {data.unsubscribedExcluded > 0 && (
                <span className="text-muted-foreground"> · {data.unsubscribedExcluded} excluded (unsubscribed)</span>
              )}
              {data.noPhoneExcluded > 0 && (
                <span className="text-muted-foreground"> · {data.noPhoneExcluded} skipped (no phone)</span>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reeng-link">Calendar link</Label>
              <Input
                id="reeng-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://your-domain/calendar/<token>"
              />
              {!data.calendarLink && (
                <p className="text-xs text-amber-600">
                  No guest calendar token found for this property — generate one in Calendar → Share, or paste a link.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reeng-template">Message template</Label>
              <Textarea
                id="reeng-template"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Placeholders: <code>{'{name}'}</code> · <code>{'{phrase}'}</code> (auto time reference) · <code>{'{link}'}</code>
              </p>
            </div>

            {preview && (
              <div className="space-y-1.5">
                <Label>Preview (first contact)</Label>
                <div className="rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{preview}</div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
              <Button onClick={handleDownload} disabled={data.contacts.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV ({data.contacts.length})
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
