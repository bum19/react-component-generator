import type { GeneratedComponent, Provider } from '../types';

export const APP_STORAGE_KEY = 'react-component-generator:state';

export interface PersistedAppState {
  apiKey: string;
  provider: Provider;
  promptHistory: string[];
  components: GeneratedComponent[];
}

const defaultAppState: PersistedAppState = {
  apiKey: '',
  provider: 'google',
  promptHistory: [],
  components: [],
};

export function saveAppState(state: PersistedAppState): void {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
}

export function loadAppState(): PersistedAppState {
  const storedState = localStorage.getItem(APP_STORAGE_KEY);

  if (!storedState) {
    return defaultAppState;
  }

  try {
    const state = JSON.parse(storedState) as Omit<PersistedAppState, 'components'> & {
      components: Array<Omit<GeneratedComponent, 'createdAt'> & { createdAt: string }>;
    };

    return {
      ...state,
      components: state.components.map((component) => ({
        ...component,
        createdAt: new Date(component.createdAt),
      })),
    };
  } catch {
    return defaultAppState;
  }
}
