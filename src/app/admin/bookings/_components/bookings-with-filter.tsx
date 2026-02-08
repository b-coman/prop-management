// src/app/admin/bookings/_components/bookings-with-filter.tsx
'use client';

import * as React from 'react';
import type { Booking, SerializableTimestamp } from '@/types';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import { BookingTable } from './booking-table';
import { EmptyState } from '@/components/admin';
import { CalendarCheck, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseISO } from 'date-fns';

interface BookingsWithFilterProps {
  bookings: Booking[];
}

type SortDirection = 'asc' | 'desc';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'on-hold', label: 'On-Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// Helper to parse date safely (same as in booking-table)
function parseDateSafe(dateStr: SerializableTimestamp | null | undefined): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  try { return parseISO(String(dateStr)); } catch { return null; }
}

export function BookingsWithFilter({ bookings }: BookingsWithFilterProps) {
  const { selectedPropertyId, properties } = usePropertySelector();

  // Build property name lookup map
  const propertyNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const prop of properties) {
      map[prop.id] = typeof prop.name === 'string'
        ? prop.name
        : prop.name?.en || prop.name?.ro || prop.id;
    }
    return map;
  }, [properties]);

  // Filter/sort/pagination state
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortColumn, setSortColumn] = React.useState<string>('checkInDate');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  // 1. Property filter
  const propertyFiltered = React.useMemo(() =>
    selectedPropertyId
      ? bookings.filter(b => b.propertyId === selectedPropertyId)
      : bookings,
    [bookings, selectedPropertyId]
  );

  // Count per status (from property-filtered, before status/search filter)
  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: propertyFiltered.length };
    for (const b of propertyFiltered) {
      const s = b.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [propertyFiltered]);

  // 2. Status filter
  const statusFiltered = React.useMemo(() =>
    statusFilter === 'all'
      ? propertyFiltered
      : propertyFiltered.filter(b => b.status === statusFilter),
    [propertyFiltered, statusFilter]
  );

  // 3. Search filter
  const searchFiltered = React.useMemo(() => {
    if (!searchQuery.trim()) return statusFiltered;

    const q = searchQuery.toLowerCase();
    return statusFiltered.filter(b => {
      const firstName = (b.guestInfo?.firstName || '').toLowerCase();
      const lastName = (b.guestInfo?.lastName || '').toLowerCase();
      const email = (b.guestInfo?.email || '').toLowerCase();
      const extId = (b.externalId || '').toLowerCase();
      const id = b.id.toLowerCase();
      const source = (b.source || '').toLowerCase();
      return (
        firstName.includes(q) ||
        lastName.includes(q) ||
        `${firstName} ${lastName}`.includes(q) ||
        email.includes(q) ||
        extId.includes(q) ||
        id.includes(q) ||
        source.includes(q)
      );
    });
  }, [statusFiltered, searchQuery]);

  // 4. Sort
  const sorted = React.useMemo(() => {
    if (!sortColumn) return searchFiltered;

    return [...searchFiltered].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortColumn) {
        case 'guest': {
          aVal = `${a.guestInfo?.firstName || ''} ${a.guestInfo?.lastName || ''}`.trim().toLowerCase();
          bVal = `${b.guestInfo?.firstName || ''} ${b.guestInfo?.lastName || ''}`.trim().toLowerCase();
          break;
        }
        case 'checkInDate': {
          const aDate = parseDateSafe(a.checkInDate);
          const bDate = parseDateSafe(b.checkInDate);
          aVal = aDate ? aDate.getTime() : 0;
          bVal = bDate ? bDate.getTime() : 0;
          break;
        }
        case 'status': {
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        }
        case 'amount': {
          aVal = a.pricing?.total || 0;
          bVal = b.pricing?.total || 0;
          break;
        }
        default:
          return 0;
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [searchFiltered, sortColumn, sortDirection]);

  // 5. Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  // Reset page on filter/search/sort/property changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, sortColumn, sortDirection, selectedPropertyId, pageSize]);

  // Sort handler (for BookingTable column header clicks)
  const handleSort = React.useCallback((column: string) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  // Show empty state if no bookings at all (pre-filter)
  if (propertyFiltered.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title={selectedPropertyId ? 'No bookings for this property' : 'No bookings yet'}
        description={
          selectedPropertyId
            ? 'Select "All Properties" to see all bookings'
            : 'Bookings will appear here when guests make reservations'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="flex-wrap h-auto gap-1">
          {STATUS_TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
              {tab.label}
              <Badge
                variant={statusFilter === tab.value ? 'default' : 'secondary'}
                className="h-5 min-w-[20px] px-1.5 text-[10px] font-medium"
              >
                {statusCounts[tab.value] || 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search + result count */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by guest, email, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? 'result' : 'results'}
        </div>
      </div>

      {/* Table */}
      <BookingTable
        bookings={paginated}
        propertyNames={propertyNames}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                aria-label="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
