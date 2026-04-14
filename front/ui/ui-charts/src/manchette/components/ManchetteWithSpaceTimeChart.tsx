import React, { useRef } from 'react';

import { PathLayer, SpaceTimeChart, type SpaceTimeChartProps } from '../../spaceTimeChart';
import { INITIAL_SPACE_TIME_CHART_HEIGHT } from '../consts';
import useManchetteWithSpaceTimeChart, {
  type SplitPoint,
} from '../hooks/useManchetteWithSpaceTimeChart';
import type { ChartPath, Waypoint } from '../types';
import Manchette, { type ManchetteProps } from './Manchette';

export type ManchetteWithSpaceTimeChartProps = {
  waypoints: Waypoint[];
  paths: ChartPath[];
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
  paths,
  height = INITIAL_SPACE_TIME_CHART_HEIGHT,
  children,
  header,
  manchetteProps: additionalManchetteProps,
  spaceTimeChartProps: additionalSpaceTimeChartProps,
  splitPoints,
}: ManchetteWithSpaceTimeChartProps) => {
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const spaceTimeChartRef = useRef<HTMLDivElement>(null);

  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchetteWithSpaceTimeChart({
    waypoints,
    manchetteWithSpaceTimeChartRef,
    height,
    spaceTimeChartRef,
    splitPoints,
    defaultTimeOrigin: Math.min(...paths.map((p) => p.points[0]?.time)),
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
