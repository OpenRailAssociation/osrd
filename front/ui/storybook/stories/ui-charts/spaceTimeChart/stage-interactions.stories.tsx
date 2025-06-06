import React, { useState } from 'react';

import { SpaceTimeChart, PathLayer, type Point } from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';
import cx from 'classnames';

import { OPERATIONAL_POINTS, PATHS } from './helpers/paths';
import {
  MAX_X_ZOOM,
  MAX_Y_ZOOM,
  MIN_X_ZOOM,
  MIN_Y_ZOOM,
  X_ZOOM_LEVEL,
  Y_ZOOM_LEVEL,
  getDiff,
} from './helpers/utils';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

type WrapperProps = {
  xPan: boolean;
  yPan: boolean;
  xZoom: boolean;
  yZoom: boolean;
  spaceScaleType: 'linear' | 'proportional';
};

/**
 * This story aims at showcasing how to handle panning and zooming in a SpaceTimeChart.
 */
const Wrapper = ({ xPan, yPan, xZoom, yZoom, spaceScaleType }: WrapperProps) => {
  const [state, setState] = useState<{
    xOffset: number;
    yOffset: number;
    xZoomLevel: number;
    yZoomLevel: number;
    panning: null | { initialOffset: Point };
  }>({
    xOffset: 0,
    yOffset: 0,
    xZoomLevel: X_ZOOM_LEVEL,
    yZoomLevel: Y_ZOOM_LEVEL,
    panning: null,
  });

  return (
    <div className="absolute inset-0">
      <SpaceTimeChart
        className={cx('h-full p-0 m-0', state.panning && 'cursor-grabbing')}
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
        onPan={({ initialPosition, position, isPanning }) => {
          if (!xPan && !yPan) return;

          const diff = getDiff(initialPosition, position);
          setState((prev) => {
            // Stop panning:
            if (!isPanning) {
              return { ...prev, panning: null };
            }
            // Start panning:
            else if (!prev.panning) {
              return {
                ...prev,
                panning: {
                  initialOffset: {
                    x: state.xOffset,
                    y: state.yOffset,
                  },
                },
              };
            }
            // Keep panning:
            else {
              const { initialOffset } = prev.panning;
              const newState: typeof state = {
                ...state,
              };
              if (xPan) newState.xOffset = initialOffset.x + diff.x;
              if (yPan) newState.yOffset = initialOffset.y + diff.y;
              return newState;
            }
          });
        }}
        onZoom={({ delta, position: { x, y } }) => {
          // The zoom is quite straightforward. The hardest part is to keep the zoom centered on the
          // mouse. There is a shorter version in ./utils.ts, used by the other stories.
          if (!xZoom && !yZoom) return;

          setState((prev) => {
            const newState = { ...prev };
            if (xZoom) {
              newState.xZoomLevel = Math.min(
                Math.max(newState.xZoomLevel * (1 + delta / 10), MIN_X_ZOOM),
                MAX_X_ZOOM
              );
              // This line is to center the zoom on the mouse X position:
              newState.xOffset = x - ((x - state.xOffset) / state.xZoomLevel) * newState.xZoomLevel;
            }
            if (yZoom) {
              newState.yZoomLevel = Math.min(
                Math.max(newState.yZoomLevel * (1 + delta / 10), MIN_Y_ZOOM),
                MAX_Y_ZOOM
              );
              // This line is to center the zoom on the mouse Y position:
              newState.yOffset = y - ((y - state.yOffset) / state.yZoomLevel) * newState.yZoomLevel;
            }
            return newState;
          });
        }}
      >
        {PATHS.map((path) => (
          <PathLayer key={path.id} path={path} color={path.color} />
        ))}
      </SpaceTimeChart>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Panning and zooming',
  component: Wrapper,
  argTypes: {
    xPan: {
      name: 'Enable panning on the X axis?',
      defaultValue: true,
      control: { type: 'boolean' },
    },
    yPan: {
      name: 'Enable panning on the Y axis?',
      defaultValue: true,
      control: { type: 'boolean' },
    },
    xZoom: {
      name: 'Enable zooming on the X axis?',
      defaultValue: true,
      control: { type: 'boolean' },
    },
    yZoom: {
      name: 'Enable zooming on the Y axis?',
      defaultValue: true,
      control: { type: 'boolean' },
    },
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
    xPan: true,
    yPan: true,
    xZoom: true,
    yZoom: true,
    spaceScaleType: 'linear',
  },
};
