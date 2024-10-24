import { useRef, useState } from 'react';

import { KebabHorizontal } from '@osrd-project/ui-icons';
import { Manchette } from '@osrd-project/ui-manchette';
import { useManchettesWithSpaceTimeChart } from '@osrd-project/ui-manchette-with-spacetimechart';
import {
  ConflictLayer,
  PathLayer,
  SpaceTimeChart,
  WorkScheduleLayer,
  OccupancyBlockLayer,
} from '@osrd-project/ui-spacetimechart';
import type { Conflict } from '@osrd-project/ui-spacetimechart';

import type { OperationalPoint, TrainSpaceTimeData } from 'applications/operationalStudies/types';
import upward from 'assets/pictures/workSchedules/ScheduledMaintenanceUp.svg';
import type { PostWorkSchedulesProjectPathApiResponse } from 'common/api/osrdEditoastApi';
import { ASPECT_LABELS_COLORS } from 'modules/simulationResult/consts';
import type { AspectLabel, WaypointsPanelData } from 'modules/simulationResult/types';

import SettingsPanel from './SettingsPanel';
import ManchetteMenuButton from '../SpaceTimeChart/ManchetteMenuButton';
import WaypointsPanel from '../SpaceTimeChart/WaypointsPanel';

type ManchetteWithSpaceTimeChartProps = {
  operationalPoints: OperationalPoint[];
  projectPathTrainResult: TrainSpaceTimeData[];
  selectedTrainScheduleId?: number;
  waypointsPanelData?: WaypointsPanelData;
  conflicts?: Conflict[];
  workSchedules?: PostWorkSchedulesProjectPathApiResponse;
};
const DEFAULT_HEIGHT = 561;

const ManchetteWithSpaceTimeChartWrapper = ({
  operationalPoints,
  projectPathTrainResult,
  selectedTrainScheduleId,
  waypointsPanelData,
  conflicts = [],
  workSchedules,
}: ManchetteWithSpaceTimeChartProps) => {
  const [heightOfManchetteWithSpaceTimeChart] = useState(DEFAULT_HEIGHT);
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);

  const [waypointsPanelIsOpen, setWaypointsPanelIsOpen] = useState(false);

  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchettesWithSpaceTimeChart(
    waypointsPanelData?.filteredWaypoints ?? operationalPoints,
    projectPathTrainResult,
    manchetteWithSpaceTimeChartRef,
    selectedTrainScheduleId
  );

  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settings, setSettings] = useState({
    showConflicts: false,
    showSignalsStates: false,
  });

  const occupancyBlocks = projectPathTrainResult.flatMap((train) => {
    const departureTime = new Date(train.departure_time).getTime();

    return train.signal_updates.map((block) => ({
      timeStart: departureTime + block.time_start,
      timeEnd: departureTime + block.time_end,
      spaceStart: block.position_start,
      spaceEnd: block.position_end,
      color: ASPECT_LABELS_COLORS[block.aspect_label as AspectLabel],
    }));
  });

  return (
    <div className="manchette-space-time-chart-wrapper">
      <div className="header">
        <ManchetteMenuButton setWaypointsPanelIsOpen={setWaypointsPanelIsOpen} />
        {waypointsPanelIsOpen && waypointsPanelData && (
          <WaypointsPanel
            waypointsPanelIsOpen={waypointsPanelIsOpen}
            setWaypointsPanelIsOpen={setWaypointsPanelIsOpen}
            waypoints={operationalPoints}
            waypointsPanelData={waypointsPanelData}
          />
        )}
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
            top: 2,
            height: `${heightOfManchetteWithSpaceTimeChart - 6}px`,
          }}
        >
          <div className="toolbar">
            <button type="button" onClick={() => setShowSettingsPanel(true)}>
              <KebabHorizontal />
            </button>
          </div>
          {showSettingsPanel && (
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              onClose={() => setShowSettingsPanel(false)}
            />
          )}
          <SpaceTimeChart
            className="inset-0 absolute h-full"
            spaceOrigin={
              (waypointsPanelData?.filteredWaypoints ?? operationalPoints).at(0)?.position || 0
            }
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
            {settings.showConflicts && <ConflictLayer conflicts={conflicts} />}
            {settings.showSignalsStates && (
              <OccupancyBlockLayer occupancyBlocks={occupancyBlocks} />
            )}
          </SpaceTimeChart>
        </div>
      </div>
    </div>
  );
};

export default ManchetteWithSpaceTimeChartWrapper;
