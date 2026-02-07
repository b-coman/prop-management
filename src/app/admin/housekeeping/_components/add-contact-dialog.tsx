'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { addHousekeepingContact } from '../actions';

interface AddContactDialogProps {
  propertyId: string;
}

export function AddContactDialog({ propertyId }: AddContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('ro');
  const [role, setRole] = useState('cleaning');
  const [notifyMonthly, setNotifyMonthly] = useState(true);
  const [notifyDaily, setNotifyDaily] = useState(true);
  const [notifyChanges, setNotifyChanges] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('propertyId', propertyId);
    formData.set('name', name);
    formData.set('phone', phone);
    formData.set('language', language);
    formData.set('role', role);
    if (notifyMonthly) formData.set('notifyMonthly', 'on');
    if (notifyDaily) formData.set('notifyDaily', 'on');
    if (notifyChanges) formData.set('notifyChanges', 'on');

    startTransition(async () => {
      const result = await addHousekeepingContact(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        setName('');
        setPhone('');
        setLanguage('ro');
        setRole('cleaning');
        setNotifyMonthly(true);
        setNotifyDaily(true);
        setNotifyChanges(true);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Housekeeping Contact</DialogTitle>
            <DialogDescription>
              Add a cleaning staff member to receive WhatsApp notifications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                placeholder="Maria"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone (E.164)</Label>
              <Input
                id="contact-phone"
                placeholder="+40712345678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ro">Romanian</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Notifications</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={notifyMonthly} onCheckedChange={(v) => setNotifyMonthly(v === true)} />
                  Monthly schedule (1st of month)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={notifyDaily} onCheckedChange={(v) => setNotifyDaily(v === true)} />
                  Daily check-in/check-out alerts
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={notifyChanges} onCheckedChange={(v) => setNotifyChanges(v === true)} />
                  Booking change notifications
                </label>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
