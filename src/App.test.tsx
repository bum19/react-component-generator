import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
