// src/app/admin/guests/_components/guest-table.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { parseISO, format } from 'date-fns';
import type { Guest, SerializableTimestamp } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MailX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCountryName } from '@/lib/country-utils';

interface GuestTableProps {
  guests: Guest[];
}

const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string') {
    try { return parseISO(dateStr); } catch { return null; }
  }
  return null;
};

/** Compact date: "Sep 25" for current year, "Sep 25, 2025" otherwise */
function formatDateCompact(dateStr: SerializableTimestamp | null | undefined): string {
  const d = parseDateSafe(dateStr);
  if (!d || isNaN(d.getTime())) return '-';
  const currentYear = new Date().getFullYear();
  return d.getFullYear() === currentYear
    ? format(d, 'MMM d')
    : format(d, 'MMM d, y');
}

/** Format amount without decimals */
function formatAmount(amount: number, currency: string): string {
  const cur = currency || 'RON';
  return `${cur} ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Format phone for display: +40723200868 → +40 723 200 868 */
function formatPhone(phone: string): string {
  const clean = phone.replace(/\s/g, '');
  if (!clean.startsWith('+')) return clean;
  const digits = clean.substring(1);
  if (digits.length <= 4) return clean;
  // Group from right in 3s so remainder goes to first group (no orphan trailing digits)
  const groups: string[] = [];
  let i = digits.length;
  while (i > 0) {
    const start = Math.max(0, i - 3);
    groups.unshift(digits.substring(start, i));
    i = start;
  }
  return `+${groups.join(' ')}`;
}

const SOURCE_LABELS: Record<string, string> = {
  'airbnb': 'Airbnb',
  'booking.com': 'Booking.com',
  'vrbo': 'Vrbo',
  'direct': 'Direct',
  'stripe': 'Stripe',
};

const LANGUAGE_LABELS: Record<string, string> = {
  'en': 'EN',
  'ro': 'RO',
};

type SortField = 'name' | 'activity' | 'lastBookingDate';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function SortableHeader({ label, columnKey, sortField, sortDir, onSort, className }: {
  label: string;
  columnKey: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = sortField === columnKey;
  const Icon = isActive
    ? (sortDir === 'asc' ? ArrowUp : ArrowDown)
    : ArrowUpDown;

  return (
    <div
      className={cn('flex items-center cursor-pointer select-none hover:text-foreground', className)}
      onClick={() => onSort(columnKey)}
    >
      {label}
      <Icon className={cn('ml-1 h-3.5 w-3.5', isActive ? 'opacity-100' : 'opacity-40')} />
    </div>
  );
}

export function GuestTable({ guests }: GuestTableProps) {
  const [search, setSearch] = React.useState('');
  const [sortField, setSortField] = React.useState<SortField>('lastBookingDate');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Filter
  const filtered = React.useMemo(() => {
    if (!search) return guests;
    const q = search.toLowerCase();
    return guests.filter(
      (g) =>
        g.firstName?.toLowerCase().includes(q) ||
        g.lastName?.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.phone?.toLowerCase().includes(q) ||
        g.normalizedPhone?.includes(q) ||
        g.country?.toLowerCase().includes(q)
    );
  }, [guests, search]);

  // Sort
  const sorted = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`);
          break;
        case 'activity':
          cmp = (a.totalSpent || 0) - (b.totalSpent || 0);
          break;
        case 'lastBookingDate': {
          const da = parseDateSafe(a.lastBookingDate)?.getTime() || 0;
          const db = parseDateSafe(b.lastBookingDate)?.getTime() || 0;
          cmp = da - db;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  // Reset page on filter/sort changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, sortField, sortDir, pageSize]);

  return (
    <div className="space-y-4">
      {/* Search + count */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {sorted.length} guest{sorted.length !== 1 ? 's' : ''}
          {search && ` matching "${search}"`}
        </div>
      </div>

      {/* Table */}
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[30%]" />
          <col className="w-[6%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader label="Guest" columnKey="name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
            </TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">
              <SortableHeader label="Activity" columnKey="activity" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="justify-end" />
            </TableHead>
            <TableHead>
              <SortableHeader label="Last Booking" columnKey="lastBookingDate" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
            </TableHead>
            <TableHead>Language</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {search ? 'No guests match your search.' : 'No guests found.'}
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((guest) => (
              <TableRow key={guest.id}>
                {/* Guest: name + contact + unsub indicator */}
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{guest.firstName} {guest.lastName || ''}</span>
                    {guest.unsubscribed && (
                      <span title="Unsubscribed"><MailX className="h-3.5 w-3.5 text-destructive" /></span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[
                      guest.phone ? formatPhone(guest.phone) : null,
                      guest.email,
                    ].filter(Boolean).join(' · ') || '—'}
                  </div>
                </TableCell>
                {/* Source badges */}
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {guest.sources?.map((src) => (
                      <Badge key={src} variant="outline" className="text-[10px] px-1 py-0 font-normal">
                        {SOURCE_LABELS[src] || src}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                {/* Activity: bookings count + total spent */}
                <TableCell className="text-right">
                  <p className="tabular-nums">{guest.totalBookings || 0} booking{(guest.totalBookings || 0) !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted-foreground font-medium tabular-nums">
                    {formatAmount(guest.totalSpent || 0, guest.currency || 'RON')}
                  </p>
                </TableCell>
                {/* Last Booking */}
                <TableCell>{formatDateCompact(guest.lastBookingDate)}</TableCell>
                {/* Language / Country */}
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <span>{LANGUAGE_LABELS[guest.language] || guest.language?.toUpperCase() || '-'}</span>
                    {guest.country && (
                      <span className="text-muted-foreground">· {getCountryName(guest.country)}</span>
                    )}
                  </div>
                </TableCell>
                {/* Actions */}
                <TableCell>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/guests/${guest.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
              <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} aria-label="First page">
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} aria-label="Last page">
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
