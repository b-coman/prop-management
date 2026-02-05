// src/components/admin/DataTable.tsx
// Reusable data table with client-side pagination, sorting, and filtering

'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { TableSkeleton } from './TableSkeleton';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

// Column definition type
export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  accessorFn?: (row: T) => React.ReactNode;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

// Props for the DataTable
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  emptyState?: {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: { label: string; href: string };
  };
  loading?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  getRowKey: (row: T) => string;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  searchKeys,
  emptyState,
  loading = false,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  getRowKey,
}: DataTableProps<T>) {
  // State
  const [searchQuery, setSearchQuery] = React.useState('');
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);

  // Filter data based on search query
  const filteredData = React.useMemo(() => {
    if (!searchQuery || !searchKeys || searchKeys.length === 0) {
      return data;
    }

    const query = searchQuery.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((key) => {
        const value = row[key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      })
    );
  }, [data, searchQuery, searchKeys]);

  // Sort filtered data
  const sortedData = React.useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return filteredData;
    }

    const column = columns.find((col) => col.id === sortColumn);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aValue: unknown;
      let bValue: unknown;

      if (column.accessorFn) {
        aValue = column.accessorFn(a);
        bValue = column.accessorFn(b);
      } else if (column.accessorKey) {
        aValue = a[column.accessorKey];
        bValue = b[column.accessorKey];
      } else {
        return 0;
      }

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      // Compare values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? result : -result;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  // Paginate data
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, pageSize]);

  // Total pages
  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Reset to page 1 when data, search, or sort changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortColumn, sortDirection, data.length]);

  // Handle sort
  const handleSort = (columnId: string) => {
    const column = columns.find((col) => col.id === columnId);
    if (!column?.sortable) return;

    if (sortColumn !== columnId) {
      setSortColumn(columnId);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortColumn(null);
      setSortDirection(null);
    }
  };

  // Get sort icon for column
  const getSortIcon = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    }
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  // Get cell value
  const getCellValue = (row: T, column: ColumnDef<T>) => {
    if (column.cell) {
      return column.cell(row);
    }
    if (column.accessorFn) {
      return column.accessorFn(row);
    }
    if (column.accessorKey) {
      return row[column.accessorKey] as React.ReactNode;
    }
    return null;
  };

  // Show loading skeleton
  if (loading) {
    return <TableSkeleton columns={columns.length} rows={pageSize} />;
  }

  // Show empty state if no data
  if (data.length === 0 && emptyState) {
    return (
      <EmptyState
        icon={emptyState.icon}
        title={emptyState.title}
        description={emptyState.description}
        action={emptyState.action}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and controls */}
      {searchKeys && searchKeys.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredData.length} {filteredData.length === 1 ? 'result' : 'results'}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    column.sortable && 'cursor-pointer select-none',
                    column.headerClassName
                  )}
                  onClick={() => column.sortable && handleSort(column.id)}
                >
                  <div className="flex items-center">
                    {column.header}
                    {column.sortable && getSortIcon(column.id)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row) => (
                <TableRow key={getRowKey(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      {getCellValue(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
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
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
