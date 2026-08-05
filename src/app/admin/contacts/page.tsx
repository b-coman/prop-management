import { AdminPage } from '@/components/admin';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { fetchContactsAction } from './actions';
import { ContactConsole } from './_components/contact-console';

export const dynamic = 'force-dynamic';

const DEFAULT_PROPERTY = 'prahova-mountain-chalet';

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; guestId?: string }>;
}) {
  const { propertyId, guestId } = await searchParams;
  const property = propertyId || DEFAULT_PROPERTY;
  const contacts = await fetchContactsAction();

  return (
    <AdminPage
      title="Contacts"
      description="Everything that happens off WhatsApp — phone calls above all. Write it here right after you hang up: the system reads messages, so a relationship held on the phone is invisible to it until you say so. Also where a new caller becomes a record."
    >
      <PropertyUrlSync />
      <ContactConsole contacts={contacts} propertyId={property} initialGuestId={guestId} />
    </AdminPage>
  );
}
