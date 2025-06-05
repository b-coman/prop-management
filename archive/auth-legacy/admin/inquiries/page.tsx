// src/app/admin/inquiries/page.tsx
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getInquiries } from '@/services/inquiryService'; // Import the fetch function
import { InquiryTable } from './_components/inquiry-table'; // Import the table component
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic'; // Ensure fresh data on each request

async function InquiriesContent() {
  const inquiries = await getInquiries();

  return (
     <Card className="mx-auto">
        <CardHeader>
          <CardTitle>Manage Inquiries</CardTitle>
          <CardDescription>
            View and respond to guest inquiries about your properties.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inquiries.length > 0 ? (
            <InquiryTable inquiries={inquiries} />
          ) : (
            <p className="text-center text-muted-foreground">No inquiries found.</p>
          )}
        </CardContent>
      </Card>
  );
}


export default function ManageInquiriesPage() {
 return (
    <div className="container mx-auto py-10">
       <Suspense fallback={<div className="flex justify-center items-center min-h-[200px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading inquiries...</span></div>}>
           <InquiriesContent />
       </Suspense>
    </div>
  );
}
