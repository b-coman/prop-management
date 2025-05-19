export default function TestPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Test Page</h1>
      <p>This is a minimal test page to verify deployment.</p>
      <p>Time: {new Date().toISOString()}</p>
    </div>
  );
}