import { useEffect, useState, useMemo } from 'react';

import { ChevronLeft, ChevronRight, Eye } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { type Conflict } from 'common/api/osrdEditoastApi';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';
import ResizableSection from 'common/ResizableSection';
import SimulationResultsMap from 'modules/simulationResult/components/SimulationResultsMap';
import SpaceTimeChartWrapper, {
  MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
} from 'modules/simulationResult/components/SpaceTimeChartWrapper/SpaceTimeChartWrapper';
import useGetProjectedTrainOperationalPoints from 'modules/simulationResult/components/SpaceTimeChartWrapper/useGetProjectedTrainOperationalPoints';
import useProjectedConflicts from 'modules/simulationResult/components/SpaceTimeChartWrapper/useProjectedConflicts';
import useTrackOccupancy, {
  type OccupancyTrainSpaceTimeData,
} from 'modules/simulationResult/components/SpaceTimeChartWrapper/useTrackOccupancy';
import SpeedDistanceDiagramWrapper from 'modules/simulationResult/components/SpeedDistanceDiagram/SpeedDistanceDiagramWrapper';
import SimulationResultExport from 'modules/simulationResult/SimulationResultExport/SimulationResultsExport';
import type { ProjectionData } from 'modules/simulationResult/types';
import TimesStopsOutput from 'modules/timesStops/TimesStopsOutput';
import { findExceptionWithOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import { getOperationalStudiesTimetableID } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  extractPacedTrainIdFromOccurrenceId,
  isPacedTrainWithDetails,
  isTrainScheduleId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import BoardWrapper from './BoardWrapper';
import { useScenarioContext } from '../../../hooks/useScenarioContext';
import useSimulationResults from '../../../hooks/useSimulationResults';
import type { Board } from '../../../types';

const HIDDEN_CHART_TOP_HEIGHT = 35;
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
  const { infraId } = useScenarioContext();

  const timetableId = useSelector(getOperationalStudiesTimetableID);

  const simulationResults = useSimulationResults(infraId);
  const selectedTrainId = simulationResults?.train.id;

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

  if (!simulationResults && !projectionData) {
    return null;
  }
  return (
    <div className="simulation-results">
      {/* SIMULATION : SPACE TIME CHART */}
      {projectionData && (
        <BoardWrapper
          name={t('simulationResults.timeSpaceChart')}
          items={[
            {
              title: t('simulationResults.manchetteSettings.waypointsVisibility'),
              icon: <Eye />,
              onClick: () => {
                setWaypointsPanelIsOpen(true);
              },
            },
          ]}
          hidden={!activeBoards.has('std') || projectionData.projectedTrains.length === 0}
          resizable
          height={manchetteWithSpaceTimeChartHeight}
          setHeight={setManchetteWithSpaceTimeChartHeight}
          minHeight={MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT}
        >
          <div className="std-container">
            <div
              className="simulation-warped-map d-flex flex-row align-items-stretch"
              style={{ height: manchetteWithSpaceTimeChartHeight - HIDDEN_CHART_TOP_HEIGHT }}
            >
              <button
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
              <div className="chart-container">
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
          </div>
        </BoardWrapper>
      )}

      {simulationResults && (
        <>
          {simulationResults.isValid && (
            <>
              {/* SIMULATION : SPEED SPACE CHART */}
              {activeBoards.has('sdd') && (
                <div className="speed-distance-diagram-section">
                  <ResizableSection
                    height={SDDHeight}
                    setHeight={setSDDHeight}
                    minHeight={SDD_MIN_HEIGHT}
                  >
                    <BoardWrapper name={t('simulationResults.speedDistanceDiagram')}>
                      <div className="osrd-simulation-container">
                        <div className="chart-container">
                          <SpeedDistanceDiagramWrapper
                            timetableItemSimulation={simulationResults.simulation}
                            selectedTimetableItemPowerRestrictions={
                              simulationResults.powerRestrictions
                            }
                            rollingStock={simulationResults.rollingStock}
                            pathProperties={simulationResults.pathProperties}
                            height={SDDHeight}
                            setHeight={setSDDHeight}
                          />
                        </div>
                      </div>
                    </BoardWrapper>
                  </ResizableSection>
                </div>
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
          >
            <div className="time-stop-outputs">
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
        </>
      )}
    </div>
  );
};

export default SimulationResults;
