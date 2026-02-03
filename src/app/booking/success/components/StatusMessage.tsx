/**
 * @fileoverview Status message component for success page
 * @module app/booking/success/components/StatusMessage
 * @description Toast-like status message that replaces browser alerts
 */

import { CheckCircle, AlertCircle, X } from 'lucide-react';

export interface StatusMessageData {
  type: 'success' | 'error';
  message: string;
}

interface StatusMessageProps {
  statusMessage: StatusMessageData | null;
  onDismiss?: () => void;
}

export function StatusMessage({ statusMessage, onDismiss }: StatusMessageProps) {
  if (!statusMessage) return null;

  return (
    <div className={`mx-6 mb-6 p-4 rounded-md flex items-start ${
      statusMessage.type === 'success'
        ? 'bg-green-50 border border-green-100 text-green-700'
        : 'bg-red-50 border border-red-100 text-red-700'
    }`}>
      {statusMessage.type === 'success' ? (
        <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
      )}
      <div className="text-sm flex-1">{statusMessage.message}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 p-1 hover:bg-black/5 rounded min-h-[44px] min-w-[44px] flex items-center justify-center -m-2"
          aria-label="Dismiss message"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
