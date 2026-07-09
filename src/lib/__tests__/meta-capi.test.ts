/** @jest-environment node */
import { sendMetaEvent } from '../meta-capi';
import { getPixelIdForProperty } from '../meta-pixels';

describe('getPixelIdForProperty (per-property pixel resolution)', () => {
  it('resolves a configured property and nothing else', () => {
    expect(getPixelIdForProperty('prahova-mountain-chalet')).toBe('1010060168431159');
    expect(getPixelIdForProperty('coltei-apartment-bucharest')).toBeUndefined();
    expect(getPixelIdForProperty(null)).toBeUndefined();
    expect(getPixelIdForProperty(undefined)).toBeUndefined();
  });
});

describe('sendMetaEvent — multi-property isolation', () => {
  const origTokens = process.env.META_CAPI_TOKENS;
  beforeAll(() => {
    process.env.META_CAPI_TOKENS = JSON.stringify({ 'prahova-mountain-chalet': 'tok-prahova' });
  });
  afterAll(() => {
    process.env.META_CAPI_TOKENS = origTokens;
  });
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => 'ok' });
  });

  it('fires to the PROPERTY-SPECIFIC pixel + token when configured', async () => {
    await sendMetaEvent({ propertyId: 'prahova-mountain-chalet', eventName: 'Purchase', eventId: 'e1' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/1010060168431159/events'); // Prahova's pixel
    expect(JSON.parse((opts as { body: string }).body).access_token).toBe('tok-prahova');
  });

  it('does NOT fire for a property with no pixel/token (no cross-property pollution)', async () => {
    await sendMetaEvent({ propertyId: 'coltei-apartment-bucharest', eventName: 'Purchase', eventId: 'e2' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
