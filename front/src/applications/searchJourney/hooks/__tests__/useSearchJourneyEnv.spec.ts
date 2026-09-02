import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import useSearchJourneyEnv, { NO_CONFIG_FOUND_MSG } from '../useSearchJourneyEnv';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  getSearchJourneysSearchEnvironment: vi.fn(),
}));

vi.mock('store', () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock('common/api/osrdEditoastApi', () => ({
  osrdEditoastApi: {
    endpoints: {
      getSearchJourneysSearchEnvironment: {
        useLazyQuery: () => [mocks.getSearchJourneysSearchEnvironment],
      },
    },
  },
}));

describe('useSearchJourneyEnv', () => {
  it('if the environment is not available, it should resolve to an error', async () => {
    mocks.getSearchJourneysSearchEnvironment.mockResolvedValue({ data: undefined });

    const { result } = renderHook(() => useSearchJourneyEnv());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe(NO_CONFIG_FOUND_MSG);
  });
});
