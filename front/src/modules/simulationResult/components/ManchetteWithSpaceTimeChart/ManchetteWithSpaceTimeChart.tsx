import { useRef, useState } from 'react';

import { Manchette } from '@osrd-project/ui-manchette';
import { useManchettesWithSpaceTimeChart } from '@osrd-project/ui-manchette-with-spacetimechart';
import { SpaceTimeChart, PathLayer, WorkScheduleLayer } from '@osrd-project/ui-spacetimechart';

import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import upward from 'assets/pictures/workSchedules/ScheduledMaintenanceUp.svg';
import type {
  OperationalPointExtensions,
  OperationalPointPart,
  PostWorkSchedulesProjectPathApiResponse,
} from 'common/api/osrdEditoastApi';

type ManchetteWithSpaceTimeChartProps = {
  operationalPoints: {
    extensions?: OperationalPointExtensions;
    id: string;
    part: OperationalPointPart;
    position: number;
  }[];
  projectPathTrainResult: TrainSpaceTimeData[];
  selectedTrainScheduleId?: number;
  workSchedules?: PostWorkSchedulesProjectPathApiResponse;
};
const DEFAULT_HEIGHT = 561;

const ManchetteWithSpaceTimeChartWrapper = ({
  operationalPoints,
  projectPathTrainResult,
  selectedTrainScheduleId,
  workSchedules,
}: ManchetteWithSpaceTimeChartProps) => {
  const [heightOfManchetteWithSpaceTimeChart] = useState(DEFAULT_HEIGHT);
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);

  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchettesWithSpaceTimeChart(
    operationalPoints,
    projectPathTrainResult,
    manchetteWithSpaceTimeChartRef,
    selectedTrainScheduleId
  );

  return (
    <div className="manchette-space-time-chart-wrapper">
      <div className="header">
        {/* TODO : uncomment this component in #8628 */}
        {/* <ManchetteMenuButton /> */}
      </div>
      <div className="header-separator" />
      <div
        ref={manchetteWithSpaceTimeChartRef}
        className="manchette flex"
        style={{ height: `${heightOfManchetteWithSpaceTimeChart}px` }}
        onScroll={handleScroll}
      >
        <Manchette {...manchetteProps} />
        <div
          className="space-time-chart-container"
          style={{
            bottom: 0,
            left: 0,
            top: 0,
            height: `${heightOfManchetteWithSpaceTimeChart - 6}px`,
          }}
        >
          <SpaceTimeChart
            className="inset-0 absolute h-full"
            spaceOrigin={0}
            timeOrigin={Math.min(...projectPathTrainResult.map((p) => +new Date(p.departure_time)))}
            {...spaceTimeChartProps}
          >
            {spaceTimeChartProps.paths.map((path) => (
              <PathLayer key={path.id} path={path} color={path.color} />
            ))}
            {workSchedules && (
              <WorkScheduleLayer
                workSchedules={workSchedules.map((ws) => ({
                  type: ws.type,
                  timeStart: new Date(ws.start_date_time),
                  timeEnd: new Date(ws.end_date_time),
                  spaceRanges: ws.path_position_ranges.map(({ start, end }) => [start, end]),
                }))}
                imageUrl={upward}
              />
            )}
          </SpaceTimeChart>
        </div>
      </div>
    </div>
  );
};

export default ManchetteWithSpaceTimeChartWrapper;
