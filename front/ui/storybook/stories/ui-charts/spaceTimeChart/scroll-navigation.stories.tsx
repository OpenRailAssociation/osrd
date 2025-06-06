import React, { useState } from 'react';

import {
  SpaceTimeChart,
  PathLayer,
  isPointPickingElement,
  isSegmentPickingElement,
  getSpaceAtTime,
  isPathOnScreen,
  type Point,
} from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';
import cx from 'classnames';
import { keyBy } from 'lodash';

import { OPERATIONAL_POINTS, PATHS } from './helpers/paths';
import { X_ZOOM_LEVEL, Y_ZOOM_LEVEL, zoom, getDiff } from './helpers/utils';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

const PATHS_DICT = keyBy(PATHS, 'id');

type WrapperProps = {
  spaceScaleType: 'linear' | 'proportional';
};

/**
 * This story aims at showcasing how to implement a different kind of navigation, where the mouse
 * wheel moves the time axis, and where a selected path must remain focused as much as possible.
 */
const Wrapper = ({ spaceScaleType }: WrapperProps) => {
  const [state, setState] = useState<{
    xOffset: number;
    yOffset: number;
    xZoomLevel: number;
    yZoomLevel: number;
    selected: string | null;
    panTarget:
      | null
      | { type: 'stage'; initialOffset: Point }
      | { type: 'items'; initialTimeOrigins: Record<string, number> };
    hoveredPathId: string | null;
  }>({
    xOffset: 0,
    yOffset: 0,
    xZoomLevel: X_ZOOM_LEVEL * 3,
    yZoomLevel: Y_ZOOM_LEVEL,
    selected: null,
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
        onClick={() => {
          const { hoveredPathId, selected, panTarget } = state;

          // Skip events when something is being dragged or panned:
          if (panTarget) return;

          setState((s) => ({
            ...s,
            selected: !hoveredPathId || hoveredPathId === selected ? null : hoveredPathId,
          }));
        }}
        onHoveredChildUpdate={({ item }) => {
          const hoveredPathId =
            item && (isPointPickingElement(item.element) || isSegmentPickingElement(item.element))
              ? item.element.pathId
              : null;
          setState((s) => ({ ...s, hoveredPathId }));
        }}
        onPan={({ initialPosition, position, isPanning }) => {
          const { panTarget } = state;
          const diff = getDiff(initialPosition, position);

          // Stop dragging or panning:
          if (!isPanning) {
            setState((s) => ({
              ...s,
              panTarget: null,
            }));
          }
          // Start panning stage
          else if (!panTarget) {
            setState((s) => ({
              ...s,
              panTarget: {
                type: 'stage',
                initialOffset: {
                  x: s.xOffset,
                  y: s.yOffset,
                },
              },
            }));
          }
          // Keep panning stage:
          else if (panTarget.type === 'stage') {
            const xOffset = panTarget.initialOffset.x + diff.x;
            const yOffset = panTarget.initialOffset.y + diff.y;

            setState((s) => ({
              ...s,
              xOffset,
              yOffset,
            }));
          }
        }}
        onZoom={(payload) => {
          if (payload.event.ctrlKey) {
            setState((s) => ({
              ...s,
              ...zoom(s, payload),
            }));
            payload.event.stopPropagation();
            payload.event.preventDefault();
          } else {
            setState((s) => {
              const newState = {
                ...s,
                xOffset: s.xOffset + payload.delta * -50,
              };

              if (s.selected) {
                const { width, height, getPoint, getTime, getSpacePixel } = payload.context;
                // Make sure the selected path remains on screen:
                const path = PATHS_DICT[s.selected];
                const xyPoints = path.points.map(getPoint);

                if (isPathOnScreen(width, height, xyPoints)) {
                  // Find if, for the time in the middle of the screen, the path is lower or higher:
                  const centerTime = getTime(width / 2);
                  const pathPositionAtTime = getSpaceAtTime(path, centerTime);
                  const pathYAtCenter = getSpacePixel(pathPositionAtTime);
                  const frictionCoefficient = 1 / 4;

                  newState.yOffset -= (pathYAtCenter - height / 2) * frictionCoefficient;
                }
              }

              return newState;
            });
          }
        }}
      >
        {PATHS.map((path) => (
          <PathLayer
            key={path.id}
            path={path}
            color={path.color}
            level={
              state.panTarget?.type === 'items'
                ? state.selected === path.id
                  ? 1
                  : 4
                : state.selected === path.id
                  ? 1
                  : state.hoveredPathId === path.id
                    ? 1
                    : state.selected
                      ? 3
                      : 2
            }
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: 10,
            bottom: 40,
            fontFamily: 'sans-serif',
            userSelect: 'none',
            background: '#ffffffcc',
          }}
        >
          <div>
            You can <strong>pan</strong> the chart with the mouse.
          </div>
          <div>
            You can <strong>select</strong> a path by clicking it.
          </div>
          <div>
            You can <strong>zoom</strong> the chart on the mouse using{' '}
            <strong>the wheel + the Ctrl key</strong>.
          </div>
          <div>
            You can <strong>move</strong> along the time axis with <strong>the wheel</strong>. If a
            path is selected, it should remain on screen as much as possible.
          </div>
        </div>
      </SpaceTimeChart>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Keep a path focused',
  component: Wrapper,
  argTypes: {
    spaceScaleType: {
      name: 'Space scaling type',
      options: ['linear', 'proportional'],
      defaultValue: 'linear',
      control: { type: 'radio' },
    },
  },
} as Meta<typeof Wrapper>;

export const DefaultArgs = {
  name: 'Default arguments',
  args: {
    spaceScaleType: 'linear',
  },
};
