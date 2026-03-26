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
import ChronogramWrapper from 'modules/simulationResult/components/Chronogram/ChronogramWrapper';
import createHandleTrainDrag from 'modules/simulationResult/components/SpaceTimeChartWrapper/helpers/createHandleTrainDrag';
import SpaceTimeChartWrapper, {
  MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
} from 'modules/simulationResult/components/SpaceTimeChartWrapper/SpaceTimeChartWrapper';
import useGetProjectedTrainOperationalPoints from 'modules/simulationResult/components/SpaceTimeChartWrapper/useGetProjectedTrainOperationalPoints';
import useHandleInvalidProjections from 'modules/simulationResult/components/SpaceTimeChartWrapper/useHandleInvalidProjections';
import useProjectedConflicts from 'modules/simulationResult/components/SpaceTimeChartWrapper/useProjectedConflicts';
import useTrackOccupancy from 'modules/simulationResult/components/SpaceTimeChartWrapper/useTrackOccupancy';
import SpeedDistanceDiagramWrapper from 'modules/simulationResult/components/SpeedDistanceDiagram/SpeedDistanceDiagramWrapper';
import type { ProjectionData, TrainSpaceTimeData } from 'modules/simulationResult/types';
import TimesStopsOutput from 'modules/timesStops/TimesStopsOutput';
import { findExceptionWithOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { toggleDisplayOnlyPathSteps, updateSelectedTrainId } from 'reducers/simulationResults';
import {
  getDisplayOnlyPathSteps,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { getUseNewTimesStopsTable } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

import BoardWrapper from '../BoardWrapper';
import SimulationResultsExport from './SimulationResultsExport';
import SimulationResultsMap from './SimulationResultsMap';

export const HIDDEN_CHART_TOP_HEIGHT = 23;
const SDD_INITIAL_HEIGHT = 460;
const SDD_MIN_HEIGHT = 400;
const CHRONOGRAM_INITIAL_HEIGHT = 492;
const CHRONOGRAM_MIN_HEIGHT = 398;

type SimulationResultsProps = {
  scenarioData: { name: string; infraName: string };
  projectionData: ProjectionData | undefined;
  timetableItemsWithDetails: TimetableItemWithDetails[];
  conflicts?: Conflict[];
  activeBoards: Set<Board>;
  updateTrainDepartureTime: (trainId: number, newDepartureTime: Date) => Promise<void>;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
};

const SimulationResults = ({
  scenarioData,
  projectionData,
  timetableItemsWithDetails,
  conflicts = [],
  activeBoards,
  updateTrainDepartureTime,
  upsertTimetableItems,
}: SimulationResultsProps) => {
  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const { infraId, timetableId } = useScenarioContext();
  const useNewTimesStopsTable = useSelector(getUseNewTimesStopsTable);

  const { results: simulationResults, isSimulationDataLoading } = useSimulationResults();
  const selectedTrainId = simulationResults?.train.id;

  const displayOnlyPathSteps = useSelector(getDisplayOnlyPathSteps);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const [showWarpedMap, setShowWarpedMap] = useState(false);

  const [waypointsPanelIsOpen, setWaypointsPanelIsOpen] = useState(false);

  const [manchetteWithSpaceTimeChartHeight, setManchetteWithSpaceTimeChartHeight] = useState(
    MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT
  );

  const [SDDHeight, setSDDHeight] = useState(SDD_INITIAL_HEIGHT);

  const [chronogramHeight, setChronogramHeight] = useState(CHRONOGRAM_INITIAL_HEIGHT);

  const [mapCanvas, setMapCanvas] = useState<string>();

  const [timetableItemProjections, setTimetableItemProjections] = useState<TrainSpaceTimeData[]>(
    []
  );

  useEffect(() => {
    setTimetableItemProjections(projectionData?.projectedTrains || []);
  }, [projectionData]);

  const enrichedProjections = useHandleInvalidProjections({
    timetableItemsWithDetails,
    projections: timetableItemProjections,
  });

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
    timetableId,
    pathOperationalPoints: filteredOperationalPoints,
    timetableItemProjections,
  });

  const conflictZones = useProjectedConflicts(infraId, conflicts, projectionData?.pathfinding);

  const simulationSummary = useMemo(() => {
    if (!selectedTrainId) return undefined;

    if (!isOccurrenceId(selectedTrainId)) {
      const selectedTrainScheduleId = extractEditoastIdFromPacedTrainId(selectedTrainId);
      return timetableItemsWithDetails.find(
        (timetableItem) => timetableItem.id === selectedTrainScheduleId
      )?.summary;
    }

    const selectedTrainScheduleId = extractEditoastIdFromPacedTrainId(
      extractPacedTrainIdFromOccurrenceId(selectedTrainId)
    );
    const pacedTrain = timetableItemsWithDetails.find(
      (timetableItem) => timetableItem.id === selectedTrainScheduleId
    );
    // WARNING TODO: race condition here, to fix
    // When turning a train into a service, then pacedTrain and selectedTrainId may be desynchronized.
    if (!pacedTrain || !pacedTrain.paced) return undefined;

    const exception = findExceptionWithOccurrenceId(pacedTrain.paced.exceptions, selectedTrainId);
    return exception?.summary ?? pacedTrain.summary;
  }, [timetableItemsWithDetails, selectedTrainId]);

  const handleTrainDrag = createHandleTrainDrag({
    timetableItemProjections,
    setTimetableItemProjections,
    handleTrainDragInTrackOccupancy,
    updateTrainDepartureTime,
  });

  const isEtcs = useMemo(
    () =>
      !!simulationResults?.rollingStock?.supported_signaling_systems.find(
        (s) => s.type === 'ETCS_LEVEL2'
      ),
    [simulationResults?.rollingStock?.supported_signaling_systems]
  );

  const { etcsBrakingCurves, fetchEtcsBrakingCurves } = useEtcsBrakingCurves(
    isEtcs,
    simulationResults?.isValid ? simulationResults.simulation : undefined
  );

  if (!simulationResults && !projectionData) {
    return null;
  }

  return (
    <div className="simulation-results" data-testid="simulation-results">
      {/* SIMULATION : SPACE TIME CHART */}
      {activeBoards.has('std') && (
        <BoardWrapper
          name={t('simulationResults.timeSpaceChart')}
          fullName={t('boardFullNames.std')}
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
          resizable={{
            height: manchetteWithSpaceTimeChartHeight,
            setHeight: setManchetteWithSpaceTimeChartHeight,
            minHeight: MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
          }}
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
              {projectionData?.geometry ? (
                <SimulationWarpedMap
                  collapsed={!showWarpedMap}
                  pathGeometry={projectionData?.geometry}
                />
              ) : (
                showWarpedMap && (
                  <div className="warped-map-unavailable-message">
                    <p>{t('simulationResults.warpedMapUnavailable')}</p>
                  </div>
                )
              )}
            </div>
            <div className="osrd-simulation-container d-flex flex-grow-1 flex-shrink-1">
              {trainIdUsedForProjection && projectionData && (
                <SpaceTimeChartWrapper
                  operationalPoints={projectedOperationalPoints}
                  timetableItemProjections={enrichedProjections}
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
                  onCloseOccupancyLayer={(waypointId: string) => toggleWaypoint(waypointId, false)}
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
                  pathfindingHasFailed={projectionData?.pathfindingStatus === 'failed'}
                />
              )}
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
                <BoardWrapper
                  name={t('simulationResults.speedDistanceDiagram')}
                  fullName={t('boardFullNames.sdd')}
                  resizable={{
                    height: SDDHeight,
                    setHeight: setSDDHeight,
                    minHeight: SDD_MIN_HEIGHT,
                  }}
                >
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
              )}
            </>
          )}

          {/* SIMULATION : MAP */}
          <BoardWrapper hidden={!activeBoards.has('map')} name={t('boards.map')} withFooter>
            <div data-testid="simulation-map" className="simulation-map">
              <SimulationResultsMap
                pathSteps={simulationResults.train.path}
                pathProperties={
                  simulationResults.isValid ? simulationResults.pathProperties : undefined
                }
                setMapCanvas={setMapCanvas}
              />
            </div>
          </BoardWrapper>

          {/* CHRONOGRAMME */}
          {timetableItemsWithDetails.length > 0 && (
            <BoardWrapper
              hidden={!activeBoards.has('chronogram')}
              name={t('boards.chronogram')}
              resizable={{
                height: chronogramHeight,
                setHeight: setChronogramHeight,
                minHeight: CHRONOGRAM_MIN_HEIGHT,
              }}
              withFooter
            >
              <div data-testid="chronogram" className="simulation-chronogram">
                <ChronogramWrapper
                  timetableItemsWithDetails={timetableItemsWithDetails}
                  chronogramHeight={chronogramHeight}
                />
              </div>
            </BoardWrapper>
          )}

          {/* TIME STOPS TABLE */}
          <BoardWrapper
            hidden={!activeBoards.has('tables')}
            name={simulationResults.train.train_name}
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
            customFooter={
              simulationResults?.isValid && (
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
              )
            }
            footerClass={useNewTimesStopsTable ? 'times-stops-table-footer' : undefined}
            withFooter
          >
            <div data-testid="time-stop-outputs" className="time-stop-outputs">
              <TimesStopsOutput
                infraId={infraId}
                selectedTrain={simulationResults?.train}
                timetableItemsWithDetails={timetableItemsWithDetails}
                upsertTimetableItems={upsertTimetableItems}
                isSimulationDataLoading={isSimulationDataLoading}
                operationalPointsOnPath={simulationResults.pathProperties?.operationalPoints}
                voltages={simulationResults.pathProperties?.voltages}
                rollingStock={simulationResults.rollingStock}
                {...(simulationResults?.isValid &&
                  simulationSummary?.isValid && {
                    isValid: true,
                    simulatedTrain: simulationResults.simulation.final_output,
                    simulatedPathItemTimes: simulationSummary.pathItemTimes,
                    simulatedPathItemRespect: simulationSummary.pathItemRespect,
                  })}
              />
            </div>
          </BoardWrapper>
        </>
      )}
    </div>
  );
};

export default SimulationResults;
