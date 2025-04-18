import React, { useRef } from 'react';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';
import {
  SpaceTimeChart,
  Manchette,
  useManchetteWithSpaceTimeChart,
  type ProjectPathTrainResult,
  type Waypoint,
  PathLayer,
  usePaths,
} from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';

import { SAMPLE_WAYPOINTS, SAMPLE_PATHS_DATA } from './assets/sampleData';

type ManchetteWithSpaceTimeWrapperProps = {
  waypoints: Waypoint[];
  projectPathTrainResult: ProjectPathTrainResult[];
  selectedTrain: number;
};

const DEFAULT_HEIGHT = 561;

const ManchetteWithSpaceTimeWrapper = ({
  waypoints,
  projectPathTrainResult,
  selectedTrain,
}: ManchetteWithSpaceTimeWrapperProps) => {
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);

  const paths = usePaths(projectPathTrainResult);
  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchetteWithSpaceTimeChart({
    waypoints,
    manchetteWithSpaceTimeChartRef,
    defaultTimeOrigin: Math.min(...projectPathTrainResult.map((p) => +p.departureTime)),
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
        <Manchette {...manchetteProps} />
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
};

export default meta;

export const Default = {
  args: {
    waypoints: SAMPLE_WAYPOINTS,
    projectPathTrainResult: SAMPLE_PATHS_DATA,
    selectedTrain: 1,
  },
};
