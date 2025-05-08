// src/app/admin/inquiries/[inquiryId]/_components/inquiry-conversation.tsx
"use client";

import type { Inquiry, SerializableTimestamp } from '@/types';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, MessageSquare } from 'lucide-react'; // Import icons
import { cn } from '@/lib/utils';

interface InquiryConversationProps {
  responses: NonNullable<Inquiry['responses']>; // Ensure responses array is not null/undefined
}

// Helper to parse date safely
const parseDateSafe = (dateStr: SerializableTimestamp | null | undefined): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    try { return new Date(String(dateStr)); } catch { return null; }
};

export function InquiryConversation({ responses }: InquiryConversationProps) {

  if (!responses || responses.length === 0) {
    return (
       <div className="text-center text-muted-foreground py-4">
           <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
           No responses yet.
       </div>
    );
  }

  return (
     <Card className="bg-muted/20">
        <CardHeader>
            <CardTitle className="text-lg">Conversation History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
           {responses
             .sort((a, b) => { // Sort by date, oldest first
                const dateA = parseDateSafe(a.createdAt)?.getTime() || 0;
                const dateB = parseDateSafe(b.createdAt)?.getTime() || 0;
                return dateA - dateB;
             })
             .map((response, index) => {
                const createdAtDate = parseDateSafe(response.createdAt);
                const alignmentClass = response.fromHost ? 'justify-end' : 'justify-start';
                const bubbleClass = response.fromHost
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'bg-secondary text-secondary-foreground rounded-bl-none';
                const avatarName = response.fromHost ? 'H' : 'G'; // Host vs Guest

                return (
                    <div key={index} className={cn('flex items-end gap-2', alignmentClass)}>
                        {/* Avatar (optional, for guest) */}
                        {!response.fromHost && (
                            <Avatar className="h-8 w-8">
                                {/* Add guest image if available */}
                                <AvatarFallback>{avatarName}</AvatarFallback>
                            </Avatar>
                        )}

                        {/* Message Bubble */}
                        <div className={cn('max-w-[75%] rounded-lg p-3 shadow-sm', bubbleClass)}>
                            <p className="text-sm whitespace-pre-wrap">{response.message}</p>
                            <p className="text-xs opacity-70 mt-1 text-right">
                                {createdAtDate ? format(createdAtDate, 'PPp') : 'Sending...'}
                            </p>
                        </div>

                         {/* Avatar (optional, for host) */}
                         {response.fromHost && (
                             <Avatar className="h-8 w-8">
                                 {/* Add host image if available */}
                                 <AvatarFallback className="bg-primary/20">{avatarName}</AvatarFallback>
                             </Avatar>
                         )}
                    </div>
                );
             })}
        </CardContent>
     </Card>
  );
}
