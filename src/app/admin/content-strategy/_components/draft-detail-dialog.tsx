'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateDraftStatus, publishDraft } from '../actions';
import { BlockPreview } from './block-preview';
import { Loader2, CheckCircle, XCircle, Upload, Eye, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentDraft } from '@/lib/content-schemas';

const draftStatusColors: Record<string, string> = {
  'pending-review': 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  published: 'bg-blue-100 text-blue-700',
};

interface DraftDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  draft: ContentDraft | null;
  topicTitle: string;
  targetPage?: string;
  targetBlock?: string;
  onActionComplete: () => void;
}

export function DraftDetailDialog({
  open,
  onOpenChange,
  propertyId,
  draft,
  topicTitle,
  targetPage,
  targetBlock,
  onActionComplete,
}: DraftDetailDialogProps) {
  const { toast } = useToast();
  const [reviewNotes, setReviewNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'json'>('preview');

  if (!draft) return null;

  const meta = draft.generationMeta;
  const dataSources = meta?.dataSources;
  const usedSources = dataSources
    ? Object.entries(dataSources).filter(([, v]) => v != null).map(([k]) => k)
    : [];

  const handleApprove = async () => {
    setIsLoading(true);
    const result = await updateDraftStatus(propertyId, draft.id!, 'approved', reviewNotes || undefined);
    setIsLoading(false);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Approved', description: 'Draft approved.' });
      onOpenChange(false);
      onActionComplete();
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    const result = await updateDraftStatus(propertyId, draft.id!, 'rejected', reviewNotes || undefined);
    setIsLoading(false);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Rejected', description: 'Draft rejected.' });
      onOpenChange(false);
      onActionComplete();
    }
  };

  const handlePublish = async () => {
    setConfirmPublish(false);
    setIsLoading(true);
    const result = await publishDraft(propertyId, draft.id!);
    setIsLoading(false);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Published', description: 'Content published to the property page.' });
      onOpenChange(false);
      onActionComplete();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="text-lg">{topicTitle}</DialogTitle>
              <Badge variant="outline" className="text-xs">v{draft.version}</Badge>
              <Badge className={draftStatusColors[draft.status] || ''}>
                {draft.status}
              </Badge>
            </div>
          </DialogHeader>

          {/* Generation Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm border rounded-lg p-3">
            <div>
              <span className="text-muted-foreground">Model</span>
              <p className="font-medium">{meta?.model || 'unknown'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Cost</span>
              <p className="font-medium">${meta?.costEstimate?.toFixed(4) ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Duration</span>
              <p className="font-medium">
                {meta?.durationMs ? `${(meta.durationMs / 1000).toFixed(1)}s` : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Prompt tokens</span>
              <p className="font-medium">{meta?.promptTokens?.toLocaleString() ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Output tokens</span>
              <p className="font-medium">{meta?.outputTokens?.toLocaleString() ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Generated</span>
              <p className="font-medium">
                {meta?.generatedAt
                  ? new Date(meta.generatedAt).toLocaleDateString()
                  : '—'}
              </p>
            </div>
          </div>

          {/* Data Sources Used */}
          {usedSources.length > 0 && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Data sources used</span>
              <div className="flex flex-wrap gap-1.5">
                {usedSources.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Generated Content — Preview / JSON toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Generated content</span>
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors',
                    viewMode === 'preview'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('json')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors border-l',
                    viewMode === 'json'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <Code className="h-3.5 w-3.5" />
                  JSON
                </button>
              </div>
            </div>

            {viewMode === 'preview' && targetBlock ? (
              <BlockPreview
                blockType={targetBlock}
                content={draft.content}
              />
            ) : (
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                {JSON.stringify(draft.content, null, 2)}
              </pre>
            )}
          </div>

          {/* Review Notes */}
          {draft.status !== 'published' && (
            <div className="space-y-1.5">
              <Label className="text-sm">Review notes</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Optional notes about this draft..."
                rows={3}
              />
            </div>
          )}

          {/* Existing review notes */}
          {draft.reviewNotes && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Previous review notes</span>
              <p className="text-sm bg-muted p-2 rounded">{draft.reviewNotes}</p>
            </div>
          )}

          {/* Actions */}
          <DialogFooter className="gap-2 sm:gap-0">
            {draft.status === 'published' && draft.publishedAt && (
              <p className="text-sm text-muted-foreground mr-auto">
                Published on {new Date(draft.publishedAt).toLocaleDateString()}
              </p>
            )}

            {(draft.status === 'pending-review' || draft.status === 'rejected') && (
              <Button
                onClick={handleApprove}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Approve
              </Button>
            )}

            {(draft.status === 'pending-review' || draft.status === 'approved') && (
              <Button
                onClick={handleReject}
                disabled={isLoading}
                variant="destructive"
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                Reject
              </Button>
            )}

            {draft.status === 'approved' && (
              <Button
                onClick={() => setConfirmPublish(true)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Publish to Site
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Confirmation */}
      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Draft</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current <strong>{targetBlock}</strong> content
              on the <strong>{targetPage}</strong> page. This action can be
              reversed by publishing a different draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
