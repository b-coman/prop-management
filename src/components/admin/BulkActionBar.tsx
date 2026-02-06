"use client";

import * as React from 'react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export interface BulkActionResult {
  success: boolean;
  successCount: number;
  failCount: number;
}

export interface BulkAction {
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'destructive';
  onExecute: (ids: string[]) => Promise<BulkActionResult>;
  confirm?: { title: string; description: string };
}

interface BulkActionBarProps {
  selectedIds: Set<string>;
  entityName: string;
  actions: BulkAction[];
  onClearSelection: () => void;
}

export function BulkActionBar({ selectedIds, entityName, actions, onClearSelection }: BulkActionBarProps) {
  const [executing, setExecuting] = useState(false);
  const { toast } = useToast();

  if (selectedIds.size === 0) return null;

  const ids = Array.from(selectedIds);

  const executeAction = async (action: BulkAction) => {
    setExecuting(true);
    try {
      const result = await action.onExecute(ids);
      if (result.failCount === 0) {
        toast({
          title: `${result.successCount} ${entityName} updated`,
          description: `${action.label} completed successfully.`,
        });
      } else {
        toast({
          title: `Partial completion`,
          description: `${result.successCount} succeeded, ${result.failCount} failed.`,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Action failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
      onClearSelection();
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-2 mb-2">
      <span className="text-sm font-medium whitespace-nowrap">
        {selectedIds.size} {entityName} selected
      </span>
      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const Icon = action.icon;

          if (action.confirm) {
            return (
              <AlertDialog key={action.label}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                    disabled={executing}
                  >
                    {executing ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : Icon ? (
                      <Icon className="h-4 w-4 mr-1" />
                    ) : null}
                    {action.label}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{action.confirm.title}</AlertDialogTitle>
                    <AlertDialogDescription>{action.confirm.description}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={executing}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={executing}
                      onClick={(e) => {
                        e.preventDefault();
                        executeAction(action);
                      }}
                      className={action.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                    >
                      {executing ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : null}
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            );
          }

          return (
            <Button
              key={action.label}
              size="sm"
              variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
              disabled={executing}
              onClick={() => executeAction(action)}
            >
              {executing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : Icon ? (
                <Icon className="h-4 w-4 mr-1" />
              ) : null}
              {action.label}
            </Button>
          );
        })}
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onClearSelection}
        disabled={executing}
        className="ml-auto"
      >
        <X className="h-4 w-4 mr-1" />
        Clear
      </Button>
    </div>
  );
}
