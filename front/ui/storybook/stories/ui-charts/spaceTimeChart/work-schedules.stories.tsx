import React, { useState } from 'react';

import {
  SpaceTimeChart,
  PathLayer,
  WorkScheduleLayer,
  type Point,
  type PathData,
  type OperationalPoint,
  type WorkSchedule,
} from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';

import upward from './assets/images/ScheduledMaintenanceUp.svg';
import { KILOMETER } from './helpers/consts';
import { OPERATIONAL_POINTS, PATHS } from './helpers/paths';
import { getDiff } from './helpers/utils';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';

const SAMPLE_WORK_SCHEDULES: WorkSchedule[] = [
  {
    type: 'TRACK',
    timeStart: new Date('2024-04-02T00:00:00Z'),
    timeEnd: new Date('2024-04-02T00:15:00Z'),
    spaceRanges: [
      [20 * KILOMETER, 35 * KILOMETER],
      [45 * KILOMETER, 60 * KILOMETER],
    ],
  },
  {
    type: 'TRACK',
    timeStart: new Date('2024-04-02T00:15:00Z'),
    timeEnd: new Date('2024-04-02T01:00:00Z'),
    spaceRanges: [
      [80 * KILOMETER, 100 * KILOMETER],
      [110 * KILOMETER, 140 * KILOMETER],
    ],
  },
  {
    type: 'TRACK',
    timeStart: new Date('2024-04-02T01:30:00Z'),
    timeEnd: new Date('2024-04-02T02:30:00Z'),
    spaceRanges: [[50 * KILOMETER, 100 * KILOMETER]],
  },
];

const DEFAULT_HEIGHT = 550;

type WorkSchedulesWrapperProps = {
  operationalPoints: OperationalPoint[];
  paths: (PathData & { color: string })[];
  workSchedules: WorkSchedule[];
};

const WorkSchedulesWrapper = ({
  operationalPoints = [],
  paths = [],
  workSchedules,
}: WorkSchedulesWrapperProps) => {
  const [state, setState] = useState<{
    xOffset: number;
    yOffset: number;
    panning: null | { initialOffset: Point };
  }>({
    xOffset: -300,
    yOffset: 0,
    panning: null,
  });
  const simpleOperationalPoints = operationalPoints.map(({ id, position }) => ({
    id,
    label: id,
    position,
  }));
  const spaceScale = [
    {
      from: 0,
      to: 75 * KILOMETER,
      coefficient: 300000,
    },
  ];
  return (
    <div
      className="ui-manchette-space-time-chart-wrapper"
      style={{ height: `${DEFAULT_HEIGHT}px` }}
    >
      <SpaceTimeChart
        className="h-full"
        spaceOrigin={0}
        xOffset={state.xOffset}
        yOffset={state.yOffset}
        timeOrigin={+new Date('2024/04/02')}
        operationalPoints={simpleOperationalPoints}
        timeScale={10000}
        spaceScales={spaceScale}
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
      >
        {paths.map((path) => (
          <PathLayer key={path.id} path={path} color={path.color} />
        ))}
        <WorkScheduleLayer workSchedules={workSchedules} imageUrl={upward} />
      </SpaceTimeChart>
    </div>
  );
};

export default {
  title: 'SpaceTimeChart/Workschedules',
  component: WorkSchedulesWrapper,
} as Meta<typeof WorkSchedulesWrapper>;

export const Default = {
  args: {
    operationalPoints: OPERATIONAL_POINTS,
    paths: PATHS.slice(2, 4),
    workSchedules: SAMPLE_WORK_SCHEDULES,
  },
};
