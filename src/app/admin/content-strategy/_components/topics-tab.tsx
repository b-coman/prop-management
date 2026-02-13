'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { TopicDialog } from './topic-dialog';
import { deleteContentTopic, updateTopicStatus } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { Plus, MoreHorizontal, Pencil, Archive, ArchiveRestore, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentTopic } from '@/lib/content-schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTitle(title: string | Record<string, string> | undefined): string {
  if (!title) return '';
  if (typeof title === 'string') return title;
  return title.en || title.ro || Object.values(title)[0] || '';
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  generating: 'bg-yellow-100 text-yellow-700',
  review: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

// ---------------------------------------------------------------------------
// Filter pill data
// ---------------------------------------------------------------------------

const CATEGORY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'evergreen', label: 'Evergreen' },
  { value: 'event', label: 'Event' },
  { value: 'guide', label: 'Guide' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TopicsTabProps {
  propertyId: string;
  topics: ContentTopic[];
}

export function TopicsTab({ propertyId, topics }: TopicsTabProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<ContentTopic | undefined>();

  // Delete confirmation state
  const [deletingTopic, setDeletingTopic] = useState<ContentTopic | null>(null);

  // Loading states
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      return true;
    });
  }, [topics, categoryFilter, statusFilter]);

  // Handlers

  const handleAdd = () => {
    setEditingTopic(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (topic: ContentTopic) => {
    setEditingTopic(topic);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    router.refresh();
  };

  const handleArchiveToggle = async (topic: ContentTopic) => {
    const newStatus = topic.status === 'archived' ? 'draft' : 'archived';
    setPendingAction(topic.id!);
    const result = await updateTopicStatus(propertyId, topic.id!, newStatus);
    setPendingAction(null);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({
        title: newStatus === 'archived' ? 'Archived' : 'Unarchived',
        description: `Topic "${getTitle(topic.title) || topic.slug}" ${newStatus === 'archived' ? 'archived' : 'restored'}.`,
      });
      router.refresh();
    }
  };

  const handleDelete = async () => {
    if (!deletingTopic?.id) return;
    setPendingAction(deletingTopic.id);
    const result = await deleteContentTopic(propertyId, deletingTopic.id);
    setPendingAction(null);
    setDeletingTopic(null);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Topic deleted.' });
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">Category:</span>
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setCategoryFilter(f.value)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                categoryFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted-foreground/10'
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="text-sm text-muted-foreground ml-2 mr-1">Status:</span>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted-foreground/10'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Topic
        </Button>
      </div>

      {/* Table or Empty State */}
      {filteredTopics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">
            {topics.length === 0
              ? 'No topics defined yet. Create topics to start generating content.'
              : 'No topics match the current filters.'}
          </p>
          {topics.length === 0 && (
            <Button onClick={handleAdd} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Topic
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTopics.map((topic) => (
                <TableRow key={topic.id}>
                  <TableCell className="font-medium">
                    {getTitle(topic.title) || topic.slug}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {topic.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {topic.category === 'seasonal' && topic.targetMonth
                      ? MONTH_NAMES[topic.targetMonth]
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {topic.targetPage}
                    {topic.targetBlock ? ` / ${topic.targetBlock}` : ''}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs', priorityColors[topic.priority] || '')}>
                      {topic.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs', statusColors[topic.status] || '')}>
                      {topic.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {pendingAction === topic.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(topic)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleArchiveToggle(topic)}>
                            {topic.status === 'archived' ? (
                              <>
                                <ArchiveRestore className="h-4 w-4 mr-2" />
                                Unarchive
                              </>
                            ) : (
                              <>
                                <Archive className="h-4 w-4 mr-2" />
                                Archive
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingTopic(topic)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <TopicDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        topic={editingTopic}
        onSaved={handleSaved}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingTopic}
        onOpenChange={(open) => { if (!open) setDeletingTopic(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingTopic ? (getTitle(deletingTopic.title) || deletingTopic.slug) : ''}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
