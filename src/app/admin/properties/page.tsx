// src/app/admin/properties/page.tsx
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchProperties } from './actions';
import { PropertyTable } from './_components/property-table';
import { AdminPage, EmptyState } from '@/components/admin';
import { PlusCircle, Building } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ManagePropertiesPage() {
  const properties = await fetchProperties();

  return (
    <AdminPage
      title="Properties"
      description="View, edit, or delete your rental properties"
      actions={
        <Link href="/admin/properties/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Property
          </Button>
        </Link>
      }
    >
      <Card>
        <CardContent className="pt-6">
          {properties.length > 0 ? (
            <PropertyTable properties={properties} />
          ) : (
            <EmptyState
              icon={Building}
              title="No properties yet"
              description="Add your first property to start managing bookings and pricing"
              action={{ label: 'Add Property', href: '/admin/properties/new' }}
            />
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
