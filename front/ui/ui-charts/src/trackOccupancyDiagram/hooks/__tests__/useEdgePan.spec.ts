import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { SpaceTimeChartProps, SpaceTimeChartContextType } from '../../../spaceTimeChart';
import useEdgePan, { PAN_INTERVAL_MS } from '../useEdgePan';

describe('useEdgePan', () => {
  let y = 0; // current vertical offset
  const pan = ({ dy }: { dy: number }) => {
    y += dy;
  };

  const spaceTimeChartProps: SpaceTimeChartProps = {
    operationalPoints: [],
    spaceOrigin: 0,
    spaceScales: [],
    timeOrigin: 0,
    timeScale: 1,
  };

  const initialProps = {
    enableY: true,
    spaceTimeChartProps,
    pan,
  };

  // TODO: feed a complete chart context to the hook
  const context: SpaceTimeChartContextType = {
    width: 700,
    height: 500,
  } as SpaceTimeChartContextType;

  // Create parameters for onMouseMove
  const moveMouseTo = (mouseY: number) => ({
    position: { x: 0, y: mouseY },
    data: { time: 0, position: mouseY },
    isHover: false,
    hoveredItem: null,
    context,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    y = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should do nothing when sitting in the middle of the chart', () => {
    const { result } = renderHook((value) => useEdgePan(value), {
      initialProps,
    });

    y = 100;
    result.current.onMouseMove(moveMouseTo(250));
    vi.advanceTimersByTime(PAN_INTERVAL_MS);
    expect(y).toBe(100);
  });

  it('should pan up when reaching for the top edge', () => {
    const { result } = renderHook((value) => useEdgePan(value), {
      initialProps,
    });

    y = 100;
    result.current.onMouseMove(moveMouseTo(20));
    vi.advanceTimersByTime(PAN_INTERVAL_MS);
    expect(y).toBe(95);
    vi.advanceTimersByTime(PAN_INTERVAL_MS);
    expect(y).toBe(90);

    // Stop when moving far enough from the top edge
    result.current.onMouseMove(moveMouseTo(200));
    vi.advanceTimersByTime(PAN_INTERVAL_MS);
    expect(y).toBe(90);
  });

  it('should pan down when reaching for the bottom edge', () => {
    const { result } = renderHook((value) => useEdgePan(value), {
      initialProps,
    });

    y = 100;
    result.current.onMouseMove(moveMouseTo(490));
    vi.advanceTimersByTime(PAN_INTERVAL_MS);
    expect(y).toBe(105);
    vi.advanceTimersByTime(PAN_INTERVAL_MS);
    expect(y).toBe(110);

    // Stop when moving far enough from the bottom edge
    result.current.onMouseMove(moveMouseTo(350));
    vi.advanceTimersByTime(PAN_INTERVAL_MS);
    expect(y).toBe(110);
  });
});
