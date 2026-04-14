import React, { useRef } from 'react';

import {
  SpaceTimeChart,
  Manchette,
  useManchetteWithSpaceTimeChart,
  type Waypoint,
  PathLayer,
  type ChartPath,
} from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

import { SAMPLE_WAYPOINTS, SAMPLE_CHART_PATHS } from './assets/sampleData';

type ManchetteWithSpaceTimeWrapperProps = {
  waypoints: Waypoint[];
  paths: ChartPath[];
  selectedTrain: number;
  hidePositions?: boolean;
};

const DEFAULT_HEIGHT = 561;

const ManchetteWithSpaceTimeWrapper = ({
  waypoints,
  paths,
  selectedTrain,
  hidePositions = false,
}: ManchetteWithSpaceTimeWrapperProps) => {
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);

  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchetteWithSpaceTimeChart({
    waypoints,
    manchetteWithSpaceTimeChartRef,
    defaultTimeOrigin: Math.min(...paths.map((p) => +p.points[0]?.time)),
  });

  const selectedPath = paths[selectedTrain].id;

  return (
    <div className="ui-manchette-space-time-chart-wrapper">
      <div
        className="header bg-ambientB-5 w-full border-b border-grey-30"
        style={{ height: '40px' }}
      ></div>
      <div
        ref={manchetteWithSpaceTimeChartRef}
        className="manchette flex"
        style={{ height: `${DEFAULT_HEIGHT}px` }}
        onScroll={handleScroll}
      >
        <Manchette {...manchetteProps} hidePositions={hidePositions} />
        <div className="space-time-chart-container w-full sticky">
          <SpaceTimeChart className="inset-0 absolute h-full" {...spaceTimeChartProps}>
            {paths.map((path) => (
              <PathLayer
                key={path.id}
                path={path}
                color={path.color}
                level={path.id === selectedPath ? 1 : 2}
              />
            ))}
          </SpaceTimeChart>
        </div>
      </div>
    </div>
  );
};

const meta: Meta<typeof ManchetteWithSpaceTimeWrapper> = {
  title: 'Manchette with SpaceTimeChart/Hook API',
  component: ManchetteWithSpaceTimeWrapper,
  argTypes: {
    hidePositions: {
      name: 'Hide Positions',
      description: 'Hide position/distance information (km) on waypoints',
      defaultValue: false,
      control: { type: 'boolean' },
    },
  },
};

export default meta;

export const Default = {
  args: {
    waypoints: SAMPLE_WAYPOINTS,
    path: SAMPLE_CHART_PATHS,
    selectedTrain: 1,
    hidePositions: false,
  },
};
