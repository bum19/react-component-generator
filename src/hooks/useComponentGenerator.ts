import { useState, useCallback } from 'react';
import type { GeneratedComponent, GenerationEvent, Provider } from '../types';
import { readServerSentEvents } from '../utils/serverSentEvents';

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  pendingComponent: GeneratedComponent | null;
  isLoading: boolean;
  error: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(
  initialComponents: GeneratedComponent[] = [],
): UseComponentGeneratorReturn {
  const [components, setComponents] = useState<GeneratedComponent[]>(initialComponents);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingComponent, setPendingComponent] = useState<GeneratedComponent | null>(null);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);
    const draft: GeneratedComponent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      prompt, code: '', createdAt: new Date(),
    };
    setPendingComponent(draft);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider, stream: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate component');
      }

      let code: string | undefined;
      if (res.headers?.get('Content-Type')?.includes('text/event-stream')) {
        if (!res.body) throw new Error('생성 응답을 읽을 수 없습니다.');
        for await (const data of readServerSentEvents(res.body)) {
          const event = JSON.parse(data) as GenerationEvent;
          if (event.type === 'reset') setPendingComponent({ ...draft, code: '' });
          if (event.type === 'delta') {
            setPendingComponent((current) => current && ({ ...current, code: current.code + event.text }));
          }
          if (event.type === 'error') throw new Error(event.error);
          if (event.type === 'done') {
            code = event.code;
            break;
          }
        }
      } else {
        code = (await res.json()).code;
      }
      if (!code?.trim()) throw new Error('코드 생성이 완료되지 않았습니다. 다시 시도해주세요.');

      setComponents((prev) => [{ ...draft, code }, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setPendingComponent(null);
      setIsLoading(false);
    }
  }, []);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, []);

  return { components, pendingComponent, isLoading, error, generate, removeComponent, clearAll };
}
