import React, { useCallback, useRef } from 'react';

import {
  type DrawingFunction,
  Manchette,
  type ManchetteWithSpaceTimeChartProps,
  PathLayer,
  positionMmToKm,
  SpaceTimeChart,
  useDraw,
  useManchetteWithSpaceTimeChart,
  usePaths,
} from '@osrd-project/ui-charts';
import '@osrd-project/ui-charts/dist/theme.css';
import '@osrd-project/ui-core/dist/theme.css';
import type { Meta } from '@storybook/react-vite';
import { clamp } from 'lodash';

import { SAMPLE_WAYPOINTS, SAMPLE_PATHS_DATA } from './assets/sampleData';

const AMBIANT_A10 = '#EFF3F5';

/**
 * This story shows how to render a Manchette with a SpaceTimeChart, with some split points. Each
 * split point is characterized by:
 * - Its position from the beginning
 * - Its size in pixels on screen
 * - What should be displayed on it, on the manchette side
 * - What should be displayed on it, on the space/time chart side
 *
 * As the manchette is rendered using HTML+CSS while the space/time chart is rendered using canvas,
 * the split points rendering must be separated accordingly. In this story, we just render a simple
 * colored div on the manchette, and we fill a rectangle with the same color on the space/time
 * chart.
 */

/**
 * This component is a placeholder to render a split point, manchette side:
 */
const SplitElement = ({
  size,
  position,
  name,
}: {
  size: number;
  position: number;
  name?: string;
}) => (
  <div
    style={{
      height: size,
      backgroundColor: AMBIANT_A10,
      fontWeight: '400',
      paddingLeft: '16px',
    }}
  >
    {positionMmToKm(position)} {name}
  </div>
);

/**
 * This component is a placeholder to render a split point, space/time chart side:
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

/**
 * This component shows how to use the useManchetteWithSpaceTimeChart hook with split points:
 */
const SplitManchetteWithSpaceTimeChartWrapper = ({
  waypoints,
  projectPathTrainResult,
  selectedTrain,
  height = 561,
  splitPoints = [],
}: {
  waypoints: typeof SAMPLE_WAYPOINTS;
  projectPathTrainResult: typeof SAMPLE_PATHS_DATA;
  selectedTrain: number;
  height: number;
  splitPoints: ManchetteWithSpaceTimeChartProps['splitPoints'];
  scaleWithZoom: boolean;
}) => {
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const spaceTimeChartRef = useRef<HTMLDivElement>(null);

  const paths = usePaths(projectPathTrainResult);
  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchetteWithSpaceTimeChart({
    waypoints,
    manchetteWithSpaceTimeChartRef,
    height,
    spaceTimeChartRef,
    splitPoints,
    defaultTimeOrigin: Math.min(...projectPathTrainResult.map((p) => +p.departureTime)),
  });

  return (
    <div className="ui-manchette-space-time-chart-wrapper">
      <div
        ref={manchetteWithSpaceTimeChartRef}
        className="manchette flex"
        style={{ height: `${height}px` }}
        onScroll={handleScroll}
      >
        <Manchette {...manchetteProps} />
        <div className="space-time-chart-container w-full sticky" ref={spaceTimeChartRef}>
          <SpaceTimeChart className="inset-0 absolute h-full" {...spaceTimeChartProps}>
            {paths.map((path) => (
              <PathLayer
                key={path.id}
                path={path}
                color={path.color}
                level={path.id === selectedTrain + '' ? 1 : 2}
              />
            ))}
          </SpaceTimeChart>
        </div>
      </div>
    </div>
  );
};

const meta: Meta<typeof SplitManchetteWithSpaceTimeChartWrapper> = {
  title: 'Manchette with SpaceTimeChart/Split points',
  component: SplitManchetteWithSpaceTimeChartWrapper,
};

export default meta;

export const Default = {
  args: {
    waypoints: SAMPLE_WAYPOINTS,
    projectPathTrainResult: SAMPLE_PATHS_DATA,
    selectedTrain: 1,
    splitPoints: [
      {
        id: SAMPLE_WAYPOINTS[2].id,
        position: SAMPLE_WAYPOINTS[2].position,
        size: 100,
        spaceTimeChartNode: <FlatStep position={SAMPLE_WAYPOINTS[2].position} />,
        manchetteNode: (
          <SplitElement
            size={100}
            position={SAMPLE_WAYPOINTS[2].position}
            name={SAMPLE_WAYPOINTS[2].name}
          />
        ),
      },
      {
        id: SAMPLE_WAYPOINTS[3].id,
        position: SAMPLE_WAYPOINTS[3].position,
        size: 100,
        spaceTimeChartNode: <FlatStep position={SAMPLE_WAYPOINTS[3].position} />,
        manchetteNode: (
          <SplitElement
            size={100}
            position={SAMPLE_WAYPOINTS[3].position}
            name={SAMPLE_WAYPOINTS[3].name}
          />
        ),
      },
      {
        id: SAMPLE_WAYPOINTS[4].id,
        position: SAMPLE_WAYPOINTS[4].position,
        size: 200,
        spaceTimeChartNode: <FlatStep position={SAMPLE_WAYPOINTS[4].position} />,
        manchetteNode: (
          <SplitElement
            size={200}
            position={SAMPLE_WAYPOINTS[4].position}
            name={SAMPLE_WAYPOINTS[4].name}
          />
        ),
      },
      {
        id: SAMPLE_WAYPOINTS[7].id,
        position: SAMPLE_WAYPOINTS[7].position,
        size: 100,
        spaceTimeChartNode: <FlatStep position={SAMPLE_WAYPOINTS[7].position} />,
        manchetteNode: (
          <SplitElement
            size={100}
            position={SAMPLE_WAYPOINTS[7].position}
            name={SAMPLE_WAYPOINTS[7].name}
          />
        ),
      },
    ],
    scaleWithZoom: false,
  },
};
