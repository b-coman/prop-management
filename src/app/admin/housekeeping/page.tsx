import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { ContactsTable } from './_components/contacts-table';
import { MessageLog } from './_components/message-log';
import { ManualSendCard } from './_components/manual-send-card';
import { AddContactDialog } from './_components/add-contact-dialog';
import { fetchHousekeepingContacts, fetchHousekeepingMessages } from './actions';

export const dynamic = 'force-dynamic';

export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const params = await Promise.resolve(searchParams);
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;

  let contacts: Awaited<ReturnType<typeof fetchHousekeepingContacts>> = [];
  let messages: Awaited<ReturnType<typeof fetchHousekeepingMessages>> = [];

  if (propertyId) {
    [contacts, messages] = await Promise.all([
      fetchHousekeepingContacts(propertyId),
      fetchHousekeepingMessages(propertyId),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Housekeeping</h1>
          <p className="text-muted-foreground mt-1">
            Manage cleaning staff contacts and WhatsApp notifications
          </p>
        </div>
      </div>

      <PropertyUrlSync />

      {propertyId ? (
        <Tabs defaultValue="contacts">
          <TabsList>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="messages">Message Log</TabsTrigger>
            <TabsTrigger value="send">Send Now</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4">
            <div className="flex justify-end">
              <AddContactDialog propertyId={propertyId} />
            </div>
            <ContactsTable contacts={contacts} />
          </TabsContent>

          <TabsContent value="messages">
            <MessageLog messages={messages} />
          </TabsContent>

          <TabsContent value="send">
            <ManualSendCard propertyId={propertyId} contactCount={contacts.filter(c => c.enabled).length} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-slate-500">
                Please select a property to manage its housekeeping contacts
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
