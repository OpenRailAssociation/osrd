import { useEffect, useState, useMemo } from 'react';

import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';

import { type Conflict, type PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';
import ResizableSection from 'common/ResizableSection';
import getPointOnPathCoordinates from 'modules/pathfinding/helpers/getPointOnPathCoordinates';
import getTrackLengthCumulativeSums from 'modules/pathfinding/helpers/getTrackLengthCumulativeSums';
import ManchetteWithSpaceTimeChartWrapper, {
  MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
} from 'modules/simulationResult/components/ManchetteWithSpaceTimeChart/ManchetteWithSpaceTimeChart';
import SimulationResultsMap from 'modules/simulationResult/components/SimulationResultsMap/SimulationResultsMap';
import useGetProjectedTrainOperationalPoints from 'modules/simulationResult/components/SpaceTimeChart/useGetProjectedTrainOperationalPoints';
import useProjectedConflicts from 'modules/simulationResult/components/SpaceTimeChart/useProjectedConflicts';
import SpeedSpaceChartContainer from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChartContainer';
import TimeButtons from 'modules/simulationResult/components/TimeButtons';
import TrainDetails from 'modules/simulationResult/components/TrainDetails';
import { useFormattedOperationalPoints } from 'modules/simulationResult/hooks/useFormattedOperationalPoints';
import SimulationResultExport from 'modules/simulationResult/SimulationResultExport/SimulationResultsExport';
import type { ProjectionData } from 'modules/simulationResult/types';
import TimesStopsOutput from 'modules/timesStops/TimesStopsOutput';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';
import { updateViewport, type Viewport } from 'reducers/map';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';

import { useScenarioContext } from '../hooks/useScenarioContext';
import useSimulationResults from '../hooks/useSimulationResults';
import type { TrainSpaceTimeData } from '../types';

const SPEED_SPACE_CHART_HEIGHT = 521.5;
const HANDLE_TAB_RESIZE_HEIGHT = 20;
const MANCHETTE_HEIGHT_DIFF = 76;

type SimulationResultsProps = {
  scenarioData: { name: string; infraName: string };
  collapsedTimetable: boolean;
  infraId?: number;
  projectionData?: ProjectionData;
  trainScheduleSummaries?: TrainScheduleWithDetails[];
  conflicts?: Conflict[];
  updateTrainDepartureTime: (trainId: number, newDepartureTime: Date) => void;
};

const SimulationResults = ({
  scenarioData,
  collapsedTimetable,
  infraId,
  projectionData,
  trainScheduleSummaries,
  conflicts = [],
  updateTrainDepartureTime,
}: SimulationResultsProps) => {
  const { t } = useTranslation('simulation');
  const dispatch = useAppDispatch();

  const { getTrackSectionsByIds } = useScenarioContext();

  const {
    selectedTrainSchedule,
    selectedTrainRollingStock,
    selectedTrainPowerRestrictions,
    trainSimulation,
    pathProperties,
    path,
  } = useSimulationResults();

  const [extViewport, setExtViewport] = useState<Viewport>();
  const [showWarpedMap, setShowWarpedMap] = useState(false);
  const [pathItemsCoordinates, setPathItemsCoordinates] = useState<Position[]>();

  const [manchetteWithSpaceTimeChartHeight, setManchetteWithSpaceTimeChartHeight] = useState(
    MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT
  );

  const [speedSpaceChartContainerHeight, setSpeedSpaceChartContainerHeight] =
    useState(SPEED_SPACE_CHART_HEIGHT);
  const [mapCanvas, setMapCanvas] = useState<string>();

  const { operationalPoints, loading: formattedOpPointsLoading } = useFormattedOperationalPoints(
    selectedTrainSchedule,
    trainSimulation,
    pathProperties
  );

  const [projectPathTrainResult, setProjectPathTrainResult] = useState<TrainSpaceTimeData[]>([]);

  useEffect(() => {
    if (projectionData?.projectedTrains) {
      setProjectPathTrainResult(projectionData?.projectedTrains || []);
    }
  }, [projectionData]);

  // Compute path items coordinates in order to place them on the map
  useEffect(() => {
    const getPathItemsCoordinates = async (pathfindingResult: PathfindingResultSuccess) => {
      const trackIds = pathfindingResult.track_section_ranges.map((range) => range.track_section);
      const tracks = await getTrackSectionsByIds(trackIds);
      const tracksLengthCumulativeSums = getTrackLengthCumulativeSums(
        pathfindingResult.track_section_ranges
      );

      const waypointsCoordinates = pathfindingResult.path_item_positions.map((position) =>
        getPointOnPathCoordinates(
          tracks,
          pathfindingResult.track_section_ranges,
          tracksLengthCumulativeSums,
          position
        )
      );

      setPathItemsCoordinates(waypointsCoordinates);
    };

    if (path) {
      getPathItemsCoordinates(path);
    }
  }, [path]);

  const {
    operationalPoints: projectedOperationalPoints,
    filteredOperationalPoints,
    setFilteredOperationalPoints,
  } = useGetProjectedTrainOperationalPoints(
    projectionData?.trainSchedule,
    projectionData?.trainSchedule.id,
    infraId
  );

  const trainUsedForProjectionSpaceTimeData = useMemo(
    () =>
      projectionData?.projectedTrains.find(
        (_train) => _train.id === projectionData.trainSchedule.id
      ),
    [projectionData]
  );

  const conflictZones = useProjectedConflicts(infraId, conflicts, projectionData?.path);

  const selectedTrainSummary = useMemo(
    () => trainScheduleSummaries?.find((train) => train.id === selectedTrainSchedule?.id),
    [trainScheduleSummaries, selectedTrainSchedule]
  );

  const handleTrainDrag = async (
    draggedTrainId: number,
    newDepartureTime: Date,
    { stopPanning }: { stopPanning: boolean }
  ) => {
    if (stopPanning) {
      // update in the database
      dispatch(updateSelectedTrainId(draggedTrainId));
      updateTrainDepartureTime(draggedTrainId, newDepartureTime);
    } else {
      // update in the state
      setProjectPathTrainResult(
        projectPathTrainResult.map((train) =>
          train.id === draggedTrainId ? { ...train, departureTime: newDepartureTime } : train
        )
      );
    }
  };

  useEffect(() => {
    if (extViewport !== undefined) {
      dispatch(
        updateViewport({
          ...extViewport,
        })
      );
    }
  }, [extViewport]);

  if ((!selectedTrainSchedule || !trainSimulation) && !projectionData) {
    return null;
  }

  return (
    <div className="simulation-results">
      {/* SIMULATION : STICKY BAR */}
      {selectedTrainSchedule && (
        <div
          className={cx('osrd-simulation-sticky-bar', {
            'with-collapsed-timetable': collapsedTimetable,
          })}
        >
          <div className="row">
            <div className="col-xl-4">
              <TimeButtons departureTime={selectedTrainSchedule.start_time} />
            </div>
            {trainUsedForProjectionSpaceTimeData && (
              <TrainDetails projectedTrain={trainUsedForProjectionSpaceTimeData} />
            )}
          </div>
        </div>
      )}

      {/* SIMULATION : SPACE TIME CHART */}
      <ResizableSection
        height={manchetteWithSpaceTimeChartHeight}
        setHeight={setManchetteWithSpaceTimeChartHeight}
        minHeight={MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT}
      >
        <div
          className="simulation-warped-map d-flex flex-row align-items-stretch mb-2"
          style={{ height: manchetteWithSpaceTimeChartHeight }}
        >
          {projectionData && projectionData.projectedTrains.length > 0 && (
            <>
              <button
                type="button"
                className="show-warped-map-button my-3 ml-3 mr-1"
                aria-label={t('toggleWarpedMap')}
                title={t('toggleWarpedMap')}
                onClick={() => setShowWarpedMap(!showWarpedMap)}
              >
                {showWarpedMap ? <ChevronLeft /> : <ChevronRight />}
              </button>
              <SimulationWarpedMap
                collapsed={!showWarpedMap}
                pathGeometry={projectionData.geometry}
              />

              <div className="osrd-simulation-container d-flex flex-grow-1 flex-shrink-1">
                <div className="chart-container">
                  <ManchetteWithSpaceTimeChartWrapper
                    operationalPoints={projectedOperationalPoints}
                    projectPathTrainResult={projectPathTrainResult}
                    selectedTrainScheduleId={selectedTrainSchedule?.id}
                    waypointsPanelData={{
                      filteredWaypoints: filteredOperationalPoints,
                      setFilteredWaypoints: setFilteredOperationalPoints,
                      projectionPath: projectionData.trainSchedule.path,
                    }}
                    conflicts={conflictZones}
                    projectionLoaderData={projectionData.projectionLoaderData}
                    height={manchetteWithSpaceTimeChartHeight - MANCHETTE_HEIGHT_DIFF}
                    handleTrainDrag={handleTrainDrag}
                    onTrainClick={(trainId) => dispatch(updateSelectedTrainId(trainId))}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </ResizableSection>

      {selectedTrainSchedule && trainSimulation && (
        <>
          {/* TRAIN : SPACE SPEED CHART */}
          {selectedTrainRollingStock && pathProperties && (
            <div className="osrd-simulation-container speedspacechart-container">
              <div
                className="chart-container"
                style={{
                  height: `${speedSpaceChartContainerHeight + HANDLE_TAB_RESIZE_HEIGHT}px`,
                }}
              >
                <SpeedSpaceChartContainer
                  trainSimulation={trainSimulation}
                  selectedTrainPowerRestrictions={selectedTrainPowerRestrictions}
                  rollingStock={selectedTrainRollingStock}
                  pathProperties={pathProperties}
                  heightOfSpeedSpaceChartContainer={speedSpaceChartContainerHeight}
                  setHeightOfSpeedSpaceChartContainer={setSpeedSpaceChartContainerHeight}
                />
              </div>
            </div>
          )}

          {/* SIMULATION : MAP */}
          <div className="simulation-map">
            <SimulationResultsMap
              setExtViewport={setExtViewport}
              geometry={pathProperties?.geometry}
              trainSimulation={{
                ...trainSimulation,
                trainId: selectedTrainSchedule.id,
                startTime: selectedTrainSchedule.start_time,
              }}
              pathItemsCoordinates={pathItemsCoordinates}
              setMapCanvas={setMapCanvas}
            />
          </div>

          {/* TIME STOPS TABLE */}
          <div className="time-stop-outputs">
            <p className="mt-2 mb-3 ml-3 font-weight-bold">{t('timetableOutput')}</p>
            <TimesStopsOutput
              simulatedTrain={trainSimulation}
              trainSummary={selectedTrainSummary}
              operationalPoints={pathProperties?.operationalPoints}
              selectedTrainSchedule={selectedTrainSchedule}
              path={path}
              dataIsLoading={formattedOpPointsLoading}
            />
          </div>

          {/* SIMULATION EXPORT BUTTONS */}
          {pathProperties && selectedTrainRollingStock && operationalPoints && path && infraId && (
            <SimulationResultExport
              path={path}
              scenarioData={scenarioData}
              train={selectedTrainSchedule}
              simulatedTrain={trainSimulation}
              pathElectrifications={pathProperties.electrifications}
              operationalPoints={operationalPoints}
              rollingStock={selectedTrainRollingStock}
              mapCanvas={mapCanvas}
            />
          )}
        </>
      )}
    </div>
  );
};

export default SimulationResults;
