import { useEffect, useState, useMemo } from 'react';

import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { type Conflict } from 'common/api/osrdEditoastApi';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';
import ResizableSection from 'common/ResizableSection';
import ManchetteWithSpaceTimeChartWrapper, {
  MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
} from 'modules/simulationResult/components/ManchetteWithSpaceTimeChart/ManchetteWithSpaceTimeChart';
import SimulationResultsMap from 'modules/simulationResult/components/SimulationResultsMap';
import useGetProjectedTrainOperationalPoints from 'modules/simulationResult/components/SpaceTimeChart/useGetProjectedTrainOperationalPoints';
import useProjectedConflicts from 'modules/simulationResult/components/SpaceTimeChart/useProjectedConflicts';
import SpeedSpaceChartContainer from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChartContainer';
import SimulationResultExport from 'modules/simulationResult/SimulationResultExport/SimulationResultsExport';
import type { ProjectionData, TrainSpaceTimeData } from 'modules/simulationResult/types';
import TimesStopsOutput from 'modules/timesStops/TimesStopsOutput';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';
import { getOperationalStudiesTimetableID } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { extractPacedTrainIdFromOccurrenceId, isTrainScheduleId } from 'utils/trainId';

import { useScenarioContext } from '../hooks/useScenarioContext';
import useSimulationResults from '../hooks/useSimulationResults';

const SPEED_SPACE_CHART_HEIGHT = 521.5;
const HANDLE_TAB_RESIZE_HEIGHT = 20;
const MANCHETTE_HEIGHT_DIFF = 76;

type SimulationResultsProps = {
  scenarioData: { name: string; infraName: string };
  projectionData?: ProjectionData;
  timetableItemsWithDetails: TimetableItemWithDetails[];

  conflicts?: Conflict[];
  updateTrainDepartureTime: (trainId: TimetableItemId, newDepartureTime: Date) => void;
};

const SimulationResults = ({
  scenarioData,
  projectionData,
  timetableItemsWithDetails,
  conflicts = [],
  updateTrainDepartureTime,
}: SimulationResultsProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'simulationResults' });
  const dispatch = useAppDispatch();
  const { infraId } = useScenarioContext();

  const timetableId = useSelector(getOperationalStudiesTimetableID);
  const selectedTrainId = useSelector(getSelectedTrainId);

  const {
    selectedTimetableItem,
    selectedTimetableItemRollingStock,
    selectedTimetableItemPowerRestrictions,
    timetableItemSimulation,
    pathProperties,
    path,
  } = useSimulationResults(infraId);

  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const [showWarpedMap, setShowWarpedMap] = useState(false);

  const [manchetteWithSpaceTimeChartHeight, setManchetteWithSpaceTimeChartHeight] = useState(
    MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT
  );

  const [speedSpaceChartContainerHeight, setSpeedSpaceChartContainerHeight] =
    useState(SPEED_SPACE_CHART_HEIGHT);
  const [mapCanvas, setMapCanvas] = useState<string>();

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
    timetableItemUsedForProjection: projectionData?.trainSchedule,
    infraId,
    timetableId,
  });

  const conflictZones = useProjectedConflicts(infraId, conflicts, projectionData?.path);

  const selectedTrainSummary = useMemo(
    () =>
      timetableItemsWithDetails?.find(
        (timetableItem) => timetableItem.id === selectedTimetableItem?.id
      ),
    [timetableItemsWithDetails, selectedTimetableItem]
  );

  const handleTrainDrag = async (
    draggedTrainId: TrainId,
    newDepartureTime: Date,
    { stopPanning }: { stopPanning: boolean }
  ) => {
    if (stopPanning) {
      // update in the database
      const draggedItemId = isTrainScheduleId(draggedTrainId)
        ? draggedTrainId
        : extractPacedTrainIdFromOccurrenceId(draggedTrainId);
      updateTrainDepartureTime(draggedItemId, newDepartureTime);
    } else {
      // update in the state
      setProjectPathTrainResult(
        projectPathTrainResult.map((train) =>
          train.id === draggedTrainId ? { ...train, departureTime: newDepartureTime } : train
        )
      );
    }
  };

  if ((!selectedTimetableItem || !timetableItemSimulation) && !projectionData) {
    return null;
  }
  return (
    <div className="simulation-results">
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
                      selectedTrainId={selectedTrainId}
                      timetableItemsWithDetails={timetableItemsWithDetails}
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
                      onTrainClick={(trainId) => {
                        dispatch(updateSelectedTrainId(trainId));
                      }}
                      selectedProjectionId={trainIdUsedForProjection}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ResizableSection>

      {selectedTimetableItem && timetableItemSimulation && (
        <>
          {/* SIMULATION : SPEED SPACE CHART */}
          {selectedTimetableItemRollingStock && pathProperties && (
            <div className="osrd-simulation-container speedspacechart-container">
              <div
                className="chart-container"
                style={{
                  height: `${speedSpaceChartContainerHeight + HANDLE_TAB_RESIZE_HEIGHT}px`,
                }}
              >
                <SpeedSpaceChartContainer
                  timetableItemSimulation={timetableItemSimulation}
                  selectedTimetableItemPowerRestrictions={selectedTimetableItemPowerRestrictions}
                  rollingStock={selectedTimetableItemRollingStock}
                  pathProperties={pathProperties}
                  heightOfSpeedSpaceChartContainer={speedSpaceChartContainerHeight}
                  setHeightOfSpeedSpaceChartContainer={setSpeedSpaceChartContainerHeight}
                />
              </div>
            </div>
          )}

          {/* SIMULATION : MAP */}
          <div data-testid="simulation-map" className="simulation-map">
            <SimulationResultsMap
              geometry={pathProperties?.geometry}
              setMapCanvas={setMapCanvas}
              pathfindingResult={path}
            />
          </div>

          {/* TIME STOPS TABLE */}
          <div className="time-stop-outputs">
            <p className="mt-2 mb-3 ml-3 font-weight-bold">{t('timetableOutput')}</p>
            <TimesStopsOutput
              simulatedTimetableItem={timetableItemSimulation}
              timetableItemWithDetails={selectedTrainSummary}
              operationalPoints={pathProperties?.operationalPoints}
              selectedTimetableItem={selectedTimetableItem}
              path={path}
            />
          </div>

          {/* SIMULATION EXPORT BUTTONS */}
          {pathProperties && selectedTimetableItemRollingStock && path && (
            <SimulationResultExport
              path={path}
              scenarioData={scenarioData}
              timetableItem={selectedTimetableItem}
              simulation={timetableItemSimulation}
              pathProperties={pathProperties}
              rollingStock={selectedTimetableItemRollingStock}
              mapCanvas={mapCanvas}
            />
          )}
        </>
      )}
    </div>
  );
};

export default SimulationResults;
