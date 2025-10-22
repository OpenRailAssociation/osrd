import { useEffect, useState, useMemo } from 'react';

import { ChevronLeft, ChevronRight, Eye } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useEtcsBrakingCurves from 'applications/operationalStudies/hooks/useEtcsBrakingCurves';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import useSimulationResults from 'applications/operationalStudies/hooks/useSimulationResults';
import type { Board } from 'applications/operationalStudies/types';
import { type Conflict } from 'common/api/osrdEditoastApi';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';
import ResizableSection from 'common/ResizableSection';
import SpaceTimeChartWrapper, {
  MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
} from 'modules/simulationResult/components/SpaceTimeChartWrapper/SpaceTimeChartWrapper';
import useGetProjectedTrainOperationalPoints from 'modules/simulationResult/components/SpaceTimeChartWrapper/useGetProjectedTrainOperationalPoints';
import useProjectedConflicts from 'modules/simulationResult/components/SpaceTimeChartWrapper/useProjectedConflicts';
import useTrackOccupancy, {
  type OccupancyTrainSpaceTimeData,
} from 'modules/simulationResult/components/SpaceTimeChartWrapper/useTrackOccupancy';
import SpeedDistanceDiagramWrapper from 'modules/simulationResult/components/SpeedDistanceDiagram/SpeedDistanceDiagramWrapper';
import type { ProjectionData } from 'modules/simulationResult/types';
import TimesStopsOutput from 'modules/timesStops/TimesStopsOutput';
import { findExceptionWithOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import { toggleDisplayOnlyPathSteps, updateSelectedTrainId } from 'reducers/simulationResults';
import {
  getTrainIdUsedForProjection,
  getDisplayOnlyPathSteps,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  extractPacedTrainIdFromOccurrenceId,
  isPacedTrainWithDetails,
  isTrainScheduleId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import BoardWrapper from '../BoardWrapper';
import SimulationResultsExport from './SimulationResultsExport';
import SimulationResultsMap from './SimulationResultsMap';

export const HIDDEN_CHART_TOP_HEIGHT = 35;
const SDD_INITIAL_HEIGHT = 460;
const SDD_MIN_HEIGHT = 400;

type SimulationResultsProps = {
  scenarioData: { name: string; infraName: string };
  projectionData?: ProjectionData;
  timetableItemsWithDetails: TimetableItemWithDetails[];
  conflicts?: Conflict[];
  activeBoards: Set<Board>;
  updateTrainDepartureTime: (trainId: TimetableItemId, newDepartureTime: Date) => Promise<void>;
};

const SimulationResults = ({
  scenarioData,
  projectionData,
  timetableItemsWithDetails,
  conflicts = [],
  activeBoards,
  updateTrainDepartureTime,
}: SimulationResultsProps) => {
  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const { infraId, timetableId } = useScenarioContext();

  const simulationResults = useSimulationResults();
  const selectedTrainId = simulationResults?.train.id;

  const displayOnlyPathSteps = useSelector(getDisplayOnlyPathSteps);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const [showWarpedMap, setShowWarpedMap] = useState(false);

  const [waypointsPanelIsOpen, setWaypointsPanelIsOpen] = useState(false);

  const [manchetteWithSpaceTimeChartHeight, setManchetteWithSpaceTimeChartHeight] = useState(
    MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT
  );

  const [SDDHeight, setSDDHeight] = useState(SDD_INITIAL_HEIGHT);

  const [mapCanvas, setMapCanvas] = useState<string>();

  const [projectPathTrainResult, setProjectPathTrainResult] = useState<
    OccupancyTrainSpaceTimeData[]
  >([]);

  useEffect(() => {
    if (projectionData?.projectedTrains) {
      const timetableItemsById = mapBy(timetableItemsWithDetails, 'id');
      setProjectPathTrainResult(
        projectionData.projectedTrains.map((train) => {
          const timetableItem = timetableItemsById.get(train.id);
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
    path: projectionData?.path,
    infraId,
    timetableId,
    pathfinding: projectionData?.pathfinding,
    projectedOperationalPoints: projectionData?.operationalPoints,
  });

  const {
    toggleWaypoint,
    deployedWaypoints,
    updateTrackOccupanciesOnDrag: handleTrainDragInTrackOccupancy,
  } = useTrackOccupancy({
    infraId,
    pathOperationalPoints: filteredOperationalPoints,
    timetableItemProjections: projectPathTrainResult,
  });

  const conflictZones = useProjectedConflicts(infraId, conflicts, projectionData?.pathfinding);

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
    const draggedTimetatbleItemId = isTrainScheduleId(draggedTrainId)
      ? draggedTrainId
      : extractPacedTrainIdFromOccurrenceId(draggedTrainId);
    const draggedTrain = projectPathTrainResult.find(
      (train) => train.id === draggedTimetatbleItemId
    );
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
      await updateTrainDepartureTime(draggedTimetatbleItemId, newDepartureTime);

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
        projectPathTrainResult.map((train) =>
          train.id === draggedTimetatbleItemId ? newTrainData : train
        )
      );
    }
  };

  const { etcsBrakingCurves, fetchEtcsBrakingCurves } = useEtcsBrakingCurves(
    simulationResults?.rollingStock?.etcs_brake_params !== null,
    simulationResults?.isValid ? simulationResults.simulation : undefined
  );

  if (!simulationResults && !projectionData) {
    return null;
  }
  return (
    <div className="simulation-results" data-testid="simulation-results">
      {/* SIMULATION : SPACE TIME CHART */}
      {activeBoards.has('std') && projectionData && projectionData.projectedTrains.length > 0 && (
        <ResizableSection
          height={manchetteWithSpaceTimeChartHeight}
          setHeight={setManchetteWithSpaceTimeChartHeight}
          minHeight={MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT}
        >
          <BoardWrapper
            name={t('simulationResults.timeSpaceChart')}
            items={[
              {
                title: t('simulationResults.manchetteSettings.waypointsVisibility'),
                dataTestID: 'manchette-waypoints-visibility-button',
                icon: <Eye />,
                onClick: () => {
                  setWaypointsPanelIsOpen(true);
                },
              },
            ]}
          >
            <div className="std-container">
              <div
                className="simulation-warped-map d-flex flex-row align-items-stretch"
                style={{ height: manchetteWithSpaceTimeChartHeight - HIDDEN_CHART_TOP_HEIGHT }}
              >
                <button
                  data-testid="warped-map-button"
                  type="button"
                  className="show-warped-map-button"
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
              </div>
              <div className="osrd-simulation-container d-flex flex-grow-1 flex-shrink-1">
                {trainIdUsedForProjection && (
                  <SpaceTimeChartWrapper
                    operationalPoints={projectedOperationalPoints}
                    projectPathTrainResult={projectPathTrainResult}
                    selectedTrainId={selectedTrainId}
                    timetableItemsWithDetails={timetableItemsWithDetails}
                    waypointsPanelData={{
                      filteredWaypoints: filteredOperationalPoints,
                      setFilteredWaypoints: setFilteredOperationalPoints,
                      projectionPath: projectionData.path,
                      deployedWaypoints: new Set(
                        deployedWaypoints.map(({ waypointId }) => waypointId)
                      ),
                      toggleDeployedWaypoint: toggleWaypoint,
                      timetableId,
                    }}
                    trackOccupancyDiagramsData={deployedWaypoints}
                    onCloseOccupancyLayer={(waypointId: string) =>
                      toggleWaypoint(waypointId, false)
                    }
                    conflicts={conflictZones}
                    projectionLoaderData={projectionData.projectionLoaderData}
                    height={manchetteWithSpaceTimeChartHeight - HIDDEN_CHART_TOP_HEIGHT}
                    handleTrainDrag={handleTrainDrag}
                    onTrainClick={(trainId) => {
                      dispatch(updateSelectedTrainId(trainId));
                    }}
                    selectedProjectionId={trainIdUsedForProjection}
                    waypointsPanelIsOpen={waypointsPanelIsOpen}
                    setWaypointsPanelIsOpen={setWaypointsPanelIsOpen}
                  />
                )}
              </div>
            </div>
          </BoardWrapper>
        </ResizableSection>
      )}

      {simulationResults && (
        <>
          {simulationResults.isValid && (
            <>
              {/* SIMULATION : SPEED SPACE CHART */}
              {activeBoards.has('sdd') && (
                <ResizableSection
                  height={SDDHeight}
                  setHeight={setSDDHeight}
                  minHeight={SDD_MIN_HEIGHT}
                >
                  <BoardWrapper name={t('simulationResults.speedDistanceDiagram')}>
                    <div className="osrd-simulation-container">
                      <SpeedDistanceDiagramWrapper
                        timetableItemSimulation={simulationResults.simulation}
                        selectedTimetableItemPowerRestrictions={simulationResults.powerRestrictions}
                        rollingStock={simulationResults.rollingStock}
                        pathProperties={simulationResults.pathProperties}
                        height={SDDHeight - HIDDEN_CHART_TOP_HEIGHT}
                        setHeight={setSDDHeight}
                        fetchEtcsBrakingCurves={fetchEtcsBrakingCurves}
                        etcsBrakingCurves={etcsBrakingCurves}
                      />
                    </div>
                  </BoardWrapper>
                </ResizableSection>
              )}

              {/* SIMULATION : MAP */}
              <BoardWrapper hidden={!activeBoards.has('map')} name={t('boards.map')} withFooter>
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
            items={[
              {
                title: displayOnlyPathSteps
                  ? t('simulationResults.displayWaypoints')
                  : t('simulationResults.hideWaypoints'),
                icon: <Eye />,
                onClick: () => {
                  dispatch(toggleDisplayOnlyPathSteps());
                },
              },
            ]}
          >
            <div data-testid="time-stop-outputs" className="time-stop-outputs">
              <TimesStopsOutput
                infraId={infraId}
                selectedTrain={simulationResults?.train}
                {...(simulationResults?.isValid && simulationSummary?.isValid
                  ? {
                      isValid: true,
                      simulatedTrain: simulationResults.simulation.final_output,
                      simulatedPathItemTimes: simulationSummary.pathItemTimes,
                      operationalPointsOnPath: simulationResults.pathProperties.operationalPoints,
                    }
                  : { isValid: false })}
              />
            </div>

            {simulationResults?.isValid && (
              <div className="time-stop-outputs">
                {/* SIMULATION EXPORT BUTTONS */}
                <SimulationResultsExport
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
        </>
      )}
    </div>
  );
};

export default SimulationResults;
