// Cloud Run readiness check endpoint

// Cloud Run may send GET or POST requests
export async function GET() {
  return new Response('OK', { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}

export async function POST() {
  return new Response('OK', { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    }
  });
}