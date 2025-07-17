import { useEffect, useState, useMemo } from 'react';

import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import { keyBy } from 'lodash';
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
import useTrackOccupancy, {
  type OccupancyTrainSpaceTimeData,
} from 'modules/simulationResult/components/SpaceTimeChart/useTrackOccupancy';
import SpeedSpaceChartContainer from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChartContainer';
import SimulationResultExport from 'modules/simulationResult/SimulationResultExport/SimulationResultsExport';
import type { ProjectionData } from 'modules/simulationResult/types';
import TimesStopsOutput from 'modules/timesStops/TimesStopsOutput';
import type { TimetableItemWithDetails } from 'modules/timetableItem/components/Timetable/types';
import { findExceptionWithOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import { getOperationalStudiesTimetableID } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { getTrainUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  extractPacedTrainIdFromOccurrenceId,
  isPacedTrainWithDetails,
  isTrainScheduleId,
} from 'utils/trainId';

import BoardWrapper from '../components/Scenario/BoardWrapper';
import { useScenarioContext } from '../hooks/useScenarioContext';
import useSimulationResults from '../hooks/useSimulationResults';
import type { Board } from '../types';

const SPEED_SPACE_CHART_HEIGHT = 521.5;
const HANDLE_TAB_RESIZE_HEIGHT = 20;
const MANCHETTE_HEIGHT_DIFF = 76;

type SimulationResultsProps = {
  scenarioData: { name: string; infraName: string };
  projectionData?: ProjectionData;
  timetableItemsWithDetails: TimetableItemWithDetails[];
  conflicts?: Conflict[];
  activeBoards: Set<Board>;
  updateTrainDepartureTime: (trainId: TimetableItemId, newDepartureTime: Date) => Promise<void>;
  isMapDisplayed?: boolean;
};

const SimulationResults = ({
  scenarioData,
  projectionData,
  timetableItemsWithDetails,
  conflicts = [],
  activeBoards,
  updateTrainDepartureTime,
  isMapDisplayed,
}: SimulationResultsProps) => {
  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const { infraId } = useScenarioContext();

  const timetableId = useSelector(getOperationalStudiesTimetableID);

  const simulationResults = useSimulationResults(infraId);
  const selectedTrainId = simulationResults?.train.id;

  const trainUsedForProjection = useSelector(getTrainUsedForProjection);

  const [showWarpedMap, setShowWarpedMap] = useState(false);

  const [manchetteWithSpaceTimeChartHeight, setManchetteWithSpaceTimeChartHeight] = useState(
    MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT
  );

  const [speedSpaceChartContainerHeight, setSpeedSpaceChartContainerHeight] =
    useState(SPEED_SPACE_CHART_HEIGHT);
  const [mapCanvas, setMapCanvas] = useState<string>();

  const [projectPathTrainResult, setProjectPathTrainResult] = useState<
    OccupancyTrainSpaceTimeData[]
  >([]);

  useEffect(() => {
    if (projectionData?.projectedTrains) {
      const timetableItemDict = keyBy(timetableItemsWithDetails, 'id');
      setProjectPathTrainResult(
        projectionData.projectedTrains.map((train) => {
          const timetableItem =
            timetableItemDict[
              isTrainScheduleId(train.id) ? train.id : extractPacedTrainIdFromOccurrenceId(train.id)
            ];
          return {
            ...train,
            originPathItemLocation: timetableItem?.path.at(0),
            destinationPathItemLocation: timetableItem?.path.at(-1),
          };
        })
      );
    }
  }, [projectionData, timetableItemsWithDetails]);

  const {
    operationalPoints: projectedOperationalPoints,
    filteredOperationalPoints,
    setFilteredOperationalPoints,
  } = useGetProjectedTrainOperationalPoints({
    timetableItemUsedForProjection: projectionData?.trainSchedule,
    exceptionKeyUsedForProjection: projectionData?.exceptionKeyUsedForProjection,
    infraId,
    timetableId,
  });

  const {
    toggleWaypoint,
    deployedWaypoints,
    handleTrainDrag: handleTrainDragInTrackOccupancy,
  } = useTrackOccupancy({
    infraId,
    pathOperationalPoints: filteredOperationalPoints,
    trains: projectPathTrainResult,
  });

  const conflictZones = useProjectedConflicts(infraId, conflicts, projectionData?.path);

  const simulationSummary = useMemo(() => {
    if (!selectedTrainId) return undefined;

    if (isTrainScheduleId(selectedTrainId)) {
      return timetableItemsWithDetails.find((timetableItem) => timetableItem.id === selectedTrainId)
        ?.summary;
    }

    const pacedTrain = timetableItemsWithDetails.find(
      (timetableItem) => timetableItem.id === extractPacedTrainIdFromOccurrenceId(selectedTrainId)
    );
    if (!pacedTrain || !isPacedTrainWithDetails(pacedTrain)) return undefined;
    const exception = findExceptionWithOccurrenceId(pacedTrain.exceptions, selectedTrainId);
    return exception?.summary ?? pacedTrain.summary;
  }, [timetableItemsWithDetails, selectedTrainId]);

  const handleTrainDrag = async ({
    draggedTrainId,
    newDepartureTime,
    initialDepartureTime,
    stopPanning,
  }: {
    draggedTrainId: TrainId;
    newDepartureTime: Date;
    initialDepartureTime: Date;
    stopPanning: boolean;
  }) => {
    const draggedTrain = projectPathTrainResult.find((train) => train.id === draggedTrainId);
    if (!draggedTrain) return;

    const newTrainData = { ...draggedTrain, departureTime: newDepartureTime };

    // Handle updating track occupancy data (with no distant update yet, so with stopPanning: false)
    await handleTrainDragInTrackOccupancy({
      draggedTrainId,
      stopPanning: false,
      initialDepartureTime,
      newTrainData,
    });

    if (stopPanning) {
      // update in the database
      const draggedItemId = isTrainScheduleId(draggedTrainId)
        ? draggedTrainId
        : extractPacedTrainIdFromOccurrenceId(draggedTrainId);
      await updateTrainDepartureTime(draggedItemId, newDepartureTime);

      // Handle retrieving track occupancy data from server (so with stopPanning: true):
      await handleTrainDragInTrackOccupancy({
        draggedTrainId,
        stopPanning,
        initialDepartureTime,
        newTrainData,
      });
    } else {
      // update in the state
      setProjectPathTrainResult(
        projectPathTrainResult.map((train) => (train.id === draggedTrainId ? newTrainData : train))
      );
    }
  };

  if (!simulationResults && !projectionData) {
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
                aria-label={t('simulationResults.toggleWarpedMap')}
                title={t('simulationResults.toggleWarpedMap')}
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
                  {trainUsedForProjection && (
                    <ManchetteWithSpaceTimeChartWrapper
                      operationalPoints={projectedOperationalPoints}
                      projectPathTrainResult={projectPathTrainResult}
                      selectedTrainId={selectedTrainId}
                      timetableItemsWithDetails={timetableItemsWithDetails}
                      waypointsPanelData={{
                        filteredWaypoints: filteredOperationalPoints,
                        setFilteredWaypoints: setFilteredOperationalPoints,
                        projectionPath: projectionData.trainSchedule.path,
                        deployedWaypoints: new Set(
                          deployedWaypoints.map(({ waypointId }) => waypointId)
                        ),
                        toggleDeployedWaypoint: toggleWaypoint,
                        timetableId,
                      }}
                      occupancyZonesLayers={deployedWaypoints}
                      onCloseOccupancyLayer={(waypointId: string) =>
                        toggleWaypoint(waypointId, false)
                      }
                      conflicts={conflictZones}
                      projectionLoaderData={projectionData.projectionLoaderData}
                      height={manchetteWithSpaceTimeChartHeight - MANCHETTE_HEIGHT_DIFF}
                      handleTrainDrag={handleTrainDrag}
                      onTrainClick={(trainId) => {
                        dispatch(updateSelectedTrainId(trainId));
                      }}
                      selectedProjectionId={trainUsedForProjection.id}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ResizableSection>

      {simulationResults?.isValid && (
        <>
          {/* SIMULATION : SPEED SPACE CHART */}
          <div className="osrd-simulation-container speedspacechart-container">
            <div
              className="chart-container"
              style={{
                height: `${speedSpaceChartContainerHeight + HANDLE_TAB_RESIZE_HEIGHT}px`,
              }}
            >
              <SpeedSpaceChartContainer
                timetableItemSimulation={simulationResults.simulation}
                selectedTimetableItemPowerRestrictions={simulationResults.powerRestrictions}
                rollingStock={simulationResults.rollingStock}
                pathProperties={simulationResults.pathProperties}
                heightOfSpeedSpaceChartContainer={speedSpaceChartContainerHeight}
                setHeightOfSpeedSpaceChartContainer={setSpeedSpaceChartContainerHeight}
              />
            </div>
          </div>

          {/* SIMULATION : MAP */}
          <BoardWrapper hidden={!isMapDisplayed} name={t('boards.map')} withFooter>
            <div data-testid="simulation-map" className="simulation-map">
              <SimulationResultsMap
                geometry={simulationResults.pathProperties.geometry}
                setMapCanvas={setMapCanvas}
                pathfindingResult={simulationResults.path}
              />
            </div>
          </BoardWrapper>
        </>
      )}

      {/* TIME STOPS TABLE */}
      <BoardWrapper
        hidden={!activeBoards.has('tables')}
        name={t('simulationResults.timetableOutput')}
      >
        <div className="time-stop-outputs">
          <TimesStopsOutput
            infraId={infraId}
            selectedTrain={simulationResults?.train}
            {...(simulationResults?.isValid && simulationSummary?.isValid
              ? {
                  isValid: true,
                  simulatedTrain: simulationResults.simulation.final_output,
                  simulatedPath: simulationResults.path,
                  simulatedPathItemTimes: simulationSummary.pathItemTimes,
                  simulatedOperationalPoints: simulationResults.pathProperties.operationalPoints,
                }
              : { isValid: false })}
          />
        </div>

        {simulationResults?.isValid && (
          <div className="time-stop-outputs">
            {/* SIMULATION EXPORT BUTTONS */}
            <SimulationResultExport
              path={simulationResults.path}
              scenarioData={scenarioData}
              train={simulationResults.train}
              simulation={simulationResults.simulation}
              pathProperties={simulationResults.pathProperties}
              rollingStock={simulationResults.rollingStock}
              mapCanvas={mapCanvas}
            />
          </div>
        )}
      </BoardWrapper>
    </div>
  );
};

export default SimulationResults;
