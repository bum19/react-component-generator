// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGenerationStream } from './streaming';
import { readServerSentEvents } from '../src/utils/serverSentEvents';

const encoder = new TextEncoder();
const frame = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
const options = {
  provider: 'google' as const, prompt: '카드', apiKey: 'test-secret',
  systemPrompt: 'Generate React', models: ['first', 'second'],
};

afterEach(() => vi.unstubAllGlobals());

describe('createGenerationStream', () => {
  it('공급자 연결 오류에 포함된 비밀 키를 오류 이벤트에 노출하지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(`Failed URL ?key=${options.apiKey}`)));
    const response = await createGenerationStream(options).text();
    expect(response).toContain('"type":"error"');
    expect(response).not.toContain(options.apiKey);
  });
  it('클라이언트가 스트림을 닫으면 공급자 요청을 취소한다', async () => {
    let signal!: AbortSignal;
    const fetchMock = vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      signal = init.signal;
      signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const events = readServerSentEvents(createGenerationStream(options).body!);
    await events.next();
    await events.return(undefined);
    expect(signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['google', [{ candidates: [{ content: { parts: [{ text: 'partial' }] } }] }]],
    ['google', [{ candidates: [{ finishReason: 'STOP' }] }]],
    ['anthropic', [{ type: 'content_block_delta', delta: { type: 'text_delta', text: 'partial' } }]],
    ['anthropic', [{ type: 'message_delta', delta: { stop_reason: 'max_tokens' } }, { type: 'message_stop' }]],
    ['anthropic', [{ type: 'error', error: { type: 'overloaded_error', message: 'private upstream details' } }]],
  ] as const)('%s의 불완전하거나 실패한 응답을 완료 코드로 취급하지 않는다 (%j)', async (provider, frames) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(new Blob(frames.map(frame))))));
    const events = [];
    for await (const data of readServerSentEvents(createGenerationStream({ ...options, provider }).body!)) events.push(JSON.parse(data));
    expect(events.at(-1).type).toBe('error');
    expect(events.some(event => event.type === 'done')).toBe(false);
    expect(JSON.stringify(events)).not.toContain('private upstream details');
  });
  it('Anthropic 텍스트 델타를 전달하고 message_stop에서 완료한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob([
      frame({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'render(<div>Claude</div>);' } }),
      frame({ type: 'message_stop' }),
    ])));
    vi.stubGlobal('fetch', fetchMock);
    const events = [];
    for await (const data of readServerSentEvents(createGenerationStream({ ...options, provider: 'anthropic' }).body!)) events.push(JSON.parse(data));
    expect(events).toEqual([
      { type: 'reset' }, { type: 'delta', text: 'render(<div>Claude</div>);' },
      { type: 'done', code: 'render(<div>Claude</div>);' },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBe(true);
  });
  it.each([
    [503, 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.'],
    [429, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'],
  ])('모든 모델이 %s로 실패하면 오류 이벤트로 스트림을 종료한다', async (status, error) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status }))));
    const events = [];
    for await (const data of readServerSentEvents(createGenerationStream(options).body!)) events.push(JSON.parse(data));
    expect(events.at(-1)).toEqual({ type: 'error', error });
    expect(events.some(event => event.type === 'done')).toBe(false);
  });
  it('Google 스트림 실패 후 다음 모델로 재시도하기 전에 부분 코드를 초기화한다', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(frame({ candidates: [{ content: { parts: [{ text: 'broken code' }] }, finishReason: 'MAX_TOKENS' }] })))
      .mockResolvedValueOnce(new Response(frame({ candidates: [{ content: { parts: [{ text: 'render(<div>완료</div>);' }] }, finishReason: 'STOP' }] })));
    vi.stubGlobal('fetch', fetchMock);
    const events = [];
    for await (const data of readServerSentEvents(createGenerationStream(options).body!)) events.push(JSON.parse(data));
    expect(events).toEqual([
      { type: 'reset' },
      { type: 'delta', text: 'broken code' },
      { type: 'reset' },
      { type: 'delta', text: 'render(<div>완료</div>);' },
      { type: 'done', code: 'render(<div>완료</div>);' },
    ]);
    expect(fetchMock.mock.calls[1][0]).toContain('second:streamGenerateContent');
  });
  it('Google 텍스트를 완료 전에 전달하고 마지막 코드를 정규화한다', async () => {
    let upstream!: ReadableStreamDefaultController<Uint8Array>;
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) { upstream = controller; },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const response = createGenerationStream(options);
    const events = readServerSentEvents(response.body!);
    expect(JSON.parse((await events.next()).value!)).toEqual({ type: 'reset' });
    upstream.enqueue(frame({ candidates: [{ content: { parts: [{ text: '```jsx\nconst Card = () => <div>카드</div>;' }] } }] }));
    expect(JSON.parse((await events.next()).value!)).toEqual({ type: 'delta', text: '```jsx\nconst Card = () => <div>카드</div>;' });
    upstream.enqueue(frame({ candidates: [{ content: { parts: [{ text: '\n```' }] }, finishReason: 'STOP' }] }));
    upstream.close();
    expect(JSON.parse((await events.next()).value!).type).toBe('delta');
    expect(JSON.parse((await events.next()).value!)).toEqual({ type: 'done', code: 'const Card = () => <div>카드</div>;\n\nrender(<Card />);' });
    expect(fetchMock.mock.calls[0][0]).toContain('first:streamGenerateContent?alt=sse');
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
  });
});
