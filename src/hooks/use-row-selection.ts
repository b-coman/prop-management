"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';

type AllState = 'all' | 'some' | 'none';

interface UseRowSelectionReturn {
  selectedIds: Set<string>;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clearSelection: () => void;
  allState: AllState;
}

export function useRowSelection(rowIds: string[]): UseRowSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Prune stale selections when visible rows change
  useEffect(() => {
    setSelectedIds(prev => {
      const rowIdSet = new Set(rowIds);
      const pruned = new Set<string>();
      for (const id of prev) {
        if (rowIdSet.has(id)) {
          pruned.add(id);
        }
      }
      if (pruned.size !== prev.size) {
        return pruned;
      }
      return prev;
    });
  }, [rowIds]);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allState: AllState = useMemo(() => {
    if (rowIds.length === 0 || selectedIds.size === 0) return 'none';
    if (selectedIds.size === rowIds.length) return 'all';
    return 'some';
  }, [rowIds.length, selectedIds.size]);

  const toggleAll = useCallback(() => {
    if (allState === 'all') {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rowIds));
    }
  }, [allState, rowIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggle,
    toggleAll,
    clearSelection,
    allState,
  };
}
