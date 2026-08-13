import React, { useMemo, useRef } from 'react';

import {
  SpaceTimeChart,
  Manchette,
  useManchetteWithSpaceTimeChart,
  PathLayer,
  type ChartPath,
} from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

import { HOUR } from '../common/const';
import { SAMPLE_WAYPOINTS, SAMPLE_CHART_PATHS } from './assets/sampleData';

const DEFAULT_HEIGHT = 561;
const PATTERN_DURATION = HOUR;

// Shift sample paths so their earliest point sits at time 0, meant to showcase
// the hourly-mode axis rendering starting at hour 0.
const shiftPathsToZero = (paths: ChartPath[]): ChartPath[] => {
  const minTime = Math.min(...paths.flatMap((p) => p.points.map((pt) => pt.time)));
  return paths.map((p) => ({
    ...p,
    points: p.points.map((pt) => ({ ...pt, time: pt.time - minTime })),
  }));
};

const HourlyModeWrapper = () => {
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const paths = useMemo(() => shiftPathsToZero(SAMPLE_CHART_PATHS), []);

  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchetteWithSpaceTimeChart({
    waypoints: SAMPLE_WAYPOINTS,
    manchetteWithSpaceTimeChartRef,
  });

  return (
    <div className="ui-manchette-space-time-chart-wrapper">
      <div
        className="header bg-ambientB-5 w-full border-b border-grey-30"
        style={{ height: '40px' }}
      />
      <div
        ref={manchetteWithSpaceTimeChartRef}
        className="manchette flex"
        style={{ height: `${DEFAULT_HEIGHT}px` }}
        onScroll={handleScroll}
      >
        <Manchette {...manchetteProps} />
        <div className="space-time-chart-container w-full sticky">
          <SpaceTimeChart
            className="inset-0 absolute h-full"
            {...spaceTimeChartProps}
            hourlyTimetableDuration={PATTERN_DURATION}
          >
            {paths.map((path) => (
              <PathLayer key={path.id} path={path} color={path.color} />
            ))}
          </SpaceTimeChart>
        </div>
      </div>
    </div>
  );
};

const meta: Meta<typeof HourlyModeWrapper> = {
  title: 'Manchette with SpaceTimeChart/Hourly mode',
  component: HourlyModeWrapper,
};

export default meta;

export const Default: StoryObj<typeof HourlyModeWrapper> = {};
