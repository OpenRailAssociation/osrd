import React, { useContext, useState } from 'react';

import {
  SpaceTimeChart,
  SpaceTimeChartCanvasContext,
  PathLayer,
  type Point,
} from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import cx from 'classnames';
import FileSaver from 'file-saver';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

import { MouseTracker } from './helpers/components';
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

const ScreenshotButton = () => {
  const { captureCanvases } = useContext(SpaceTimeChartCanvasContext);

  return (
    <div
      style={{
        position: 'absolute',
        right: 10,
        bottom: 10,
      }}
    >
      <button
        onClick={() =>
          // oxlint-disable-next-line typescript/no-deprecated -- False flag, as only the last argument is deprecated
          captureCanvases().then((blob) => FileSaver.saveAs(blob, 'space-time-chart.png'))
        }
      >
        Export to PNG
      </button>
    </div>
  );
};

type WrapperProps = {
  enableSnapping: boolean;
  hideGrid: boolean;
  hidePathsLabels: boolean;
  hideDates: boolean;
  swapAxis: boolean;
  spaceScaleType: 'linear' | 'proportional';
};

/**
 * This story aims at showcasing how to use various specific options in a
 * SpaceTimeChart, such as `swapAxis`, `enableSnapping`, `hideGrid` or
 * `hidePathsLabels`.
 */
const Wrapper = ({
  enableSnapping,
  hideGrid,
  hidePathsLabels,
  hideDates,
  swapAxis,
  spaceScaleType,
}: WrapperProps) => {
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
        className={cx('h-full overflow-hidden p-0 m-0', state.panning && 'cursor-grabbing')}
        enableSnapping={enableSnapping}
        hideGrid={hideGrid}
        hidePathsLabels={hidePathsLabels}
        hideDates={hideDates}
        swapAxis={swapAxis}
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
          const diff = getDiff(initialPosition, position);
          setState((s) => {
            // Stop panning:
            if (!isPanning) {
              return { ...s, panning: null };
            }
            // Start panning:
            else if (!s.panning) {
              return {
                ...s,
                panning: {
                  initialOffset: {
                    x: s.xOffset,
                    y: s.yOffset,
                  },
                },
              };
            }
            // Keep panning:
            else {
              const { initialOffset } = s.panning;
              return {
                ...s,
                xOffset: initialOffset.x + diff.x,
                yOffset: initialOffset.y + diff.y,
              };
            }
          });
        }}
        onZoom={({ delta, position: { x, y } }) => {
          setState((s) => {
            const newState = { ...s };

            newState.xZoomLevel = Math.min(
              Math.max(newState.xZoomLevel * (1 + delta / 10), MIN_X_ZOOM),
              MAX_X_ZOOM
            );
            newState.yZoomLevel = Math.min(
              Math.max(newState.yZoomLevel * (1 + delta / 10), MIN_Y_ZOOM),
              MAX_Y_ZOOM
            );

            // These line is to center the zoom on the mouse Y position:
            newState.xOffset = x - ((x - state.xOffset) / state.xZoomLevel) * newState.xZoomLevel;
            newState.yOffset = y - ((y - state.yOffset) / state.yZoomLevel) * newState.yZoomLevel;

            return newState;
          });
        }}
      >
        {PATHS.map((path) => (
          <PathLayer key={path.id} path={path} color={path.color} />
        ))}
        <MouseTracker />
        <ScreenshotButton />
      </SpaceTimeChart>
    </div>
  );
};

const meta: Meta<typeof Wrapper> = {
  title: 'SpaceTimeChart/Options',
  component: Wrapper,
  argTypes: {
    enableSnapping: {
      name: 'Enable snapping?',
      value: true,
      control: { type: 'boolean' },
    },
    hideGrid: {
      name: 'Hide grid?',
      value: false,
      control: { type: 'boolean' },
    },
    hidePathsLabels: {
      name: 'Hide paths labels?',
      value: false,
      control: { type: 'boolean' },
    },
    hideDates: {
      name: 'Hide dates?',
      value: false,
      control: { type: 'boolean' },
    },
    swapAxis: {
      name: 'Swap time and space axis?',
      value: false,
      control: { type: 'boolean' },
    },
    spaceScaleType: {
      name: 'Space scaling type',
      options: ['linear', 'proportional'],
      value: 'linear',
      control: { type: 'radio' },
    },
  },
};

export default meta;

export const DefaultArgs: StoryObj<typeof Wrapper> = {
  name: 'Default arguments',
  args: {
    enableSnapping: true,
    hideGrid: false,
    hidePathsLabels: false,
    hideDates: false,
    swapAxis: false,
    spaceScaleType: 'linear',
  },
};
