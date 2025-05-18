'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Database } from 'lucide-react';
import { isFirestoreAvailable } from '@/lib/firebaseClientAdmin';

export function ClientFirebaseCheck() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  
  useEffect(() => {
    // Check Firebase availability
    const available = isFirestoreAvailable();
    setIsAvailable(available);
  }, []);
  
  if (isAvailable === null) {
    return (
      <Alert className="mb-4 bg-blue-50 border-blue-200">
        <Database className="h-4 w-4" />
        <AlertTitle className="text-blue-800">Checking Firebase status...</AlertTitle>
        <AlertDescription className="text-blue-700">
          <p>Verifying connection to the Firestore database.</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (!isAvailable) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Firestore Unavailable</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Could not connect to Firebase. The admin interface may not function correctly.
          </p>
          <p className="text-sm mt-2">
            Please check your Firebase configuration in browser console.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="success" className="mb-4 bg-green-50 border-green-200">
      <CheckCircle className="h-4 w-4 text-green-700" />
      <AlertTitle className="text-green-800">Connected to Firestore</AlertTitle>
      <AlertDescription className="text-green-700">
        <p>Firebase Client SDK is connected and working properly.</p>
      </AlertDescription>
    </Alert>
  );
}