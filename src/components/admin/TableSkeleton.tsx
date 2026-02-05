// src/components/admin/TableSkeleton.tsx
// Loading skeleton for admin tables

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showHeader?: boolean;
}

export function TableSkeleton({
  columns = 5,
  rows = 5,
  showHeader = true,
}: TableSkeletonProps) {
  return (
    <Table>
      {showHeader && (
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TableCell key={colIndex}>
                <Skeleton
                  className="h-4"
                  style={{
                    width: `${Math.floor(Math.random() * 40) + 60}%`,
                  }}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Simple skeleton rows without table wrapper
 * Use this inside existing tables during loading
 */
export function TableRowsSkeleton({
  columns = 5,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton
                className="h-4"
                style={{
                  width: `${Math.floor(Math.random() * 40) + 60}%`,
                }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
