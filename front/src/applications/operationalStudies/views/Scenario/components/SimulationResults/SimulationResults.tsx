import { useEffect, useState, useMemo, useRef } from 'react';

import { ChevronLeft, ChevronRight, Eye } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useEtcsBrakingCurves from 'applications/operationalStudies/hooks/useEtcsBrakingCurves';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import useSimulationResults from 'applications/operationalStudies/hooks/useSimulationResults';
import type { Board } from 'applications/operationalStudies/types';
import { type Conflict, type TrainScheduleResponse } from 'common/api/osrdEditoastApi';
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
import TimeStopsTableWrapper from 'modules/timesStops/TimeStopsTableWrapper';
import TrainHeader from 'modules/trainHeader/TrainHeader';
import { findExceptionWithOccurrenceId } from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { toggleDisplayOnlyPathSteps, updateSelectedTrain } from 'reducers/simulationResults';
import {
  getDisplayOnlyPathSteps,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
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
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  trainSchedules: TrainScheduleResponse[];
  conflicts?: Conflict[];
  activeBoards: Set<Board>;
  updateTrainScheduleDepartureTime: (trainId: number, newDepartureTime: Date) => Promise<void>;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
};

const SimulationResults = ({
  scenarioData,
  projectionData,
  trainSchedulesWithDetails,
  trainSchedules,
  conflicts = [],
  activeBoards,
  updateTrainScheduleDepartureTime,
  upsertTrainSchedules,
}: SimulationResultsProps) => {
  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const { infraId, timetableId } = useScenarioContext();

  const { results: simulationResults, isSimulationDataLoading } =
    useSimulationResults(trainSchedules);
  const selectedTrainId = simulationResults?.train.id;

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

  const [chronogramHeight, setChronogramHeight] = useState(CHRONOGRAM_INITIAL_HEIGHT);

  const [mapCanvas, setMapCanvas] = useState<string>();

  const [trainScheduleProjections, setTrainScheduleProjections] = useState<TrainSpaceTimeData[]>(
    []
  );

  useEffect(() => {
    setTrainScheduleProjections(projectionData?.projectedTrains || []);
  }, [projectionData]);

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
      const selectedTrainScheduleId = extractEditoastIdFromPacedTrainId(selectedTrainId);
      return trainSchedulesWithDetails.find(
        (trainSchedule) => trainSchedule.id === selectedTrainScheduleId
      )?.summary;
    }

    const selectedTrainScheduleId = extractEditoastIdFromPacedTrainId(
      extractPacedTrainIdFromOccurrenceId(selectedTrainId)
    );
    const pacedTrain = trainSchedulesWithDetails.find(
      (trainSchedule) => trainSchedule.id === selectedTrainScheduleId
    );
    // WARNING TODO: race condition here, to fix
    // When turning a train into a service, then pacedTrain and selectedTrainId may be desynchronized.
    if (!pacedTrain || !pacedTrain.paced) return undefined;

    const exception = findExceptionWithOccurrenceId(pacedTrain.paced.exceptions, selectedTrainId);
    return exception?.summary ?? pacedTrain.summary;
  }, [trainSchedulesWithDetails, selectedTrainId]);

  const handleTrainDrag = createHandleTrainDrag({
    trainScheduleProjections,
    setTrainScheduleProjections,
    handleTrainDragInTrackOccupancy,
    updateTrainScheduleDepartureTime,
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
    simulationResults?.isValid ? simulationResults.simulation : undefined,
    trainSchedules
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
                  onTrainClick={(trainId) => {
                    dispatch(updateSelectedTrain({ id: trainId, by: 'std' }));
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
            setMapCanvas={setMapCanvas}
          />
        </div>
      </BoardWrapper>

      {simulationResults && (
        <>
          {/* CHRONOGRAMME */}
          {trainSchedulesWithDetails.length > 0 && (
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
                  timetableId={timetableId}
                  trainSchedulesWithDetails={trainSchedulesWithDetails}
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
            customHeader={
              <TrainHeader
                train={simulationResults.train}
                trainSchedulesWithDetails={trainSchedulesWithDetails}
                upsertTrainSchedules={upsertTrainSchedules}
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
        </>
      )}
    </div>
  );
};

export default SimulationResults;
