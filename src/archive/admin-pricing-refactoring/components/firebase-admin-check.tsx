import { isFirestoreAdminAvailable, getInitializationError } from '@/lib/firebaseAdminBasic';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle } from 'lucide-react';

export function FirebaseAdminCheck() {
  const isAvailable = isFirestoreAdminAvailable();
  const initError = getInitializationError();

  if (!isAvailable) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Firestore Unavailable</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Could not connect to Firebase Admin SDK. The admin interface may not function correctly.
          </p>
          {initError && (
            <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-900 border border-red-200">
              <p className="font-medium">Error Details:</p>
              <p className="text-xs mt-1">{initError.toString()}</p>
            </div>
          )}
          <p className="text-sm mt-2">
            Please check your Firebase Admin configuration and service account credentials.
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
        <p>Firebase Admin SDK is connected and working properly.</p>
      </AlertDescription>
    </Alert>
  );
}