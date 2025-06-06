import React, { useMemo, useState } from 'react';

import {
  SpaceTimeChart,
  PathLayer,
  isPointPickingElement,
  isSegmentPickingElement,
  type PathData,
  type Point,
} from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';
import cx from 'classnames';
import { keyBy } from 'lodash';

import { OPERATIONAL_POINTS, PATHS } from './helpers/paths';
import { X_ZOOM_LEVEL, Y_ZOOM_LEVEL, zoom, getDiff } from './helpers/utils';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

function delayPath<T extends PathData>(path: T, newTimeOrigin: number): T {
  const delay = newTimeOrigin - path.points[0].time;
  return {
    ...path,
    points: path.points.map((point) => ({ ...point, time: point.time + delay })),
  };
}
type WrapperProps = {
  enableDragPaths: boolean;
  pickingTolerance: number;
  enableMultiSelection: boolean;
  spaceScaleType: 'linear' | 'proportional';
};

/**
 * This story aims at showcasing how to manipulate paths in a SpaceTimeChart.
 */
const Wrapper = ({
  enableDragPaths,
  pickingTolerance,
  enableMultiSelection,
  spaceScaleType,
}: WrapperProps) => {
  const [paths, setPaths] = useState(PATHS);
  const pathsDict = useMemo(() => keyBy(paths, 'id'), [paths]);
  const [state, setState] = useState<{
    xOffset: number;
    yOffset: number;
    xZoomLevel: number;
    yZoomLevel: number;
    selection: Set<string> | null;
    panTarget:
      | null
      | { type: 'stage'; initialOffset: Point }
      | { type: 'items'; initialTimeOrigins: Record<string, number> };
    hoveredPathId: string | null;
  }>({
    xOffset: 0,
    yOffset: 0,
    xZoomLevel: X_ZOOM_LEVEL,
    yZoomLevel: Y_ZOOM_LEVEL,
    selection: null,
    panTarget: null,
    hoveredPathId: null,
  });

  return (
    <div className="absolute inset-0">
      <SpaceTimeChart
        className={cx(
          'h-full p-0 m-0',
          state.panTarget && 'cursor-grabbing',
          state.hoveredPathId && 'cursor-pointer'
        )}
        operationalPoints={OPERATIONAL_POINTS}
        spaceOrigin={0}
        spaceScales={OPERATIONAL_POINTS.slice(0, -1).map((point, i) => ({
          from: point.position,
          to: OPERATIONAL_POINTS[i + 1].position,
          ...(spaceScaleType === 'linear'
            ? { size: 50 * state.yZoomLevel }
            : { coefficient: 150 / state.yZoomLevel }),
        }))}
        timeOrigin={+new Date('2024/04/02')}
        timeScale={60000 / state.xZoomLevel}
        xOffset={state.xOffset}
        yOffset={state.yOffset}
        onClick={({ event }) => {
          const { hoveredPathId, selection, panTarget } = state;

          // Skip events when something is being dragged or panned:
          if (panTarget) return;

          // Unselect everything when clicking stage (unless multi-selection is enabled and the ctrl key is down):
          if (!hoveredPathId) {
            if (!enableMultiSelection || !event.ctrlKey)
              setState((prev) => ({ ...prev, selection: null }));
          }
          // Select item when nothing is selected:
          else if (!selection) {
            setState({
              ...state,
              selection: new Set([hoveredPathId]),
            });
          }
          // Handle single selection:
          else if (!enableMultiSelection || !event.ctrlKey) {
            setState({
              ...state,
              selection: selection.has(hoveredPathId) ? null : new Set([hoveredPathId]),
            });
          }
          // Handle multi selection:
          else {
            const newSelection = new Set(selection);

            if (newSelection.has(hoveredPathId)) newSelection.delete(hoveredPathId);
            else newSelection.add(hoveredPathId);

            setState({ ...state, selection: newSelection.size ? newSelection : null });
          }
        }}
        onHoveredChildUpdate={({ item }) => {
          const hoveredPathId =
            item && (isPointPickingElement(item.element) || isSegmentPickingElement(item.element))
              ? item.element.pathId
              : null;
          setState((prev) => ({ ...prev, hoveredPathId }));
        }}
        onPan={({ initialPosition, position, initialData, data, isPanning }) => {
          const { panTarget, hoveredPathId, selection } = state;
          const diff = getDiff(initialPosition, position);

          // Stop dragging or panning:
          if (!isPanning) {
            setState((prev) => ({
              ...prev,
              panTarget: null,
            }));
          }
          // Start dragging selection
          else if (!panTarget && enableDragPaths && hoveredPathId) {
            const newSelection = selection?.has(hoveredPathId)
              ? selection
              : new Set([hoveredPathId]);
            setState((s) => ({
              ...s,
              selection: newSelection,
              panTarget: {
                type: 'items',
                initialTimeOrigins: Array.from(newSelection).reduce(
                  (iter, id) => ({
                    ...iter,
                    [id]: pathsDict[id].points[0].time,
                  }),
                  {}
                ),
              },
            }));
          }
          // Start panning stage
          else if (!panTarget) {
            setState((prev) => ({
              ...prev,
              panTarget: {
                type: 'stage',
                initialOffset: {
                  x: state.xOffset,
                  y: state.yOffset,
                },
              },
            }));
          }
          // Keep panning stage:
          else if (panTarget.type === 'stage') {
            const xOffset = panTarget.initialOffset.x + diff.x;
            const yOffset = panTarget.initialOffset.y + diff.y;

            setState((prev) => ({
              ...prev,
              xOffset,
              yOffset,
            }));
          }
          // Keep panning selection:
          else if (panTarget.type === 'items') {
            const { initialTimeOrigins } = panTarget;
            const timeDiff = data.time - initialData.time;
            setPaths((p) =>
              p.map((path) =>
                initialTimeOrigins[path.id]
                  ? delayPath(path, initialTimeOrigins[path.id] + timeDiff)
                  : path
              )
            );
          }
        }}
        onZoom={(payload) => {
          setState((prev) => ({
            ...prev,
            ...zoom(state, payload),
          }));
        }}
      >
        {paths.map((path) => (
          <PathLayer
            key={path.id}
            path={path}
            color={path.color}
            pickingTolerance={pickingTolerance}
            level={
              state.panTarget?.type === 'items'
                ? state.selection?.has(path.id)
                  ? 1
                  : 4
                : state.selection?.has(path.id)
                  ? 1
                  : state.hoveredPathId === path.id
                    ? 1
                    : state.selection?.size
                      ? 3
                      : 2
            }
          />
        ))}
      </SpaceTimeChart>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Paths interactions',
  component: Wrapper,
  argTypes: {
    enableDragPaths: {
      name: 'Enable dragging paths?',
      defaultValue: true,
      control: { type: 'boolean' },
    },
    enableMultiSelection: {
      name: 'Multi-selection?',
      defaultValue: true,
      control: { type: 'boolean' },
    },
    spaceScaleType: {
      name: 'Space scaling type',
      options: ['linear', 'proportional'],
      defaultValue: 'linear',
      control: { type: 'radio' },
    },
    pickingTolerance: {
      name: 'Picking tolerance',
      description: '(in pixels)',
      defaultValue: 5,
      control: { type: 'number', step: 1, min: 0, max: 30 },
    },
  },
} as Meta<typeof Wrapper>;

export const DefaultArgs = {
  name: 'Default arguments',
  args: {
    enableDragPaths: true,
    enableMultiSelection: true,
    spaceScaleType: 'linear',
    pickingTolerance: 5,
  },
};
