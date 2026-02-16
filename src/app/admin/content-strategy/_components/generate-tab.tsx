'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { DraftDetailDialog } from './draft-detail-dialog';
import { generateTopicContent, updateDraftStatus } from '../actions';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Sparkles,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentTopic, ContentDraft } from '@/lib/content-schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTitle(title: string | Record<string, string> | undefined): string {
  if (!title) return '';
  if (typeof title === 'string') return title;
  return title.en || title.ro || Object.values(title)[0] || '';
}

const topicStatusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  review: 'bg-purple-100 text-purple-700',
};

const draftStatusColors: Record<string, string> = {
  'pending-review': 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  published: 'bg-blue-100 text-blue-700',
};

const categoryColors: Record<string, string> = {
  seasonal: 'bg-orange-100 text-orange-700',
  evergreen: 'bg-emerald-100 text-emerald-700',
  event: 'bg-purple-100 text-purple-700',
  guide: 'bg-sky-100 text-sky-700',
};

const DRAFT_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending-review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Published' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GenerateTabProps {
  propertyId: string;
  topics: ContentTopic[];
  drafts: ContentDraft[];
}

export function GenerateTab({ propertyId, topics, drafts }: GenerateTabProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Generation state
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState<ContentTopic | null>(null);

  // Draft detail dialog state
  const [selectedDraft, setSelectedDraft] = useState<ContentDraft | null>(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);

  // Draft filters
  const [draftStatusFilter, setDraftStatusFilter] = useState('');

  // Quick action loading
  const [quickActionId, setQuickActionId] = useState<string | null>(null);

  // Eligible topics for generation
  const generatableTopics = useMemo(
    () => topics.filter((t) => t.status === 'draft' || t.status === 'scheduled' || t.status === 'review'),
    [topics]
  );

  // Filtered drafts
  const filteredDrafts = useMemo(() => {
    if (!draftStatusFilter) return drafts;
    return drafts.filter((d) => d.status === draftStatusFilter);
  }, [drafts, draftStatusFilter]);

  // Handlers

  const handleGenerate = async () => {
    if (!confirmGenerate?.id) return;
    const topicId = confirmGenerate.id;
    setConfirmGenerate(null);
    setGeneratingTopicId(topicId);

    const result = await generateTopicContent(propertyId, topicId);

    setGeneratingTopicId(null);
    if (result.error) {
      toast({ title: 'Generation Failed', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Content Generated', description: 'Draft created and ready for review.' });
      router.refresh();
    }
  };

  const handleQuickApprove = async (draft: ContentDraft) => {
    setQuickActionId(draft.id!);
    const result = await updateDraftStatus(propertyId, draft.id!, 'approved');
    setQuickActionId(null);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Approved', description: 'Draft approved.' });
      router.refresh();
    }
  };

  const handleQuickReject = async (draft: ContentDraft) => {
    setQuickActionId(draft.id!);
    const result = await updateDraftStatus(propertyId, draft.id!, 'rejected');
    setQuickActionId(null);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Rejected', description: 'Draft rejected.' });
      router.refresh();
    }
  };

  const handleViewDetails = (draft: ContentDraft) => {
    setSelectedDraft(draft);
    setDraftDialogOpen(true);
  };

  const handleDraftActionComplete = () => {
    router.refresh();
  };

  // Find topic for a draft
  const getTopicForDraft = (draft: ContentDraft) =>
    topics.find((t) => t.id === draft.topicId);

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* Section 1: Topic Queue                                          */}
      {/* ================================================================ */}
      <Card>
        <CardHeader>
          <CardTitle>Topic Queue</CardTitle>
          <CardDescription>
            {generatableTopics.length === 0
              ? 'No topics ready for generation. Create and schedule topics first.'
              : `${generatableTopics.length} topic${generatableTopics.length === 1 ? '' : 's'} eligible for generation`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {generatableTopics.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Switch to the Topics tab to create and schedule content topics.
            </p>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Generated</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatableTopics.map((topic) => {
                    const isGenerating = generatingTopicId === topic.id;
                    const isAnyGenerating = generatingTopicId !== null;

                    return (
                      <TableRow key={topic.id}>
                        <TableCell className="font-medium">
                          {getTitle(topic.title) || topic.slug}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', categoryColors[topic.category] || '')}>
                            {topic.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {topic.targetPage}
                          {topic.targetBlock ? ` / ${topic.targetBlock}` : ''}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', topicStatusColors[topic.status] || '')}>
                            {topic.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {topic.lastGenerated
                            ? new Date(topic.lastGenerated).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {isGenerating ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating...
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmGenerate(topic)}
                              disabled={isAnyGenerating}
                            >
                              <Sparkles className="h-4 w-4 mr-1" />
                              Generate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* Section 2: Drafts Table                                         */}
      {/* ================================================================ */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Drafts</CardTitle>
              <CardDescription>
                {drafts.length === 0
                  ? 'No drafts generated yet.'
                  : `${filteredDrafts.length} of ${drafts.length} draft${drafts.length === 1 ? '' : 's'}`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DRAFT_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setDraftStatusFilter(f.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    draftStatusFilter === f.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted-foreground/10'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Generated drafts will appear here for review before publishing.
            </p>
          ) : filteredDrafts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No drafts match the selected filter.
            </p>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrafts.map((draft) => {
                    const topic = getTopicForDraft(draft);
                    const isQuickLoading = quickActionId === draft.id;

                    return (
                      <TableRow key={draft.id}>
                        <TableCell className="font-medium">
                          {getTitle(topic?.title) || draft.topicId}
                        </TableCell>
                        <TableCell className="text-sm">
                          v{draft.version}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', draftStatusColors[draft.status] || '')}>
                            {draft.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {draft.generationMeta?.model || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {draft.generationMeta?.costEstimate != null
                            ? `$${draft.generationMeta.costEstimate.toFixed(4)}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {draft.generationMeta?.durationMs
                            ? `${(draft.generationMeta.durationMs / 1000).toFixed(1)}s`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {draft.generationMeta?.generatedAt
                            ? new Date(draft.generationMeta.generatedAt).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {isQuickLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(draft)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>

                                {draft.status === 'pending-review' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleQuickApprove(draft)}>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleQuickReject(draft)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Reject
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {draft.status === 'approved' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleViewDetails(draft)}>
                                      <Upload className="h-4 w-4 mr-2" />
                                      Publish...
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* Generate Confirmation Dialog                                     */}
      {/* ================================================================ */}
      <AlertDialog
        open={!!confirmGenerate}
        onOpenChange={(open) => { if (!open) setConfirmGenerate(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Content</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate content for &ldquo;{confirmGenerate ? (getTitle(confirmGenerate.title) || confirmGenerate.slug) : ''}&rdquo;
              using the AI model. This may take 30-60 seconds and will incur API costs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate}>
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================================================================ */}
      {/* Draft Detail Dialog                                              */}
      {/* ================================================================ */}
      <DraftDetailDialog
        open={draftDialogOpen}
        onOpenChange={setDraftDialogOpen}
        propertyId={propertyId}
        draft={selectedDraft}
        topicTitle={
          selectedDraft
            ? getTitle(getTopicForDraft(selectedDraft)?.title) || selectedDraft.topicId
            : ''
        }
        targetPage={selectedDraft ? getTopicForDraft(selectedDraft)?.targetPage : undefined}
        targetBlock={selectedDraft ? getTopicForDraft(selectedDraft)?.targetBlock : undefined}
        onActionComplete={handleDraftActionComplete}
      />
    </div>
  );
}
