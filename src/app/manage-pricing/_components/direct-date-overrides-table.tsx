'use client';

import { useDirectDateOverrides } from '../direct-data';
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface DirectDateOverridesTableProps {
  propertyId: string;
}

export default function DirectDateOverridesTable({ propertyId }: DirectDateOverridesTableProps) {
  const router = useRouter();
  const { overrides, loading, error } = useDirectDateOverrides(propertyId);
  
  // Format date string
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return <div className="py-6 text-center text-slate-500">Loading date overrides...</div>;
  }

  if (error) {
    return <div className="py-6 text-center text-red-500">{error}</div>;
  }

  if (overrides.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-slate-500 mb-4">No date overrides defined for this property</p>
        <Button>Create First Date Override (Local Data Mode)</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mb-4 text-xs text-blue-700">
        Currently showing local test data. Changes won't persist.
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Custom Price</TableHead>
            <TableHead>Min. Stay</TableHead>
            <TableHead>Pricing</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {overrides.map((override) => (
            <TableRow key={override.id}>
              <TableCell className="font-medium">{formatDate(override.date)}</TableCell>
              <TableCell>{override.customPrice}</TableCell>
              <TableCell>{override.minimumStay || 1} night{override.minimumStay !== 1 ? 's' : ''}</TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Badge className={override.flatRate ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                    {override.flatRate ? 'Flat Rate' : 'Per Person'}
                  </Badge>
                  <Switch
                    checked={override.flatRate}
                    onCheckedChange={() => {}} // No-op in local data mode
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Badge className={override.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {override.available ? 'Available' : 'Unavailable'}
                  </Badge>
                  <Switch
                    checked={override.available}
                    onCheckedChange={() => {}} // No-op in local data mode
                  />
                </div>
              </TableCell>
              <TableCell className="max-w-[200px] truncate" title={override.reason || ''}>
                {override.reason || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}