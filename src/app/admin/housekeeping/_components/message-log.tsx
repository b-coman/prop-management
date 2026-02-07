'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { HousekeepingMessage } from '@/types';

interface MessageLogProps {
  messages: HousekeepingMessage[];
}

const typeBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  monthly: 'default',
  daily: 'secondary',
  change: 'outline',
  manual: 'secondary',
};

function formatDate(dateStr: string | unknown): string {
  if (!dateStr || typeof dateStr !== 'string') return '-';
  try {
    return new Date(dateStr).toLocaleString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

export function MessageLog({ messages }: MessageLogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No messages sent yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Message</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {messages.map((msg) => {
          const isExpanded = expandedId === msg.id;
          const preview = msg.messageBody.length > 60
            ? msg.messageBody.slice(0, 60) + '...'
            : msg.messageBody;

          return (
            <TableRow key={msg.id}>
              <TableCell className="text-xs whitespace-nowrap">
                {formatDate(msg.createdAt as string)}
              </TableCell>
              <TableCell className="text-sm">{msg.contactName}</TableCell>
              <TableCell>
                <Badge variant={typeBadgeVariant[msg.type] || 'outline'}>
                  {msg.type}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={msg.status === 'sent' ? 'default' : 'destructive'}>
                  {msg.status}
                </Badge>
                {msg.error && (
                  <p className="text-xs text-red-500 mt-0.5">{msg.error}</p>
                )}
              </TableCell>
              <TableCell className="max-w-md">
                {isExpanded ? (
                  <div>
                    <pre className="text-xs whitespace-pre-wrap font-sans">{msg.messageBody}</pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-6 text-xs"
                      onClick={() => setExpandedId(null)}
                    >
                      <ChevronUp className="h-3 w-3 mr-1" /> Collapse
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{preview}</span>
                    {msg.messageBody.length > 60 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setExpandedId(msg.id)}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
