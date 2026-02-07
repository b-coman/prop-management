'use client';

import { useState } from 'react';
import { processUnsubscribe } from '../actions';

interface UnsubscribeConfirmationProps {
  email: string;
  token: string;
}

export function UnsubscribeConfirmation({ email, token }: UnsubscribeConfirmationProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleUnsubscribe = async () => {
    setStatus('loading');
    const result = await processUnsubscribe(email, token);
    if (result.success) {
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMessage(result.error || 'An error occurred.');
    }
  };

  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="text-green-600 text-4xl mb-4">&#10003;</div>
        <h2 className="text-xl font-semibold mb-2">Unsubscribed</h2>
        <p className="text-muted-foreground">
          You have been successfully unsubscribed from marketing emails.
          You will still receive transactional emails related to your bookings.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-center">
        <div className="text-red-600 text-4xl mb-4">&#10007;</div>
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold mb-2">Unsubscribe from emails</h2>
      <p className="text-muted-foreground mb-6">
        Are you sure you want to unsubscribe <strong>{email}</strong> from marketing emails?
        You will still receive transactional emails related to your bookings.
      </p>
      <button
        onClick={handleUnsubscribe}
        disabled={status === 'loading'}
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {status === 'loading' ? 'Processing...' : 'Confirm Unsubscribe'}
      </button>
    </div>
  );
}
