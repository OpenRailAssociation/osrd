import React, { useCallback, useState } from 'react';

import {
  SpaceTimeChart,
  PathLayer,
  useDraw,
  type DrawingFunction,
  type Point,
} from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';
import cx from 'classnames';
import { clamp, inRange } from 'lodash';

import { MouseTracker } from './helpers/components';
import { AMBIANT_A10, ERROR_30, ERROR_60, HOUR, KILOMETER, MINUTE } from './helpers/consts';
import { OPERATIONAL_POINTS, PATHS, START_DATE } from './helpers/paths';
import {
  MAX_X_ZOOM,
  MAX_Y_ZOOM,
  MIN_X_ZOOM,
  MIN_Y_ZOOM,
  X_ZOOM_LEVEL,
  Y_ZOOM_LEVEL,
  getDiff,
} from './helpers/utils';

import '@osrd-project/ui-charts/dist/theme.css';
import '@osrd-project/ui-core/dist/theme.css';

const MONO_TRACK_SPACES = [
  { from: 6 * KILOMETER, to: 24 * KILOMETER },
  { from: 60 * KILOMETER, to: 70 * KILOMETER },
];
const CLOSED_DOORS = [
  {
    areaFrom: 3.2 * KILOMETER,
    areaTo: 7 * KILOMETER,
    doorPosition: 4 * KILOMETER,
    timeStart: +START_DATE + 30 * MINUTE,
    timeEnd: +START_DATE + 2 * HOUR + 30 * MINUTE,
  },
];

const DEFAULT_PATH_LEVEL = 2;

type MonoTrackSpaceProps = {
  from: number;
  to: number;
};

/**
 * This component renders a colored area where the line only has one track:
 */
const MonoTrackSpace = ({ from, to }: MonoTrackSpaceProps) => {
  const drawMonoTrackSpace = useCallback<DrawingFunction>(
    (ctx, { getSpacePixel, width, height, spaceAxis }) => {
      const spaceSize = spaceAxis === 'x' ? width : height;
      const timeSize = spaceAxis === 'x' ? height : width;
      const fromPixel = clamp(getSpacePixel(from), 0, spaceSize);
      const toPixel = clamp(getSpacePixel(to), 0, spaceSize);
      const monoLineSize = toPixel - fromPixel;
      if (!monoLineSize) return;

      ctx.fillStyle = AMBIANT_A10;
      if (spaceAxis === 'x') {
        ctx.fillRect(fromPixel, 0, monoLineSize, timeSize);
      } else {
        ctx.fillRect(0, fromPixel, timeSize, monoLineSize);
      }
    },
    [from, to]
  );

  useDraw('background', drawMonoTrackSpace);

  return null;
};

/**
 * This component renders a colored area where the line only has one track:
 */
const ClosedDoor = ({
  doorPosition,
  areaFrom,
  areaTo,
  timeStart,
  timeEnd,
}: (typeof CLOSED_DOORS)[number]) => {
  const drawClosedDoorBackground = useCallback<DrawingFunction>(
    (ctx, { getSpacePixel, getTimePixel, width, height, spaceAxis }) => {
      const spaceSize = spaceAxis === 'x' ? width : height;
      const timeSize = spaceAxis === 'x' ? height : width;

      const fromPixel = clamp(getSpacePixel(areaFrom), 0, spaceSize);
      const toPixel = clamp(getSpacePixel(areaTo), 0, spaceSize);
      const startPixel = clamp(getTimePixel(timeStart), 0, timeSize);
      const endPixel = clamp(getTimePixel(timeEnd), 0, timeSize);

      const areaSpaceSize = toPixel - fromPixel;
      const areaTimeSize = endPixel - startPixel;
      if (!areaSpaceSize || !areaTimeSize) return;

      ctx.fillStyle = '#FF000029';
      if (spaceAxis === 'x') {
        ctx.fillRect(fromPixel, startPixel, areaSpaceSize, areaTimeSize);
      } else {
        ctx.fillRect(startPixel, fromPixel, areaTimeSize, areaSpaceSize);
      }
    },
    [areaFrom, areaTo, timeEnd, timeStart]
  );
  useDraw('background', drawClosedDoorBackground);

  const drawClosedDoor = useCallback<DrawingFunction>(
    (ctx, { getSpacePixel, getTimePixel, width, height, spaceAxis }) => {
      const spaceSize = spaceAxis === 'x' ? width : height;
      const timeSize = spaceAxis === 'x' ? height : width;

      const spacePixel = getSpacePixel(doorPosition);
      const startPixel = getTimePixel(timeStart);
      const endPixel = getTimePixel(timeEnd);

      const areaTimeSize = clamp(endPixel, 0, timeSize) - clamp(startPixel, 0, timeSize);
      if (!inRange(spacePixel, 0, spaceSize) || !areaTimeSize) return;

      // Dashed line:
      ctx.strokeStyle = ERROR_30;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      if (spaceAxis === 'x') {
        ctx.moveTo(spacePixel, startPixel);
        ctx.lineTo(spacePixel, endPixel);
      } else {
        ctx.moveTo(startPixel, spacePixel);
        ctx.lineTo(endPixel, spacePixel);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Half discs:
      const radius = 4;
      ctx.fillStyle = ERROR_60;

      ctx.beginPath();
      if (spaceAxis === 'x') {
        ctx.moveTo(spacePixel, startPixel);
        ctx.arc(spacePixel, startPixel, radius, Math.PI, Math.PI * 2, true);
      } else {
        ctx.moveTo(startPixel, spacePixel);
        ctx.arc(startPixel, spacePixel, radius, Math.PI / 2, (Math.PI * 3) / 2, true);
      }
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      if (spaceAxis === 'x') {
        ctx.moveTo(spacePixel, endPixel);
        ctx.arc(spacePixel, endPixel, radius, Math.PI, Math.PI * 2, false);
      } else {
        ctx.moveTo(endPixel, spacePixel);
        ctx.arc(endPixel, spacePixel, radius, Math.PI / 2, (Math.PI * 3) / 2, false);
      }
      ctx.closePath();
      ctx.fill();
    },
    [doorPosition, timeEnd, timeStart]
  );
  useDraw('paths', drawClosedDoor);

  return null;
};

type WrapperProps = {
  swapAxis: boolean;
  spaceScaleType: 'linear' | 'proportional';
};

/**
 * This story aims at showcasing how to display additional data.
 */
const Wrapper = ({ swapAxis, spaceScaleType }: WrapperProps) => {
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
        swapAxis={swapAxis}
        spaceOrigin={0}
        spaceScales={OPERATIONAL_POINTS.slice(0, -1).map((point, i) => ({
          from: point.position,
          to: OPERATIONAL_POINTS[i + 1].position,
          ...(spaceScaleType === 'linear'
            ? { size: 50 * state.yZoomLevel }
            : { coefficient: 150 / state.yZoomLevel }),
        }))}
        timeOrigin={+new Date('2024-04-02T00:00:00')}
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
            newState.xOffset = x - ((x - s.xOffset) / s.xZoomLevel) * newState.xZoomLevel;
            newState.yOffset = y - ((y - s.yOffset) / s.yZoomLevel) * newState.yZoomLevel;

            return newState;
          });
        }}
      >
        {PATHS.map((path) => (
          <PathLayer
            key={path.id}
            path={path}
            color={path.color}
            border={path.border}
            level={path.level || DEFAULT_PATH_LEVEL}
          />
        ))}
        {MONO_TRACK_SPACES.map(({ from, to }, i) => (
          <MonoTrackSpace key={i} from={from} to={to} />
        ))}
        {CLOSED_DOORS.map((data, i) => (
          <ClosedDoor key={i} {...data} />
        ))}
        <MouseTracker />
      </SpaceTimeChart>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Additional data',
  component: Wrapper,
  argTypes: {
    swapAxis: {
      name: 'Swap time and space axis?',
      defaultValue: false,
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
    swapAxis: false,
    spaceScaleType: 'linear',
  },
};
