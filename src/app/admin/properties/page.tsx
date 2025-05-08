// src/app/admin/properties/page.tsx
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchProperties } from './actions'; // Action to fetch properties
import { PropertyTable } from './_components/property-table'; // Component to display table
import { PlusCircle } from 'lucide-react';

export const dynamic = 'force-dynamic'; // Ensure fresh data

export default async function ManagePropertiesPage() {
  const properties = await fetchProperties();

  return (
    <div className="container mx-auto py-10">
      <Card className="mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Properties</CardTitle>
            <CardDescription>
              View, edit, or delete your rental properties.
            </CardDescription>
          </div>
          <Link href="/admin/properties/new" passHref>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Property
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {properties.length > 0 ? (
            <PropertyTable properties={properties} />
          ) : (
            <p className="text-center text-muted-foreground">No properties found. Add your first property!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
