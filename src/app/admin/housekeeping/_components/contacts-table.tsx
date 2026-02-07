'use client';

import { useState, useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Send, Loader2 } from 'lucide-react';
import type { HousekeepingContact } from '@/types';
import { toggleContactEnabled, deleteHousekeepingContact, sendTestMessage } from '../actions';

interface ContactsTableProps {
  contacts: HousekeepingContact[];
}

export function ContactsTable({ contacts }: ContactsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ contactId: string; success: boolean; error?: string } | null>(null);

  const handleToggle = (contactId: string, enabled: boolean) => {
    setActionTarget(contactId);
    startTransition(async () => {
      await toggleContactEnabled(contactId, enabled);
      setActionTarget(null);
    });
  };

  const handleDelete = (contactId: string) => {
    if (!confirm('Delete this contact?')) return;
    setActionTarget(contactId);
    startTransition(async () => {
      await deleteHousekeepingContact(contactId);
      setActionTarget(null);
    });
  };

  const handleTestMessage = (contactId: string) => {
    setActionTarget(contactId);
    setTestResult(null);
    startTransition(async () => {
      const result = await sendTestMessage(contactId);
      setTestResult({ contactId, ...result });
      setActionTarget(null);
    });
  };

  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No contacts added yet. Add a contact to start sending notifications.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Notifications</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => (
          <TableRow key={contact.id}>
            <TableCell className="font-medium">
              {contact.name}
              <span className="text-xs text-muted-foreground ml-1">({contact.language})</span>
            </TableCell>
            <TableCell className="font-mono text-sm">{contact.phone}</TableCell>
            <TableCell>
              <Badge variant="outline">{contact.role}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-1 flex-wrap">
                {contact.notifyMonthly && <Badge variant="secondary" className="text-xs">Monthly</Badge>}
                {contact.notifyDaily && <Badge variant="secondary" className="text-xs">Daily</Badge>}
                {contact.notifyChanges && <Badge variant="secondary" className="text-xs">Changes</Badge>}
              </div>
            </TableCell>
            <TableCell>
              <Switch
                checked={contact.enabled}
                onCheckedChange={(checked) => handleToggle(contact.id, checked)}
                disabled={isPending && actionTarget === contact.id}
              />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex gap-1 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestMessage(contact.id)}
                  disabled={isPending && actionTarget === contact.id}
                  title="Send test message"
                >
                  {isPending && actionTarget === contact.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(contact.id)}
                  disabled={isPending && actionTarget === contact.id}
                  className="text-destructive hover:text-destructive"
                  title="Delete contact"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {testResult && testResult.contactId === contact.id && (
                <p className={`text-xs mt-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? 'Sent!' : testResult.error || 'Failed'}
                </p>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
