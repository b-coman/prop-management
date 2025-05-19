// Health check endpoint for Cloud Run

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