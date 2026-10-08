import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useComponentGenerator } from './useComponentGenerator';

afterEach(() => vi.unstubAllGlobals());

describe('useComponentGenerator streaming', () => {
  it.each([
    ['공급자 오류', 'data: {"type":"delta","text":"partial"}\n\ndata: {"type":"error","error":"재시도해주세요"}\n\n', '재시도해주세요'],
    ['완료 없는 연결 종료', 'data: {"type":"delta","text":"partial"}\n\n', '코드 생성이 완료되지 않았습니다. 다시 시도해주세요.'],
    ['파싱 오류', 'data: invalid-json\n\n', null],
  ])('%s에도 로딩을 해제하고 기존 컴포넌트만 유지한다', async (_name, body, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })));
    const original = { id: 'saved', prompt: '기존 카드', code: 'render(<div />);', createdAt: new Date() };
    const { result } = renderHook(() => useComponentGenerator([original]));
    await act(async () => result.current.generate('새 카드', undefined, 'google'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.pendingComponent).toBeNull();
    expect(result.current.components).toEqual([original]);
    if (message) expect(result.current.error).toBe(message);
    else expect(result.current.error).toBeTruthy();
  });

  it('모델 폴백 reset 이후에는 새 시도의 코드만 쌓는다', async () => {
    let upstream!: ReadableStreamDefaultController<Uint8Array>;
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream({ start(controller) { upstream = controller; } }), {
      headers: { 'Content-Type': 'text/event-stream' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useComponentGenerator());
    let generation!: Promise<void>;
    act(() => { generation = result.current.generate('새 카드', undefined, 'google'); });
    const send = (event: unknown) => act(async () => {
      upstream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
    });
    await send({ type: 'delta', text: 'failed attempt' });
    await waitFor(() => expect(result.current.pendingComponent?.code).toBe('failed attempt'));
    await send({ type: 'reset' });
    await send({ type: 'delta', text: 'new attempt' });
    expect(result.current.pendingComponent?.code).toBe('new attempt');
    await send({ type: 'done', code: 'render(<div>new attempt</div>);' });
    await act(async () => generation);
    expect(result.current.components[0].code).toBe('render(<div>new attempt</div>);');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('apiKey');
  });
});
