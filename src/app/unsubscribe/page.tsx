import { validateUnsubscribeToken } from '@/lib/unsubscribe-token';
import { UnsubscribeConfirmation } from './_components/unsubscribe-confirmation';

interface PageProps {
  searchParams: Promise<{ email?: string; token?: string }>;
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const email = params.email?.toLowerCase().trim() || '';
  const token = params.token || '';

  const isValid = email && token && validateUnsubscribeToken(email, token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        {isValid ? (
          <UnsubscribeConfirmation email={email} token={token} />
        ) : (
          <div className="text-center">
            <div className="text-red-600 text-4xl mb-4">&#10007;</div>
            <h2 className="text-xl font-semibold mb-2">Invalid Link</h2>
            <p className="text-muted-foreground">
              This unsubscribe link is invalid or has expired.
              Please use the link from a recent email.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
