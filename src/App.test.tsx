import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { APP_STORAGE_KEY } from './utils/appStorage';

describe('App', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ envKeys: {} }) });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('생성 중 코드 탭에 실시간 코드를 보여주고 완료되면 미리보기로 전환한다', async () => {
    const user = userEvent.setup();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    fetchMock.mockResolvedValueOnce({ json: () => Promise.resolve({ envKeys: {} }) });
    fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) { stream = controller; } }), {
      headers: { 'Content-Type': 'text/event-stream' },
    }));
    const send = (event: unknown) => act(async () => {
      stream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
    });
    render(<App />);
    await user.type(screen.getByLabelText('API Key'), 'test-key');
    await user.type(screen.getByRole('textbox'), '실시간 카드');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));

    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '미리보기' })).toBeDisabled();
    await send({ type: 'delta', text: 'render(<div>' });
    expect(screen.getByText('render(<div>')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEY)!).components).toEqual([]);
    await send({ type: 'delta', text: '완성된 카드</div>);' });
    expect(screen.getByText('render(<div>완성된 카드</div>);')).toBeInTheDocument();
    await send({ type: 'done', code: 'render(<div>완성된 카드</div>);' });

    expect(screen.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.getByText('완성된 카드')).toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem(APP_STORAGE_KEY)!).components).toHaveLength(1);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ stream: true });
  });

  it('저장된 API 키, Provider, 생성 컴포넌트를 복원한다', () => {
    localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        apiKey: 'stored-key',
        provider: 'anthropic',
        promptHistory: ['프로필 카드'],
        components: [
          {
            id: 'component-1',
            prompt: '프로필 카드',
            code: 'render(<div>프로필 카드</div>)',
            createdAt: '2026-10-08T00:00:00.000Z',
          },
        ],
      }),
    );

    render(<App />);

    expect(screen.getByLabelText('API Key')).toHaveValue('stored-key');
    expect(screen.getByLabelText('Provider')).toHaveValue('anthropic');
    expect(screen.getByText('생성된 컴포넌트')).toBeInTheDocument();
  });

  it('생성 요청 후 프롬프트 히스토리와 컴포넌트 목록을 저장한다', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({ json: () => Promise.resolve({ envKeys: {} }) });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ code: 'render(<div>프로필 카드</div>)' }),
    });
    render(<App />);

    await user.type(screen.getByLabelText('API Key'), 'test-key');
    await user.type(screen.getByRole('textbox'), '프로필 카드');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));

    await waitFor(() => {
      const savedState = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? '');
      expect(savedState).toMatchObject({
        apiKey: 'test-key',
        provider: 'google',
        promptHistory: ['프로필 카드'],
        components: [
          expect.objectContaining({ prompt: '프로필 카드', code: 'render(<div>프로필 카드</div>)' }),
        ],
      });
    });
  });
});
