// Cloud Run readiness check endpoint
export async function GET() {
  // Cloud Run expects a 200 response for readiness
  return new Response('OK', { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}