import React, { useRef } from 'react';

import Manchette, { type ManchetteProps } from './Manchette';
import { PathLayer, SpaceTimeChart, type SpaceTimeChartProps } from '../../spaceTimeChart';
import { INITIAL_SPACE_TIME_CHART_HEIGHT } from '../consts';
import useManchetteWithSpaceTimeChart, {
  type SplitPoint,
} from '../hooks/useManchetteWithSpaceTimeChart';
import usePaths from '../hooks/usePaths';
import { type ProjectPathTrainResult, type Waypoint } from '../types';

export type ManchetteWithSpaceTimeChartProps = {
  waypoints: Waypoint[];
  projectPathTrainResult: ProjectPathTrainResult[];
  height?: number;
  children?: React.ReactNode;
  header?: React.ReactNode;
  manchetteProps?: ManchetteProps;
  spaceTimeChartProps?: SpaceTimeChartProps;
  splitPoints?: SplitPoint[];
};

/**
 * A simple component to display a manchette and a space time chart.
 *
 * This only covers basic usage. For more advanced control over the manchette
 * and space time chart, the useManchetteWithSpaceTimeChart() hook can be used.
 */
const ManchetteWithSpaceTimeChart = ({
  waypoints,
  projectPathTrainResult,
  height = INITIAL_SPACE_TIME_CHART_HEIGHT,
  children,
  header,
  manchetteProps: additionalManchetteProps,
  spaceTimeChartProps: additionalSpaceTimeChartProps,
  splitPoints,
}: ManchetteWithSpaceTimeChartProps) => {
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
        className="header bg-ambientB-5 w-full border-b border-grey-30"
        style={{ height: '40px' }}
      >
        {header}
      </div>
      <div ref={manchetteWithSpaceTimeChartRef} className="manchette flex" onScroll={handleScroll}>
        <Manchette {...manchetteProps} {...additionalManchetteProps} />
        <div className="space-time-chart-container w-full sticky" ref={spaceTimeChartRef}>
          <SpaceTimeChart
            className="inset-0 absolute h-full"
            {...spaceTimeChartProps}
            {...additionalSpaceTimeChartProps}
          >
            {paths.map((path) => (
              <PathLayer key={path.id} path={path} color={path.color} />
            ))}
            {children}
          </SpaceTimeChart>
        </div>
      </div>
    </div>
  );
};

export default ManchetteWithSpaceTimeChart;
