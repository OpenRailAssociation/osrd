import { describe, it, expect, vi, beforeEach } from 'vitest';

import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import { cutSpaceTimeRect, batchFetchTrackOccupancy } from '../utils';

describe('interpolateRange', () => {
  it('should return null if the interpolated range ends before the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 5,
      timeStart: 100,
      timeEnd: 200,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 1, 3);
    expect(interpolatedRange).toBeNull();
  });

  it('should return null if the interpolated range starts after the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 5,
      timeStart: 100,
      timeEnd: 200,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 5, 7);
    expect(interpolatedRange).toBeNull();
  });

  it('should return the same range if its ranges are inside the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 5,
      timeStart: 100,
      timeEnd: 200,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 2, 7);
    expect(interpolatedRange).toEqual(range);
  });

  it('should return the interpolated range when the start position is outside the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 5,
      timeStart: 100,
      timeEnd: 200,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 4, 5);
    expect(interpolatedRange).toEqual({
      spaceStart: 4,
      spaceEnd: 5,
      timeStart: 150,
      timeEnd: 200,
    });
  });

  it('should return the interpolated range when the end position is is outside the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 6,
      timeStart: 100,
      timeEnd: 160,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 3, 5);
    expect(interpolatedRange).toEqual({
      spaceStart: 3,
      spaceEnd: 5,
      timeStart: 100,
      timeEnd: 140,
    });
  });

  it('should return the interpolated range when both positions are outside the cut space', () => {
    const range = {
      spaceStart: 3,
      spaceEnd: 6,
      timeStart: 100,
      timeEnd: 160,
    };
    const interpolatedRange = cutSpaceTimeRect(range, 4, 5);
    expect(interpolatedRange).toEqual({
      spaceStart: 4,
      spaceEnd: 5,
      timeStart: 120,
      timeEnd: 140,
    });
  });
});

describe('batchFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch sequentially', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(['a', 'b']).mockResolvedValueOnce(['c', 'd']);

    const onComplete = vi.fn();
    batchFetchTrackOccupancy([1, 2, 3, 4].map(formatEditoastIdToTrainScheduleId), fetchSpy, {
      batchSize: 2,
      onComplete,
    });

    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(1, [1, 2].map(formatEditoastIdToTrainScheduleId));
    expect(fetchSpy).toHaveBeenNthCalledWith(2, [3, 4].map(formatEditoastIdToTrainScheduleId));
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

    const ids = [1, 2, 3, 4].map(formatEditoastIdToTrainScheduleId);
    const abort = batchFetchTrackOccupancy(ids, fetchSpy, {
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

    batchFetchTrackOccupancy([1, 2, 3, 4].map(formatEditoastIdToTrainScheduleId), fetchSpy, {
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

    batchFetchTrackOccupancy([1, 2].map(formatEditoastIdToTrainScheduleId), fetchSpy, {
      onError,
      onComplete,
    });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
