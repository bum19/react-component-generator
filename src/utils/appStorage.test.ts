import { beforeEach, describe, expect, it } from 'vitest';
import { loadAppState, saveAppState } from './appStorage';

describe('appStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('API 키, Provider, 프롬프트 히스토리, 생성 컴포넌트를 저장하고 복원한다', () => {
    const createdAt = new Date('2026-10-08T00:00:00.000Z');

    saveAppState({
      apiKey: 'test-key',
      provider: 'anthropic',
      promptHistory: ['프로필 카드'],
      components: [
        { id: 'component-1', prompt: '프로필 카드', code: 'render(<div />)', createdAt },
      ],
    });

    expect(loadAppState()).toEqual({
      apiKey: 'test-key',
      provider: 'anthropic',
      promptHistory: ['프로필 카드'],
      components: [
        { id: 'component-1', prompt: '프로필 카드', code: 'render(<div />)', createdAt },
      ],
    });
  });

  it('손상된 저장값이면 기본 상태를 반환한다', () => {
    localStorage.setItem('react-component-generator:state', '{invalid json');

    expect(loadAppState()).toEqual({
      apiKey: '',
      provider: 'google',
      promptHistory: [],
      components: [],
    });
  });
});
