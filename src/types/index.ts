export type Provider = 'anthropic' | 'google';

export type GenerationEvent =
  | { type: 'reset' }
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

export interface GeneratedComponent {
  id: string;
  prompt: string;
  code: string;
  createdAt: Date;
}
