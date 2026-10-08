import type { GenerationEvent, Provider } from '../src/types';
import { readServerSentEvents } from '../src/utils/serverSentEvents';
import { ensureRenderCall, stripCodeFences } from './generator';
import { withModelFallback } from './fallback';

interface StreamOptions {
  provider: Provider;
  prompt: string;
  apiKey: string;
  systemPrompt: string;
  models: string[];
  headers?: Record<string, string>;
}

// Only locally authored errors may be sent to the browser; upstream errors can contain request URLs and keys.
class GenerationError extends Error {}

export function createGenerationStream(options: StreamOptions): Response {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: GenerationEvent) => {
        if (!abortController.signal.aborted) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        const attempt = async (model: string) => {
          abortController.signal.throwIfAborted();
          emit({ type: 'reset' });
          const anthropic = options.provider === 'anthropic';
          const response = await fetch(anthropic
            ? 'https://api.anthropic.com/v1/messages'
            : `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${options.apiKey}`, {
            method: 'POST',
            signal: abortController.signal,
            headers: anthropic ? {
              'Content-Type': 'application/json', 'x-api-key': options.apiKey, 'anthropic-version': '2023-06-01',
            } : { 'Content-Type': 'application/json' },
            body: JSON.stringify(anthropic ? {
              model, max_tokens: 4096, stream: true, system: options.systemPrompt,
              messages: [{ role: 'user', content: options.prompt }],
            } : {
              system_instruction: { parts: [{ text: options.systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
              generationConfig: { maxOutputTokens: 8192 },
            }),
          });
          if (!response.ok) throw new GenerationError(`${anthropic ? 'Claude' : 'Gemini'} API error: ${response.status}`);
          if (!response.body) throw new GenerationError('생성 응답을 읽을 수 없습니다.');
          let text = '';
          let completed = false;
          for await (const data of readServerSentEvents(response.body)) {
            const event = JSON.parse(data);
            if (event.type === 'error' || event.error) {
              const status = event.error?.type === 'overloaded_error' ? 503
                : event.error?.type === 'rate_limit_error' ? 429 : event.error?.code ?? 500;
              throw new GenerationError(`Provider API error: ${typeof status === 'number' ? status : 500}`);
            }
            const delta = anthropic
              ? (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' ? event.delta.text : '')
              : event.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ?? '';
            if (delta) {
              text += delta;
              emit({ type: 'delta', text: delta });
            }
            if (event.candidates?.[0]?.finishReason === 'MAX_TOKENS' || event.delta?.stop_reason === 'max_tokens') {
              throw new GenerationError('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
            }
            if (anthropic ? event.type === 'message_stop' : event.candidates?.[0]?.finishReason === 'STOP') completed = true;
          }
          if (!completed || !text.trim()) throw new GenerationError('코드 생성이 완료되지 않았습니다. 다시 시도해주세요.');
          return text;
        };
        const text = options.provider === 'google'
          ? await withModelFallback(options.models, attempt)
          : await attempt('claude-haiku-4-5-20251001');
        emit({ type: 'done', code: ensureRenderCall(stripCodeFences(text)) });
      } catch (err) {
        const message = err instanceof GenerationError ? err.message : '코드 생성 중 연결 오류가 발생했습니다. 다시 시도해주세요.';
        emit({ type: 'error', error: message.includes('503')
          ? 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
          : message.includes('429') ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' : message });
      } finally {
        if (!abortController.signal.aborted) controller.close();
      }
    },
    cancel() { abortController.abort(); },
  });
  return new Response(body, { headers: { ...options.headers, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
