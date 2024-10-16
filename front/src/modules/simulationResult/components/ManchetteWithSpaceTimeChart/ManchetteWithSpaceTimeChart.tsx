import { useRef, useState } from 'react';

import { KebabHorizontal } from '@osrd-project/ui-icons';
import { Manchette } from '@osrd-project/ui-manchette';
import { useManchettesWithSpaceTimeChart } from '@osrd-project/ui-manchette-with-spacetimechart';
import {
  ConflictLayer,
  OccupancyBlockLayer,
  PathLayer,
  SpaceTimeChart,
} from '@osrd-project/ui-spacetimechart';
import type { Conflict } from '@osrd-project/ui-spacetimechart';

import type { OperationalPoint, TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { WaypointsPanelData } from 'modules/simulationResult/types';

import SettingsPanel from './SettingsPanel';
import ManchetteMenuButton from '../SpaceTimeChart/ManchetteMenuButton';
import WaypointsPanel from '../SpaceTimeChart/WaypointsPanel';
import { OCCUPANCY_BLOCKS_COLORS } from 'modules/simulationResult/consts';

type ManchetteWithSpaceTimeChartProps = {
  operationalPoints: OperationalPoint[];
  projectPathTrainResult: TrainSpaceTimeData[];
  selectedTrainScheduleId?: number;
  waypointsPanelData?: WaypointsPanelData;
  conflicts?: Conflict[];
};
const DEFAULT_HEIGHT = 561;

const ManchetteWithSpaceTimeChartWrapper = ({
  operationalPoints,
  projectPathTrainResult,
  selectedTrainScheduleId,
  waypointsPanelData,
  conflicts = [],
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
    showBAL: false,
    showBAPR: false,
    showTVM: false,
    showSignalsStates: false,
  });

  const occupancyBlocks = projectPathTrainResult
    .filter((train) => train.signal_updates)
    .flatMap((train) =>
      train.signal_updates.flatMap((block) => ({
        timeStart: +new Date(train.departure_time) + block.time_start,
        timeEnd: +new Date(train.departure_time) + block.time_end,
        spaceStart: block.position_start,
        spaceEnd: block.position_end,
        aspect_label: block.aspect_label,
        color: block.aspect_label.includes('VL')
          ? OCCUPANCY_BLOCKS_COLORS.FREE
          : block.aspect_label === 'S' || block.aspect_label === 'OCCUPIED'
            ? OCCUPANCY_BLOCKS_COLORS.SEMAPHORE
            : block.aspect_label.includes('A')
              ? OCCUPANCY_BLOCKS_COLORS.WARNING
              : '',
        departure_time: train.departure_time,
      }))
    );

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
            top: 0,
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
          {/* TODO: remove this condition after closing
          https://github.com/OpenRailAssociation/osrd-ui/issues/648 */}
          {spaceTimeChartProps.spaceScales.length > 0 && (
            <SpaceTimeChart
              className="inset-0 absolute h-full"
              spaceOrigin={
                (waypointsPanelData?.filteredWaypoints ?? operationalPoints).at(0)?.position || 0
              }
              timeOrigin={Math.min(
                ...projectPathTrainResult.map((p) => +new Date(p.departure_time))
              )}
              {...spaceTimeChartProps}
            >
              {spaceTimeChartProps.paths.map((path) => (
                <PathLayer key={path.id} path={path} color={path.color} />
              ))}
              {settings.showConflicts && <ConflictLayer conflicts={conflicts} />}
              {settings.showSignalsStates && (
                <OccupancyBlockLayer occupancyBlocks={occupancyBlocks} />
              )}
            </SpaceTimeChart>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManchetteWithSpaceTimeChartWrapper;
