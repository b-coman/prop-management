'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { fetchGoogleReviewsForProperty, checkDuplicateReviews, importReviewsBatch } from '../actions';

type Step = 'fetching' | 'preview' | 'done' | 'error';

interface PreviewRow {
  guestName: string;
  rating: number;
  comment: string;
  date: string;
  sourceUrl?: string;
  language?: string;
  selected: boolean;
  status: 'ok' | 'duplicate';
}

interface GoogleSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function GoogleSyncDialog({ open, onOpenChange, propertyId }: GoogleSyncDialogProps) {
  const [step, setStep] = useState<Step>('fetching');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [placeName, setPlaceName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importError, setImportError] = useState('');

  const reset = useCallback(() => {
    setStep('fetching');
    setPreviewRows([]);
    setPlaceName('');
    setErrorMsg('');
    setPublishImmediately(true);
    setIsLoading(false);
    setImportCount(0);
    setImportError('');
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  }, [onOpenChange, reset]);

  // Auto-fetch on open
  useEffect(() => {
    if (!open || !propertyId) return;

    let cancelled = false;

    async function doFetch() {
      try {
        const result = await fetchGoogleReviewsForProperty(propertyId);

        if (cancelled) return;

        if (!result.success) {
          setErrorMsg(result.error || 'Failed to fetch reviews.');
          setStep('error');
          return;
        }

        if (result.reviews.length === 0) {
          setErrorMsg('No reviews found on Google for this property.');
          setStep('error');
          return;
        }

        setPlaceName(result.placeName || '');

        // Check duplicates
        const dupResult = await checkDuplicateReviews(
          result.reviews.map(r => ({
            propertyId,
            guestName: r.guestName,
            date: r.date,
            source: 'google',
          }))
        );

        if (cancelled) return;

        const dupSet = new Set(dupResult.duplicateIndices);
        const rows: PreviewRow[] = result.reviews.map((r, i) => ({
          ...r,
          selected: !dupSet.has(i),
          status: dupSet.has(i) ? 'duplicate' as const : 'ok' as const,
        }));

        setPreviewRows(rows);
        setStep('preview');
      } catch {
        if (!cancelled) {
          setErrorMsg('An unexpected error occurred.');
          setStep('error');
        }
      }
    }

    doFetch();
    return () => { cancelled = true; };
  }, [open, propertyId]);

  const toggleRow = (index: number) => {
    setPreviewRows(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = () => {
    const allSelected = previewRows.every(r => r.selected);
    setPreviewRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const selectedCount = previewRows.filter(r => r.selected).length;
  const duplicateCount = previewRows.filter(r => r.status === 'duplicate').length;

  const handleImport = async () => {
    const selected = previewRows.filter(r => r.selected);
    if (selected.length === 0) return;

    setIsLoading(true);
    setImportError('');
    try {
      const result = await importReviewsBatch({
        reviews: selected.map(r => ({
          propertyId,
          guestName: r.guestName,
          rating: r.rating,
          comment: r.comment,
          date: r.date,
          source: 'google' as const,
          sourceUrl: r.sourceUrl,
          language: r.language,
          isPublished: publishImmediately,
        })),
      });

      if (result.success) {
        setImportCount(result.count);
        setStep('done');
      } else {
        setImportError(result.error || 'Import failed.');
      }
    } catch {
      setImportError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Google Reviews Sync</DialogTitle>
          <DialogDescription>
            {placeName ? `Fetching reviews from "${placeName}"` : 'Fetch and import reviews from Google Places.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'fetching' && (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Fetching Google reviews...</p>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button type="button" onClick={() => handleOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Found {previewRows.length} review(s) from Google.
                {duplicateCount > 0 && ` ${duplicateCount} already imported.`}
              </AlertDescription>
            </Alert>

            {/* Preview table */}
            <div className="border rounded-md overflow-auto max-h-[350px]">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 w-8">
                      <Checkbox
                        checked={previewRows.length > 0 && previewRows.every(r => r.selected)}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="p-2 text-left">Guest Name</th>
                    <th className="p-2 text-left w-16">Rating</th>
                    <th className="p-2 text-left">Comment</th>
                    <th className="p-2 text-left w-24">Date</th>
                    <th className="p-2 text-left w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr
                      key={i}
                      className={row.status === 'duplicate' ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                    >
                      <td className="p-2">
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={() => toggleRow(i)}
                        />
                      </td>
                      <td className="p-2 max-w-[150px] truncate">{row.guestName}</td>
                      <td className="p-2">{row.rating}/5</td>
                      <td className="p-2 max-w-[250px] truncate">{row.comment.slice(0, 80)}{row.comment.length > 80 ? '...' : ''}</td>
                      <td className="p-2 text-xs">{new Date(row.date).toLocaleDateString()}</td>
                      <td className="p-2">
                        {row.status === 'ok' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" /> New</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-600"><AlertTriangle className="h-3 w-3" /> Exists</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Publish switch */}
            <div className="flex items-center gap-2">
              <Switch checked={publishImmediately} onCheckedChange={setPublishImmediately} id="google-publish-switch" />
              <Label htmlFor="google-publish-switch">Publish immediately</Label>
            </div>

            {importError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={selectedCount === 0 || isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Import {selectedCount} Selected
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-lg font-medium">Successfully imported {importCount} Google review(s)</p>
            <Button type="button" onClick={() => handleOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
