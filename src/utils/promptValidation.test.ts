import { describe, expect, it } from 'vitest';
import { isPromptLengthValid } from './promptValidation';

describe('isPromptLengthValid', () => {
  it('500자까지 허용하고 501자는 거부한다', () => {
    expect(isPromptLengthValid('a'.repeat(500))).toBe(true);
    expect(isPromptLengthValid('a'.repeat(501))).toBe(false);
  });
});
