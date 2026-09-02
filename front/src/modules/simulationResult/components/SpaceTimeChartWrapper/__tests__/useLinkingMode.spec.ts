import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import { formatLinkingId } from '../helpers/linkings';
import useLinkingMode from '../useLinkingMode';

const SOURCE = formatEditoastIdToTrainScheduleId(1);
const TARGET = formatEditoastIdToTrainScheduleId(2);

const suggestedLinking = {
  type: 'linking' as const,
  linkingId: formatLinkingId({ source: SOURCE, target: TARGET }),
};
const existingLinking = {
  type: 'linking' as const,
  linkingId: formatLinkingId({ linkingId: 42 }),
};
const brokenLinking = {
  type: 'brokenLinking' as const,
  brokenLinkingId: formatLinkingId({ linkingId: 42 }),
  direction: 'forward' as const,
};

const renderLinkingMode = ({ hasDeployedWaypoint = true } = {}) => {
  const onCreateLinking = vi.fn();
  const onDeleteLinking = vi.fn();
  const rendered = renderHook(
    (props: { hasDeployedWaypoint: boolean }) =>
      useLinkingMode({ ...props, onCreateLinking, onDeleteLinking }),
    { initialProps: { hasDeployedWaypoint } }
  );
  return { ...rendered, onCreateLinking, onDeleteLinking };
};

describe('useLinkingMode', () => {
  it('should start off and toggle on demand', () => {
    const { result } = renderLinkingMode();
    expect(result.current.linkingMode).toBe(false);

    act(() => result.current.toggleLinkingMode());
    expect(result.current.linkingMode).toBe(true);

    act(() => result.current.toggleLinkingMode());
    expect(result.current.linkingMode).toBe(false);
  });

  it('should leave the mode for good once the last TOD is closed', () => {
    const { result, rerender } = renderLinkingMode();
    act(() => result.current.toggleLinkingMode());

    rerender({ hasDeployedWaypoint: false });
    expect(result.current.linkingMode).toBe(false);

    rerender({ hasDeployedWaypoint: true });
    expect(result.current.linkingMode).toBe(false);
  });

  it('should ignore clicks while the mode is off', () => {
    const { result, onCreateLinking, onDeleteLinking } = renderLinkingMode();

    expect(result.current.handleLinkingClick(suggestedLinking)).toBe(false);
    expect(onCreateLinking).not.toHaveBeenCalled();
    expect(onDeleteLinking).not.toHaveBeenCalled();
  });

  it('should create the clicked linking when it does not exist yet', () => {
    const { result, onCreateLinking, onDeleteLinking } = renderLinkingMode();
    act(() => result.current.toggleLinkingMode());

    expect(result.current.handleLinkingClick(suggestedLinking)).toBe(true);
    expect(onCreateLinking).toHaveBeenCalledExactlyOnceWith(SOURCE, TARGET);
    expect(onDeleteLinking).not.toHaveBeenCalled();
  });

  it('should delete the clicked linking when it already exists', () => {
    const { result, onCreateLinking, onDeleteLinking } = renderLinkingMode();
    act(() => result.current.toggleLinkingMode());

    expect(result.current.handleLinkingClick(existingLinking)).toBe(true);
    expect(onDeleteLinking).toHaveBeenCalledExactlyOnceWith(42);
    expect(onCreateLinking).not.toHaveBeenCalled();
  });

  it('should delete a broken linking as well', () => {
    const { result, onDeleteLinking } = renderLinkingMode();
    act(() => result.current.toggleLinkingMode());

    expect(result.current.handleLinkingClick(brokenLinking)).toBe(true);
    expect(onDeleteLinking).toHaveBeenCalledExactlyOnceWith(42);
  });

  it('should leave any other click to the chart', () => {
    const { result, onCreateLinking, onDeleteLinking } = renderLinkingMode();
    act(() => result.current.toggleLinkingMode());

    expect(result.current.handleLinkingClick(undefined)).toBe(false);
    expect(result.current.handleLinkingClick({ type: 'occupancy' })).toBe(false);
    expect(onCreateLinking).not.toHaveBeenCalled();
    expect(onDeleteLinking).not.toHaveBeenCalled();
  });
});
