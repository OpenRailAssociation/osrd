import { useEffect, useState, useMemo, useRef } from 'react';

import { ChevronLeft, ChevronRight, Eye } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useEtcsBrakingCurves from 'applications/operationalStudies/hooks/useEtcsBrakingCurves';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import useSimulationResults from 'applications/operationalStudies/hooks/useSimulationResults';
import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import type { Board } from 'applications/operationalStudies/types';
import { type Conflict } from 'common/api/osrdEditoastApi';
import SimulationWarpedMap from 'common/Map/WarpedMap/SimulationWarpedMap';
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
import TimeStopsTableWrapper from 'modules/timesStops/TimeStopsTableWrapper';
import TrainHeader from 'modules/trainHeader/TrainHeader';
import { findExceptionWithOccurrenceId } from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { TrainScheduleToEditData } from 'reducers/osrdconf/types';
import { toggleDisplayOnlyPathSteps } from 'reducers/simulationResults';
import {
  getDisplayOnlyPathSteps,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  extractEditoastIdFromTrainScheduleId,
  extractTrainScheduleIdFromOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

import useOccupancyZoneDrop from '../../hooks/useOccupancyZoneDrop';
import BoardWrapper from '../BoardWrapper';
import SimulationResultsExport from './SimulationResultsExport';
import SimulationResultsMap from './SimulationResultsMap';

// TODO: SimulationResults should be dropped and boards embedded directly inside ScenarioContent (see comments in #17091)
export const HIDDEN_CHART_TOP_HEIGHT = 23;
const SDD_INITIAL_HEIGHT = 460;
const SDD_MIN_HEIGHT = 400;

const NO_CONFLICTS: Conflict[] = [];

type SimulationResultsProps = {
  scenarioData: { name: string; infraName: string };
  projectionData: ProjectionData | undefined;
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  conflicts?: Conflict[];
  activeBoards: Set<Board>;
  setDisplayTrainScheduleManagement: (type: string) => void;
  setTrainScheduleToEditData: (trainScheduleToEditData?: TrainScheduleToEditData) => void;
  isScrollingToTimeStopsTable: boolean;
  setIsScrollingToTimeStopsTable: React.Dispatch<React.SetStateAction<boolean>>;
};

const SimulationResults = ({
  scenarioData,
  projectionData,
  trainSchedulesWithDetails,
  conflicts = NO_CONFLICTS,
  activeBoards,
  setTrainScheduleToEditData,
  setDisplayTrainScheduleManagement,
  isScrollingToTimeStopsTable,
  setIsScrollingToTimeStopsTable,
}: SimulationResultsProps) => {
  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const { infraId, timetableId } = useScenarioContext();
  const { upsertTrainSchedules, updateTrainScheduleDepartureTime } = useTimetableContext();

  const { results: simulationResults, isSimulationDataLoading } = useSimulationResults();
  const selectedTrainId = simulationResults?.train.id;

  const timeStopsTableRef = useRef<HTMLDivElement>(null);

  const displayOnlyPathSteps = useSelector(getDisplayOnlyPathSteps);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  const [showWarpedMap, setShowWarpedMap] = useState(false);

  const [waypointsPanelIsOpen, setWaypointsPanelIsOpen] = useState(false);

  const [manchetteWithSpaceTimeChartHeight, setManchetteWithSpaceTimeChartHeight] = useState(
    MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT
  );

  const sddData = simulationResults?.isValid
    ? {
        trainScheduleSimulation: simulationResults.simulation,
        powerRestrictions: simulationResults.powerRestrictions,
        rollingStock: simulationResults.rollingStock,
        pathProperties: simulationResults.pathProperties,
      }
    : undefined;

  const [SDDHeight, setSDDHeight] = useState(SDD_INITIAL_HEIGHT);

  const [mapCanvas, setMapCanvas] = useState<string>();

  const [trainScheduleProjections, setTrainScheduleProjections] = useState<TrainSpaceTimeData[]>(
    []
  );

  useEffect(() => {
    setTrainScheduleProjections(projectionData?.projectedTrains || []);
  }, [projectionData?.projectedTrains]);

  useEffect(() => {
    if (simulationResults?.pathProperties && isScrollingToTimeStopsTable) {
      timeStopsTableRef.current?.scrollIntoView();
      setIsScrollingToTimeStopsTable(false);
    }
  }, [simulationResults?.pathProperties, isScrollingToTimeStopsTable]);

  const enrichedProjections = useHandleInvalidProjections({
    trainSchedulesWithDetails,
    projections: trainScheduleProjections,
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
    trainScheduleProjections,
  });

  const conflictZones = useProjectedConflicts(infraId, conflicts, projectionData?.pathfinding);

  const simulationSummary = useMemo(() => {
    if (!selectedTrainId) return undefined;

    if (!isOccurrenceId(selectedTrainId)) {
      const selectedTrainScheduleId = extractEditoastIdFromTrainScheduleId(selectedTrainId);
      return trainSchedulesWithDetails.find(
        (trainSchedule) => trainSchedule.id === selectedTrainScheduleId
      )?.summary;
    }

    const selectedTrainScheduleId = extractEditoastIdFromTrainScheduleId(
      extractTrainScheduleIdFromOccurrenceId(selectedTrainId)
    );
    const trainSchedule = trainSchedulesWithDetails.find(
      (train) => train.id === selectedTrainScheduleId
    );
    // WARNING TODO: race condition here, to fix
    // When turning a train into a service, then trainSchedule and selectedTrainId may be desynchronized.
    if (!trainSchedule || !trainSchedule.paced) return undefined;

    const exception = findExceptionWithOccurrenceId(
      trainSchedule.paced.exceptions,
      selectedTrainId
    );
    return exception?.summary ?? trainSchedule.summary;
  }, [trainSchedulesWithDetails, selectedTrainId]);

  const handleTrainDrag = createHandleTrainDrag({
    trainScheduleProjections,
    setTrainScheduleProjections,
    handleTrainDragInTrackOccupancy,
    updateTrainScheduleDepartureTime,
  });

  const handleOccupancyZoneDrop = useOccupancyZoneDrop({
    trainSchedulesWithDetails,
    pathOperationalPoints: filteredOperationalPoints,
    deployedWaypoints,
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

  const prevSddDataRef = useRef(sddData);
  // We need to reset the SDD height when SDD data goes from undefined to defined in order to keep a consistent size.
  useEffect(() => {
    if (!prevSddDataRef.current && sddData) {
      setSDDHeight(SDD_INITIAL_HEIGHT);
    }
    prevSddDataRef.current = sddData;
  }, [sddData]);

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
                  trainScheduleProjections={enrichedProjections}
                  trainSchedulesWithDetails={trainSchedulesWithDetails}
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
                  onOccupancyZoneDrop={handleOccupancyZoneDrop}
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

      {/* TIME STOPS TABLE */}
      {simulationResults && (
        <BoardWrapper
          ref={timeStopsTableRef}
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
          customHeader={
            <TrainHeader
              train={simulationResults.train}
              path={simulationResults.path}
              trainSchedulesWithDetails={trainSchedulesWithDetails}
              upsertTrainSchedules={upsertTrainSchedules}
              setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
              setTrainScheduleToEditData={setTrainScheduleToEditData}
            />
          }
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
          footerClass={'times-stops-table-footer'}
          withFooter
        >
          <div data-testid="time-stop-outputs" className="time-stop-outputs">
            <TimeStopsTableWrapper
              infraId={infraId}
              selectedTrain={simulationResults?.train}
              trainSchedulesWithDetails={trainSchedulesWithDetails}
              upsertTrainSchedules={upsertTrainSchedules}
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
      )}

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
              trainScheduleSimulation={sddData?.trainScheduleSimulation}
              selectedTrainSchedulePowerRestrictions={sddData?.powerRestrictions}
              rollingStock={sddData?.rollingStock}
              pathProperties={sddData?.pathProperties}
              height={SDDHeight - HIDDEN_CHART_TOP_HEIGHT}
              setHeight={setSDDHeight}
              fetchEtcsBrakingCurves={fetchEtcsBrakingCurves}
              etcsBrakingCurves={etcsBrakingCurves}
              isSimulationInvalid={simulationResults !== undefined && !simulationResults.isValid}
            />
          </div>
        </BoardWrapper>
      )}

      {/* SIMULATION : MAP */}
      <BoardWrapper hidden={!activeBoards.has('map')} name={t('boards.map')} withFooter>
        <div data-testid="simulation-map" className="simulation-map">
          <SimulationResultsMap
            pathSteps={simulationResults?.train.path}
            pathProperties={
              simulationResults?.isValid ? simulationResults.pathProperties : undefined
            }
            pathfindingResults={simulationResults?.isValid ? simulationResults.path : undefined}
            setMapCanvas={setMapCanvas}
          />
        </div>
      </BoardWrapper>
    </div>
  );
};

export default SimulationResults;
