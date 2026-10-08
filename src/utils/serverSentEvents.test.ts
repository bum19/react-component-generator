import { describe, expect, it } from 'vitest';
import { readServerSentEvents } from './serverSentEvents';

describe('readServerSentEvents', () => {
  it('네트워크 청크와 UTF-8 문자 경계가 나뉘어도 SSE 데이터를 순서대로 읽는다', async () => {
    const bytes = new TextEncoder().encode(': ping\r\nevent: delta\r\ndata: {"text":"카드"}\r\n\r\ndata: {"done":true}\n\n');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    });
    const events: string[] = [];
    for await (const data of readServerSentEvents(body)) events.push(data);
    expect(events).toEqual(['{"text":"카드"}', '{"done":true}']);
  });
});
