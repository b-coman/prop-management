// src/app/admin/properties/_components/property-table.tsx
"use client";

import Link from 'next/link';
import type { Property, SerializableTimestamp } from "@/types"; // Make sure Property type is available
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Eye } from "lucide-react"; // Import icons
import { DeletePropertyButton } from './delete-property-button'; // Import delete button

interface PropertyTableProps {
  properties: Property[];
}

// Helper function to get status color
const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 border-green-300';
    case 'inactive': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'draft': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};


export function PropertyTable({ properties }: PropertyTableProps) {
  return (
    <Table>
      <TableCaption>A list of your properties.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[250px]">Name</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {properties.map((property) => (
          <TableRow key={property.slug}>
            <TableCell className="font-medium">
              <Link href={`/admin/properties/${property.slug}`} className="hover:underline">
                 {typeof property.name === 'string' ? property.name : property.name?.en || property.name?.ro || 'Unnamed'}
              </Link>
              <p className="text-xs text-muted-foreground">{property.slug}</p>
            </TableCell>
            <TableCell>{property.location?.city || '-'}, {property.location?.country || '-'}</TableCell>
            <TableCell>
              <Badge className={cn(getStatusColor(property.status), "capitalize")}>
                 {property.status || 'unknown'}
              </Badge>
            </TableCell>
            <TableCell className="text-right space-x-2">
               <Link href={`/properties/${property.slug}`} passHref>
                 <Button variant="outline" size="icon" title="View Property Page">
                   <Eye className="h-4 w-4" />
                 </Button>
               </Link>
               <Link href={`/admin/properties/${property.slug}/edit`} passHref>
                 <Button variant="secondary" size="icon" title="Edit Property">
                   <Edit className="h-4 w-4" />
                 </Button>
               </Link>
               <DeletePropertyButton propertySlug={property.slug} propertyName={typeof property.name === 'string' ? property.name : property.name?.en || property.name?.ro || 'Unnamed'} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Helper function for cn if not globally available
function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(' ');
}
