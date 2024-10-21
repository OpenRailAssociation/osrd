import { useEffect, useState, useMemo } from 'react';

import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { SimulationResultsData } from 'applications/operationalStudies/types';
import type { Conflict } from 'common/api/osrdEditoastApi';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';
import ManchetteWithSpaceTimeChartWrapper from 'modules/simulationResult/components/ManchetteWithSpaceTimeChart/ManchetteWithSpaceTimeChart';
import SimulationResultsMap from 'modules/simulationResult/components/SimulationResultsMap/SimulationResultsMap';
import ProjectionLoadingMessage from 'modules/simulationResult/components/SpaceTimeChart/ProjectionLoadingMessage';
import useGetProjectedTrainOperationalPoints from 'modules/simulationResult/components/SpaceTimeChart/useGetProjectedTrainOperationalPoints';
import useProjectedConflicts from 'modules/simulationResult/components/SpaceTimeChart/useProjectedConflicts';
import SpeedSpaceChartContainer from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChartContainer';
import TimeButtons from 'modules/simulationResult/components/TimeButtons';
import TrainDetails from 'modules/simulationResult/components/TrainDetails';
import type { ProjectionData } from 'modules/simulationResult/types';
import TimesStopsOutput from 'modules/timesStops/TimesStopsOutput';
import DriverTrainSchedule from 'modules/trainschedule/components/DriverTrainSchedule/DriverTrainSchedule';
import { useFormattedOperationalPoints } from 'modules/trainschedule/useFormattedOperationalPoints';
import { updateViewport, type Viewport } from 'reducers/map';
import { useAppDispatch } from 'store';

const SPEED_SPACE_CHART_HEIGHT = 521.5;
const HANDLE_TAB_RESIZE_HEIGHT = 20;

type SimulationResultsProps = {
  collapsedTimetable: boolean;
  infraId?: number;
  simulationResults: SimulationResultsData;
  projectionData?: ProjectionData;
  timetableTrainNb: number;
  conflicts?: Conflict[];
};

const SimulationResults = ({
  collapsedTimetable,
  infraId,
  simulationResults: {
    selectedTrainSchedule,
    selectedTrainRollingStock,
    selectedTrainPowerRestrictions,
    trainSimulation,
    pathProperties,
    path,
  },
  projectionData,
  timetableTrainNb,
  conflicts = [],
}: SimulationResultsProps) => {
  const { t } = useTranslation('simulation');
  const dispatch = useAppDispatch();

  const [extViewport, setExtViewport] = useState<Viewport>();
  const [showWarpedMap, setShowWarpedMap] = useState(false);

  const [speedSpaceChartContainerHeight, setSpeedSpaceChartContainerHeight] =
    useState(SPEED_SPACE_CHART_HEIGHT);

  const {
    operationalPoints,
    loading: formattedOpPointsLoading,
    baseOrEco,
    setBaseOrEco,
  } = useFormattedOperationalPoints(
    selectedTrainSchedule,
    trainSimulation,
    pathProperties,
    infraId
  );

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

  useEffect(() => {
    if (extViewport !== undefined) {
      dispatch(
        updateViewport({
          ...extViewport,
        })
      );
    }
  }, [extViewport]);

  if (!trainSimulation) return null;

  if (trainSimulation.status !== 'success') return null;

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
      <div className="simulation-warped-map d-flex flex-row align-items-stretch mb-2">
        {projectionData && projectionData.projectedTrains.length > 0 && pathProperties && (
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
                {!projectionData.allTrainsProjected && (
                  <ProjectionLoadingMessage
                    projectedTrainsNb={projectionData.projectedTrains.length}
                    totalTrains={timetableTrainNb}
                  />
                )}
                <ManchetteWithSpaceTimeChartWrapper
                  operationalPoints={projectedOperationalPoints}
                  projectPathTrainResult={projectionData?.projectedTrains}
                  selectedTrainScheduleId={selectedTrainSchedule?.id}
                  waypointsPanelData={{
                    filteredWaypoints: filteredOperationalPoints,
                    setFilteredWaypoints: setFilteredOperationalPoints,
                    projectionPath: projectionData.trainSchedule.path,
                  }}
                  conflicts={conflictZones}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* TRAIN : SPACE SPEED CHART */}
      {selectedTrainRollingStock && trainSimulation && pathProperties && selectedTrainSchedule && (
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
          trainSimulation={
            selectedTrainSchedule && trainSimulation
              ? {
                  ...trainSimulation,
                  trainId: selectedTrainSchedule.id,
                  startTime: selectedTrainSchedule.start_time,
                }
              : undefined
          }
        />
      </div>

      {/* TIME STOPS TABLE */}
      {selectedTrainSchedule &&
        trainSimulation.status === 'success' &&
        pathProperties &&
        operationalPoints &&
        infraId && (
          <div className="time-stop-outputs">
            <TimesStopsOutput
              simulatedTrain={trainSimulation}
              pathProperties={pathProperties}
              operationalPoints={operationalPoints.finalOutput}
              selectedTrainSchedule={selectedTrainSchedule}
              path={path}
              dataIsLoading={formattedOpPointsLoading}
            />
          </div>
        )}

      {/* TRAIN : DRIVER TRAIN SCHEDULE */}
      {selectedTrainSchedule &&
        trainSimulation &&
        pathProperties &&
        selectedTrainRollingStock &&
        operationalPoints &&
        infraId && (
          <div className="driver-train-schedule">
            <DriverTrainSchedule
              train={selectedTrainSchedule}
              simulatedTrain={trainSimulation}
              pathProperties={pathProperties}
              rollingStock={selectedTrainRollingStock}
              operationalPoints={operationalPoints}
              formattedOpPointsLoading={formattedOpPointsLoading}
              baseOrEco={baseOrEco}
              setBaseOrEco={setBaseOrEco}
            />
          </div>
        )}
    </div>
  );
};

export default SimulationResults;
