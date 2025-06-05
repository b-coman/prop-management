// src/app/admin/inquiries/[inquiryId]/_components/inquiry-response-form.tsx
"use client";

import * as React from 'react';
import { useState, useTransition } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { addResponseToInquiryAction } from '../../actions';
import { Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InquiryResponseFormProps {
  inquiryId: string;
}

const responseFormSchema = z.object({
  message: z.string().min(1, "Response message cannot be empty.").max(2000, "Response message too long."),
});

export function InquiryResponseForm({ inquiryId }: InquiryResponseFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof responseFormSchema>>({
    resolver: zodResolver(responseFormSchema),
    defaultValues: {
      message: "",
    },
  });

  async function onSubmit(values: z.infer<typeof responseFormSchema>) {
    startTransition(async () => {
      const result = await addResponseToInquiryAction({ inquiryId, message: values.message });
      if (result.success) {
        toast({ title: "Response Sent", description: "Your response has been added to the inquiry." });
        form.reset(); // Clear the form on success
      } else {
        toast({ title: "Error Sending Response", description: result.error || "Could not send response.", variant: "destructive" });
      }
    });
  }

  return (
     <Card className="mt-6 border-primary/50">
        <CardHeader>
            <CardTitle className="text-lg">Send Response</CardTitle>
        </CardHeader>
        <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="response-message">Your Message</FormLabel>
                      <FormControl>
                        <Textarea
                          id="response-message"
                          placeholder="Type your response to the guest here..."
                          rows={4}
                          disabled={isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {isPending ? "Sending..." : "Send Response"}
                </Button>
              </form>
            </Form>
        </CardContent>
     </Card>
  );
}
