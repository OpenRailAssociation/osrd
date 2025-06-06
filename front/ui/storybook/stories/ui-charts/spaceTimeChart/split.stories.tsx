import React, { useCallback, useMemo, useState } from 'react';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

import {
  PathLayer,
  SpaceTimeChart,
  useDraw,
  type DrawingFunction,
  type Point,
} from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';
import { clamp, keyBy } from 'lodash';

import { AMBIANT_A10 } from './helpers/consts';
import { OPERATIONAL_POINTS, PATHS } from './helpers/paths';
import { X_ZOOM_LEVEL, Y_ZOOM_LEVEL, zoom, getDiff } from './helpers/utils';

const COEFFICIENT = 300000;

/**
 * This component renders a colored area where the line only has one track:
 */
const FlatStep = ({ position }: { position: number }) => {
  const drawMonoTrackSpace = useCallback<DrawingFunction>(
    (ctx, { getSpacePixel, width, height, spaceAxis }) => {
      const spaceSize = spaceAxis === 'x' ? width : height;
      const timeSize = spaceAxis === 'x' ? height : width;
      const fromPixel = clamp(getSpacePixel(position), 0, spaceSize);
      const toPixel = clamp(getSpacePixel(position, true), 0, spaceSize);
      const monoLineSize = toPixel - fromPixel;
      if (!monoLineSize) return;

      ctx.fillStyle = AMBIANT_A10;
      if (spaceAxis === 'x') {
        ctx.fillRect(fromPixel, 0, monoLineSize, timeSize);
      } else {
        ctx.fillRect(0, fromPixel, timeSize, monoLineSize);
      }
    },
    [position]
  );

  useDraw('overlay', drawMonoTrackSpace);

  return null;
};

type WrapperProps = {
  splitPoints: string;
  splitHeight: number;
  scaleWithZoom: boolean;
  swapAxis: boolean;
};

const SplitSpaceTimeChartWrapper = ({
  splitPoints,
  splitHeight,
  scaleWithZoom,
  swapAxis,
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

  // For this story, we split the chart on "City C" and "City E:
  const fullSplitPoints = useMemo(() => {
    const operationalPointsDict = keyBy(OPERATIONAL_POINTS, 'id');
    const splitPointsSet = new Set(splitPoints.split(','));
    return 'ABCDEF'
      .split('')
      .filter((letter) => splitPointsSet.has(letter))
      .map((letter) => ({
        position: operationalPointsDict[`city-${letter.toLowerCase()}`].position,
        label: operationalPointsDict[`city-${letter.toLowerCase()}`].label,
        height: scaleWithZoom ? splitHeight * state.yZoomLevel : splitHeight,
      }));
  }, [scaleWithZoom, splitHeight, splitPoints, state.yZoomLevel]);

  const spaceScales = useMemo(
    () =>
      fullSplitPoints
        .flatMap(({ position, height }) => [
          {
            to: position,
            coefficient: COEFFICIENT / state.yZoomLevel,
          },
          {
            to: position,
            size: height,
          },
        ])
        .concat({
          to: OPERATIONAL_POINTS.at(-1)!.position,
          coefficient: COEFFICIENT / state.yZoomLevel,
        }),
    [fullSplitPoints, state.yZoomLevel]
  );

  return (
    <div className="absolute inset-0">
      <SpaceTimeChart
        className="h-full"
        spaceOrigin={0}
        swapAxis={swapAxis}
        xOffset={state.xOffset}
        yOffset={state.yOffset}
        timeOrigin={+new Date('2024/04/02')}
        operationalPoints={OPERATIONAL_POINTS}
        timeScale={100000 / state.xZoomLevel}
        spaceScales={spaceScales}
        onPan={({ initialPosition, position, isPanning }) => {
          const { panning } = state;
          const diff = getDiff(initialPosition, position);

          // Stop panning:
          if (!isPanning) {
            setState((prev) => ({
              ...prev,
              panning: null,
            }));
          }
          // Start panning stage
          else if (!panning) {
            setState((prev) => ({
              ...prev,
              panning: {
                initialOffset: {
                  x: prev.xOffset,
                  y: prev.yOffset,
                },
              },
            }));
          }
          // Keep panning stage:
          else {
            const xOffset = panning.initialOffset.x + diff.x;
            const yOffset = panning.initialOffset.y + diff.y;

            setState((prev) => ({
              ...prev,
              xOffset,
              yOffset,
            }));
          }
        }}
        onZoom={(payload) => {
          setState((prev) => ({
            ...prev,
            ...zoom(state, payload),
          }));
        }}
      >
        {PATHS.map((path) => (
          <PathLayer key={path.id} path={path} color={path.color} />
        ))}
        {fullSplitPoints.map(({ position }, i) => (
          <FlatStep key={i} position={position} />
        ))}
      </SpaceTimeChart>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Split',
  component: SplitSpaceTimeChartWrapper,
  argTypes: {
    splitPoints: {
      name: 'Operational points to split on (pick in A, B, C, D, E and F, separate with commas)',
      control: { type: 'text' },
    },
    splitHeight: {
      name: 'Split steps height (in pixels)',
      control: { type: 'number' },
    },
    scaleWithZoom: {
      name: 'Scale split steps with zoom?',
      control: { type: 'boolean' },
    },
    swapAxis: {
      name: 'Swap time and space axis?',
      control: { type: 'boolean' },
    },
  },
} as Meta<typeof SplitSpaceTimeChartWrapper>;

export const Default = {
  name: 'Default arguments',
  args: {
    splitPoints: 'A,C,E',
    splitHeight: 100,
    scaleWithZoom: false,
    swapAxis: false,
  },
};
