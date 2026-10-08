// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('stream 요청을 SSE 응답으로 연결하고 CORS 헤더를 유지한다', async () => {
  const serve = vi.fn().mockReturnValue({ port: 3002 });
  vi.stubGlobal('Bun', { serve });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"render(<div />);"}}\n\ndata: {"type":"message_stop"}\n\n',
  ))));
  await import('./index');
  const handleRequest = serve.mock.calls[0][0].fetch;
  const response: Response = await handleRequest(new Request('http://localhost/api/generate', {
    method: 'POST', body: JSON.stringify({ prompt: '카드', apiKey: 'test-key', provider: 'anthropic', stream: true }),
  }));
  expect(response.headers.get('Content-Type')).toContain('text/event-stream');
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(await response.text()).toContain('"type":"done"');
});
