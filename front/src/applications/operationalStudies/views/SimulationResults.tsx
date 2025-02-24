import { useEffect, useState, useMemo } from 'react';

import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { type Conflict } from 'common/api/osrdEditoastApi';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';
import ResizableSection from 'common/ResizableSection';
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
import { getOperationalStudiesTimetableID } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  formatEditoastTrainIdToTrainScheduleId,
  formatTrainScheduleIdToEditoastTrainId,
} from 'utils/trainId';

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
  updateTrainDepartureTime: (trainId: TrainId, newDepartureTime: Date) => void;
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

  const timetableId = useSelector(getOperationalStudiesTimetableID);

  const {
    selectedTrainSchedule,
    selectedTrainRollingStock,
    selectedTrainPowerRestrictions,
    trainSimulation,
    pathProperties,
    path,
  } = useSimulationResults();

  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const [showWarpedMap, setShowWarpedMap] = useState(false);

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

  const {
    operationalPoints: projectedOperationalPoints,
    filteredOperationalPoints,
    setFilteredOperationalPoints,
  } = useGetProjectedTrainOperationalPoints({
    trainScheduleUsedForProjection: projectionData?.trainSchedule,
    trainIdUsedForProjection: projectionData?.trainSchedule.id,
    infraId,
    timetableId,
  });

  const trainUsedForProjectionSpaceTimeData = useMemo(
    () =>
      projectionData?.projectedTrains.find(
        (_train) => _train.id === projectionData.trainSchedule.id
      ),
    [projectionData]
  );

  const conflictZones = useProjectedConflicts(infraId, conflicts, projectionData?.path);

  const selectedTrainSummary = useMemo(
    () =>
      trainScheduleSummaries?.find(
        (train) => formatTrainScheduleIdToEditoastTrainId(train.id) === selectedTrainSchedule?.id
      ),
    [trainScheduleSummaries, selectedTrainSchedule]
  );

  const handleTrainDrag = async (
    draggedTrainId: TrainId,
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
                  {trainIdUsedForProjection && (
                    <ManchetteWithSpaceTimeChartWrapper
                      operationalPoints={projectedOperationalPoints}
                      projectPathTrainResult={projectPathTrainResult}
                      selectedTrainScheduleId={
                        selectedTrainSchedule?.id
                          ? formatEditoastTrainIdToTrainScheduleId(selectedTrainSchedule.id)
                          : undefined
                      }
                      waypointsPanelData={{
                        filteredWaypoints: filteredOperationalPoints,
                        setFilteredWaypoints: setFilteredOperationalPoints,
                        projectionPath: projectionData.trainSchedule.path,
                        timetableId,
                      }}
                      conflicts={conflictZones}
                      projectionLoaderData={projectionData.projectionLoaderData}
                      height={manchetteWithSpaceTimeChartHeight - MANCHETTE_HEIGHT_DIFF}
                      handleTrainDrag={handleTrainDrag}
                      onTrainClick={(trainId) => dispatch(updateSelectedTrainId(trainId))}
                      selectedProjectionId={trainIdUsedForProjection}
                    />
                  )}
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
              geometry={pathProperties?.geometry}
              trainSimulation={{
                ...trainSimulation,
                trainId: selectedTrainSchedule.id,
                startTime: selectedTrainSchedule.start_time,
              }}
              setMapCanvas={setMapCanvas}
              pathfindingResult={path}
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
