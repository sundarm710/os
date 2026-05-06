import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postJson, WebhookError } from './webhookClient';

// Vitest doesn't expose import.meta.env values mocked in vitest.config; for
// these tests we rely on default-undefined behavior only where it matters.
// VITE_AUTH_TOKEN is read at module load — we set it via stubGlobal here.

const URL = 'https://test.local/webhook/x';

describe('postJson', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('VITE_AUTH_TOKEN', 'test-token-abc');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('throws when URL is empty', async () => {
    await expect(postJson('', { a: 1 })).rejects.toThrow(/URL is empty/);
  });

  it('throws when VITE_AUTH_TOKEN is missing', async () => {
    vi.stubEnv('VITE_AUTH_TOKEN', '');
    await expect(postJson(URL, { a: 1 })).rejects.toThrow(/VITE_AUTH_TOKEN/);
  });

  it('sends JSON body with auth header on success', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 200, statusText: 'OK' }),
    );

    const payload = { hello: 'world' };
    const res = await postJson(URL, payload);
    expect(res.ok).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(URL);
    expect(init.method).toBe('POST');

    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Auth-Token')).toBe('test-token-abc');

    expect(init.body).toBe(JSON.stringify(payload));
  });

  it('throws WebhookError with status + body on non-2xx', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response('forbidden', { status: 403 }),
    );

    await expect(postJson(URL, {})).rejects.toMatchObject({
      name: 'WebhookError',
      status: 403,
      body: 'forbidden',
    });
  });

  it('WebhookError preserves message format for logging', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response('oops', { status: 500 }),
    );

    try {
      await postJson(URL, {});
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(WebhookError);
      expect((e as Error).message).toContain('500');
      expect((e as Error).message).toContain('oops');
    }
  });
});
