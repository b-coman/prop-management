"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChannelData } from "../_actions";

interface AttributionTableProps {
  channels: ChannelData[];
}

export function AttributionTable({ channels }: AttributionTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Medium</TableHead>
          <TableHead className="text-right">Bookings</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Avg. Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {channels.map((ch, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{ch.source}</TableCell>
            <TableCell>{ch.medium}</TableCell>
            <TableCell className="text-right">{ch.bookings}</TableCell>
            <TableCell className="text-right">
              {ch.revenue.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </TableCell>
            <TableCell className="text-right">
              {ch.bookings > 0
                ? Math.round(ch.revenue / ch.bookings).toLocaleString()
                : "0"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
