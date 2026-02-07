'use client';

import { useState, useMemo } from 'react';
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
import { Eye, Search, ArrowUpDown } from 'lucide-react';

interface GuestTableProps {
  guests: Guest[];
}

const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string') {
    try {
      return parseISO(dateStr);
    } catch {
      return null;
    }
  }
  return null;
};

const formatDateSafe = (dateStr: SerializableTimestamp | null | undefined): string => {
  const d = parseDateSafe(dateStr);
  if (!d || isNaN(d.getTime())) return '-';
  return format(d, 'MMM d, yyyy');
};

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(amount);
};

type SortField = 'name' | 'totalBookings' | 'totalSpent' | 'lastBookingDate';
type SortDir = 'asc' | 'desc';

export function GuestTable({ guests }: GuestTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastBookingDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let result = guests;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) =>
          g.firstName?.toLowerCase().includes(q) ||
          g.lastName?.toLowerCase().includes(q) ||
          g.email?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = (a.firstName || '').localeCompare(b.firstName || '');
          break;
        case 'totalBookings':
          cmp = (a.totalBookings || 0) - (b.totalBookings || 0);
          break;
        case 'totalSpent':
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

    return result;
  }, [guests, search, sortField, sortDir]);

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium hover:bg-transparent"
      onClick={() => toggleSort(field)}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortButton field="name" label="Name" /></TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center"><SortButton field="totalBookings" label="Bookings" /></TableHead>
              <TableHead className="text-right"><SortButton field="totalSpent" label="Spent" /></TableHead>
              <TableHead><SortButton field="lastBookingDate" label="Last Booking" /></TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-center">Subscribed</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {search ? 'No guests match your search.' : 'No guests found.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell className="font-medium">
                    {guest.firstName} {guest.lastName || ''}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{guest.email}</TableCell>
                  <TableCell className="text-center">{guest.totalBookings || 0}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(guest.totalSpent || 0, guest.currency || 'EUR')}
                  </TableCell>
                  <TableCell>{formatDateSafe(guest.lastBookingDate)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {guest.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {guest.unsubscribed ? (
                      <Badge variant="outline" className="text-xs text-red-600 border-red-200">No</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-200">Yes</Badge>
                    )}
                  </TableCell>
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
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} guest{filtered.length !== 1 ? 's' : ''}
        {search && ` matching "${search}"`}
      </p>
    </div>
  );
}
