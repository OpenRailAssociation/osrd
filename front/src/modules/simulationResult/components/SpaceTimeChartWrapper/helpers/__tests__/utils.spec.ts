import { describe, it, expect, vi, beforeEach } from 'vitest';

import { batchFetch } from '../utils';

describe('batchFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch sequentially', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(['a', 'b']).mockResolvedValueOnce(['c', 'd']);

    const onComplete = vi.fn();
    batchFetch([1, 2, 3, 4], fetchSpy, {
      batchSize: 2,
      onComplete,
    });

    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(1, [1, 2]);
    expect(fetchSpy).toHaveBeenNthCalledWith(2, [3, 4]);
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(['a', 'b', 'c', 'd']);
  });

  it('should stop fetching once the abort function is called', async () => {
    const fetchSpy = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            resolve(['a', 'b']);
          });
        })
    );
    const onComplete = vi.fn();

    const ids = [1, 2, 3, 4];
    const abort = batchFetch(ids, fetchSpy, {
      batchSize: 2,
      onComplete,
    });

    // Abort after first batch
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    abort();

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('should call onProgress after each batch, and onComplete on the end', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(['a', 'b']).mockResolvedValueOnce(['c', 'd']);

    const onProgress = vi.fn();
    const onComplete = vi.fn();

    batchFetch([1, 2, 3, 4], fetchSpy, {
      batchSize: 2,
      onProgress,
      onComplete,
    });

    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, ['a', 'b']);
    expect(onProgress).toHaveBeenNthCalledWith(2, ['a', 'b', 'c', 'd']);
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(['a', 'b', 'c', 'd']);
  });

  it('should call onError (and not call onComplete) when an error occurs', async () => {
    const error = new Error('Fetch failed');
    const fetchSpy = vi.fn().mockRejectedValue(error);

    const onError = vi.fn();
    const onComplete = vi.fn();

    batchFetch([1, 2], fetchSpy, {
      onError,
      onComplete,
    });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
