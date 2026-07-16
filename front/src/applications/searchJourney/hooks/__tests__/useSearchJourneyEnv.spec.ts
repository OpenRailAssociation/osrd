import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import useSearchJourneyEnv, { NO_CONFIG_FOUND_MSG } from '../useSearchJourneyEnv';

describe('useSearchJourneyEnv', () => {
  it('if the environment is not available, it should resolve to an error', async () => {
    const { result } = renderHook(() => useSearchJourneyEnv());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe(NO_CONFIG_FOUND_MSG);
  });
});
