// src/app/admin/inquiries/[inquiryId]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getInquiryById } from '@/services/inquiryService';
import { ArrowLeft, Calendar, Users, MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { InquiryStatusUpdate } from '../_components/inquiry-status-update'; // Re-use status component
import { InquiryResponseForm } from './_components/inquiry-response-form'; // New component for response
import { InquiryConversation } from './_components/inquiry-conversation'; // New component for conversation

interface InquiryDetailPageProps {
  params: { inquiryId: string };
}

export const dynamic = 'force-dynamic'; // Ensure fresh data

// Helper function to get status color (copied from inquiry-table)
const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'responded': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'converted': return 'bg-green-100 text-green-800 border-green-300';
    case 'closed': return 'bg-gray-100 text-gray-800 border-gray-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

async function InquiryDetailContent({ inquiryId }: { inquiryId: string }) {
  const inquiry = await getInquiryById(inquiryId);

  if (!inquiry) {
    notFound();
  }

  const checkInDate = inquiry.checkIn instanceof Date ? inquiry.checkIn : null;
  const checkOutDate = inquiry.checkOut instanceof Date ? inquiry.checkOut : null;
  const createdAtDate = inquiry.createdAt instanceof Date ? inquiry.createdAt : null;

  return (
     <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-start">
             <div>
                <Link href="/admin/inquiries" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center mb-2">
                   <ArrowLeft className="h-4 w-4 mr-1" /> Back to Inquiries
                </Link>
                <CardTitle>Inquiry Details</CardTitle>
                <CardDescription>
                   Received {createdAtDate ? format(createdAtDate, 'PPP p') : 'N/A'} for property: {inquiry.propertySlug}
                </CardDescription>
             </div>
             <InquiryStatusUpdate inquiryId={inquiry.id} currentStatus={inquiry.status} />
          </div>

        </CardHeader>
        <CardContent className="space-y-6">
          {/* Guest & Booking Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg">Guest Information</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><strong>Name:</strong> {inquiry.guestInfo.firstName} {inquiry.guestInfo.lastName || ''}</p>
                <p><strong>Email:</strong> <a href={`mailto:${inquiry.guestInfo.email}`} className="text-primary hover:underline">{inquiry.guestInfo.email}</a></p>
                <p><strong>Phone:</strong> {inquiry.guestInfo.phone || 'Not provided'}</p>
              </CardContent>
            </Card>
             <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg">Requested Stay</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="flex items-center"><Calendar className="h-4 w-4 mr-2 text-muted-foreground" /> <strong>Check-in:</strong> {checkInDate ? format(checkInDate, 'PPP') : 'N/A'}</p>
                <p className="flex items-center"><Calendar className="h-4 w-4 mr-2 text-muted-foreground" /> <strong>Check-out:</strong> {checkOutDate ? format(checkOutDate, 'PPP') : 'N/A'}</p>
                <p className="flex items-center"><Users className="h-4 w-4 mr-2 text-muted-foreground" /> <strong>Guests:</strong> {inquiry.guestCount}</p>
              </CardContent>
            </Card>
          </div>

           {/* Initial Message */}
           <Card>
             <CardHeader>
               <CardTitle className="text-lg flex items-center"><MessageSquare className="h-5 w-5 mr-2 text-primary" /> Guest's Message</CardTitle>
             </CardHeader>
             <CardContent className="whitespace-pre-wrap bg-secondary/30 p-4 rounded-md border">
               {inquiry.message}
             </CardContent>
           </Card>

          <Separator />

           {/* Conversation History */}
           <InquiryConversation responses={inquiry.responses || []} />

           {/* Response Form */}
           <InquiryResponseForm inquiryId={inquiry.id} />

        </CardContent>
         <CardFooter className="flex justify-end gap-2">
             {/* TODO: Add "Convert to Booking" button/logic */}
             <Button variant="outline" disabled>Convert to Booking (NYI)</Button>
             {/* TODO: Add ability to mark as Closed directly? Status dropdown handles it mostly */}
         </CardFooter>
      </Card>
  );
}


export default function InquiryDetailPage({ params }: InquiryDetailPageProps) {
  return (
    <div className="container mx-auto py-10">
      <Suspense fallback={<div>Loading inquiry details...</div>}>
        <InquiryDetailContent inquiryId={params.inquiryId} />
      </Suspense>
    </div>
  );
}
