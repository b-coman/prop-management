/** @jest-environment node */
import { metaGraph, createResource, pauseResource, activateResource, deleteResource, GRAPH_API_VERSION } from '../client';

const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('metaGraph — token placement (Fable M5)', () => {
  it('NEVER puts the token in the URL, for GET', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: '123' }) });
    await metaGraph('act_123/campaigns', { method: 'GET', params: { fields: 'id,name' }, token: 'SECRET-TOKEN' });

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).not.toContain('SECRET-TOKEN');
    expect(String(url)).not.toContain('access_token');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SECRET-TOKEN');
  });

  it('NEVER puts the token in the URL or body, for POST', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: '123' }) });
    await metaGraph('act_123/campaigns', {
      method: 'POST',
      params: { name: 'Test Campaign' },
      token: 'SECRET-TOKEN',
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).not.toContain('SECRET-TOKEN');
    expect(String(init.body)).not.toContain('SECRET-TOKEN');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SECRET-TOKEN');
  });

  it('builds the URL from the single GRAPH_API_VERSION constant', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    await metaGraph('act_123/campaigns', { method: 'GET', token: 't' });
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain(`graph.facebook.com/${GRAPH_API_VERSION}/`);
  });

  it('returns a typed {ok:false,error} on a non-OK response, never throws', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":"bad request"}' });
    const result = await metaGraph('act_123/campaigns', { method: 'GET', token: 't' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('bad request');
      expect(result.status).toBe(400);
    }
  });

  it('returns a typed {ok:false,error} on a network error, never throws', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const result = await metaGraph('act_123/campaigns', { method: 'GET', token: 't' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('network down');
  });
});

describe('createResource — PAUSED enforcement (Fable C2)', () => {
  it('injects status:PAUSED when the caller supplies no status', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'campaign-1' }) });
    await createResource('campaigns', 'act_123', 'tok', { name: 'Test' });

    const [, init] = mockFetch.mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.get('status')).toBe('PAUSED');
    expect(body.get('name')).toBe('Test');
  });

  it('OVERRIDES a caller-supplied status — cannot be made to create live (Fable C2)', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'campaign-1' }) });
    await createResource('campaigns', 'act_123', 'tok', { name: 'Test', status: 'ACTIVE' });

    const [, init] = mockFetch.mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.get('status')).toBe('PAUSED'); // NOT 'ACTIVE'
  });

  it('POSTs to <adAccountId>/<node>', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'campaign-1' }) });
    await createResource('campaigns', 'act_543311232953437', 'tok', { name: 'Test' });

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('act_543311232953437/campaigns');
    expect(init.method).toBe('POST');
  });
});

describe('pauseResource / activateResource — status transitions', () => {
  it('pauseResource POSTs status=PAUSED to the resource id', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await pauseResource('120210000000001', 'tok');

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('120210000000001');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('status')).toBe('PAUSED');
  });

  it('activateResource POSTs status=ACTIVE to the resource id', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await activateResource('120210000000001', 'tok');

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('120210000000001');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('status')).toBe('ACTIVE');
  });
});

describe('deleteResource — rollback primitive', () => {
  it('sends a DELETE to the resource id, token in header not URL', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await deleteResource('120210000000001', 'SECRET-TOKEN', 'prahova-mountain-chalet');

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('120210000000001');
    expect(init.method).toBe('DELETE');
    expect(String(url)).not.toContain('SECRET-TOKEN');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SECRET-TOKEN');
  });

  it('returns a typed {ok:false,error} on failure, never throws', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":"cannot delete"}' });
    const result = await deleteResource('120210000000001', 'tok');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('cannot delete');
  });
});
