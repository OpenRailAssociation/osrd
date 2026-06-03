import { useMemo, useRef, useState, useCallback, useEffect } from 'react';

import {
  type Conflict,
  type HoveredItem,
  type SpaceTimeChartProps,
  useManchetteWithSpaceTimeChart,
  ZoomRect,
  ConflictLayer,
  PathLayer,
  SpaceTimeChart,
  WorkScheduleLayer,
  OccupancyBlockLayer,
  Manchette,
  type SplitPoint,
  isSegmentPickingElement,
  isPointPickingElement,
  isInteractiveWaypoint,
  type Track,
  type OccupancyZone,
} from '@osrd-project/ui-charts';
import { Slider } from '@osrd-project/ui-core';
import cx from 'classnames';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import upward from 'assets/pictures/workSchedules/ScheduledMaintenanceUp.svg';
import { type PostWorkSchedulesProjectPathApiResponse } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { configureHandlePan } from 'modules/simulationResult/components/SpaceTimeChartWrapper/helpers/configureHandlePan';
import getPathStyleV2 from 'modules/simulationResult/helpers/getPathStyleV2';
import type {
  CurveStyleExceptionType,
  CurveStyleInput,
  PathOperationalPoint,
  TrainSpaceTimeData,
  WaypointsPanelData,
  DraggingState,
} from 'modules/simulationResult/types';
import {
  findExceptionWithOccurrenceId,
  getFirstActiveOccurrenceId,
  isPacedTrainWithDetails,
} from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { OccurrenceId, TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrain } from 'reducers/simulationResults';
import {
  getHoveredTrainId,
  getIsSimulationEnabled,
  getSelectedTrain,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  isTrainId,
  isPacedTrainId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  extractPacedTrainIdFromTrainId,
  extractOccurrenceIndexFromOccurrenceId,
  extractExceptionIdFromOccurrenceId,
  isAddedExceptionId,
  extractEditoastIdFromPacedTrainId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import { buildSplitPoints } from './buildSplitPoints';
import CurveSelectionSidePanel, {
  PANEL_SELECTION_MODES,
  type PanelSelectionMode,
} from './CurveSelectionSidePanel';
import cutSpaceTimeCurves from './helpers/cutSpaceTimeCurves';
import formatSpaceTimeCurves from './helpers/formatSpaceTimeCurves';
import getPanelOccurrenceCounts from './helpers/getPanelOccurrenceCounts';
import getStdExceptionType from './helpers/getStdExceptionType';
import makeProjectedTrains from './helpers/makeProjectedTrains';
import { getOccupancyBlocks } from './helpers/utils';
import ProjectionLoadingMessage from './ProjectionLoadingMessage';
import SettingsPanel from './SettingsPanel';
import SpaceTimeChartToolbar from './SpaceTimeChartToolbar';
import useWaypointMenu from './useWaypointMenu';
import WaypointsPanel from './WaypointsPanel';

type SpaceTimeChartWrapperBaseProps = {
  operationalPoints: PathOperationalPoint[];
  trainScheduleProjections: TrainSpaceTimeData[];
  conflicts?: Conflict[];
  workSchedules?: PostWorkSchedulesProjectPathApiResponse;
  trackOccupancyDiagramsData?: {
    waypointId: string;
    operationalPointId: string;
    operationalPointPosition: number;
    operationalPointName?: string;
    zones?: OccupancyZone[];
    tracks?: Track[];
    loading?: boolean;
  }[];
  onCloseOccupancyLayer?: (waypointId: string) => void;
  projectionLoaderData: {
    totalTrains: number;
    allTrainsProjected: boolean;
  };
  handleTrainDrag?: ({
    draggedTrainId,
    newDepartureTime,
    initialDepartureTime,
    stopPanning,
  }: {
    draggedTrainId: TrainId;
    initialDepartureTime: Date;
    newDepartureTime: Date;
    stopPanning: boolean;
  }) => Promise<void>;
  height?: number;
  onTrainClick?: (trainId: TrainId) => void;
  selectedProjectionId: TrainId;
  trainSchedulesWithDetails?: TrainScheduleWithDetails[];
  pathfindingHasFailed?: boolean;
};

type SpaceTimeChartWrapperProps = SpaceTimeChartWrapperBaseProps &
  (
    | {
        waypointsPanelData: WaypointsPanelData;
        waypointsPanelIsOpen: boolean;
        setWaypointsPanelIsOpen: (waypointsModalOpen: boolean) => void;
      }
    | {
        waypointsPanelData?: undefined;
        waypointsPanelIsOpen?: undefined;
        setWaypointsPanelIsOpen?: undefined;
      }
  );

export const MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT = 561;

/**
 * Builds the hover input for the curve-style helper. Chart hover wins over
 * timetable hover: when the user is over a curve in the STD, the train list
 * hover is ignored.
 *
 * TODO: add the TOD source (`from: 'tod'`) once the TOD emits hover events.
 */
const buildCurveHover = (
  hoveredItem: HoveredItem | null,
  hoveredTrainIdFromTimetable: TrainId | undefined
): CurveStyleInput['hover'] => {
  if (
    hoveredItem &&
    (isSegmentPickingElement(hoveredItem.element) || isPointPickingElement(hoveredItem.element))
  ) {
    return { trainId: hoveredItem.element.pathId as TrainId, from: 'std' };
  }
  if (hoveredTrainIdFromTimetable) {
    return { trainId: hoveredTrainIdFromTimetable, from: 'timetable' };
  }
  return undefined;
};

const SpaceTimeChartWrapper = ({
  operationalPoints,
  trainScheduleProjections,
  waypointsPanelData,
  conflicts = [],
  workSchedules,
  trackOccupancyDiagramsData,
  onCloseOccupancyLayer,
  projectionLoaderData: { totalTrains, allTrainsProjected },
  height = MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
  handleTrainDrag,
  onTrainClick,
  selectedProjectionId,
  trainSchedulesWithDetails,
  waypointsPanelIsOpen,
  setWaypointsPanelIsOpen,
  pathfindingHasFailed = false,
}: SpaceTimeChartWrapperProps) => {
  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const hoveredTrainId = useSelector(getHoveredTrainId);
  const isSimulationEnabled = useSelector(getIsSimulationEnabled);
  const selection = useSelector(getSelectedTrain);
  const { id: selectedTrainId, by: selectedTrainBy } = selection ?? {};

  const wrapperRef = useRef<HTMLDivElement>(null);
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const activeWaypointRef = useRef<HTMLDivElement>(null);

  const [hoveredItem, setHoveredItem] = useState<null | HoveredItem>(null);
  const [draggingState, setDraggingState] = useState<DraggingState>();

  const [panelSelectionMode, setPanelSelectionMode] = useState<PanelSelectionMode>('compliant');
  const [lastClickedOccurrenceId, setLastClickedOccurrenceId] = useState<OccurrenceId>();

  const translations = { linearMode: t('main.linearMode') };

  const isTrainScheduleValid = useMemo(() => {
    const selectedTrainScheduleId = extractEditoastIdFromPacedTrainId(
      isOccurrenceId(selectedProjectionId)
        ? extractPacedTrainIdFromOccurrenceId(selectedProjectionId)
        : selectedProjectionId
    );

    const trainScheduleUsedForProjectionWithDetails = trainSchedulesWithDetails?.find(
      (trainSchedule) => trainSchedule.id === selectedTrainScheduleId
    );

    if (
      trainScheduleUsedForProjectionWithDetails &&
      isPacedTrainWithDetails(trainScheduleUsedForProjectionWithDetails) &&
      isOccurrenceId(selectedProjectionId)
    ) {
      const exceptionUsedForProjection =
        trainScheduleUsedForProjectionWithDetails.paced.exceptions.find((exception) =>
          isAddedExceptionId(selectedProjectionId)
            ? exception.id === extractExceptionIdFromOccurrenceId(selectedProjectionId)
            : exception.occurrence_index ===
              extractOccurrenceIndexFromOccurrenceId(selectedProjectionId)
        );
      if (exceptionUsedForProjection?.summary) return exceptionUsedForProjection.summary.isValid;
    }

    return trainScheduleUsedForProjectionWithDetails?.summary?.isValid ?? false;
  }, [trainSchedulesWithDetails, selectedProjectionId]);

  const spaceTimeChartRef = useRef<HTMLDivElement>(null);

  const subCategories = useSubCategoryContext();

  const [previousPanning, setPreviousPanning] = useState(false);

  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settings, setSettings] = useState({
    showConflicts: false,
    showSignalsStates: false,
  });

  const projectedTrains = useMemo(
    () => makeProjectedTrains(trainScheduleProjections),
    [trainScheduleProjections]
  );

  // Cut the spacetime chart curves if the first or last waypoints are hidden
  const { cutProjectedTrains, cutConflicts } = useMemo(
    () => cutSpaceTimeCurves(projectedTrains, conflicts, operationalPoints, waypointsPanelData),
    [waypointsPanelData?.filteredWaypoints, projectedTrains, conflicts, operationalPoints]
  );

  const trainSchedulesWithDetailsById = useMemo(
    () => mapBy(trainSchedulesWithDetails, 'id'),
    [trainSchedulesWithDetails]
  );

  const paths = useMemo(
    () => formatSpaceTimeCurves(subCategories, cutProjectedTrains, trainSchedulesWithDetailsById),
    [subCategories, cutProjectedTrains, trainSchedulesWithDetailsById]
  );

  const manchetteWaypoints = useMemo(() => {
    const rawWaypoints = waypointsPanelData?.filteredWaypoints ?? operationalPoints;
    return rawWaypoints.map((waypoint) => ({
      id: waypoint.waypointId,
      position: waypoint.position,
      name: waypoint.name,
      secondaryCode: waypoint.secondary_code,
      weight: waypoint.weight ?? 0,
    }));
  }, [waypointsPanelData, operationalPoints]);

  const { waypointMenu, activeWaypointId, handleWaypointClick } = useWaypointMenu(
    activeWaypointRef,
    waypointsPanelData
  );

  const hoveredTrainIdForChart = useMemo(() => {
    const element = hoveredItem?.element;
    if (element && 'pathId' in element) return element.pathId as TrainId;
    return hoveredTrainId;
  }, [hoveredItem, hoveredTrainId]);

  const splitPoints = useMemo<SplitPoint[]>(
    () =>
      buildSplitPoints(
        trackOccupancyDiagramsData,
        paths,
        hoveredItem,
        !!draggingState,
        activeWaypointRef,
        selectedTrainId,
        onCloseOccupancyLayer,
        handleWaypointClick,
        activeWaypointId,
        hoveredTrainIdForChart,
        hoveredTrainId
      ),
    [
      trackOccupancyDiagramsData,
      paths,
      hoveredItem,
      draggingState,
      subCategories,
      trainSchedulesWithDetails,
      selectedTrainId,
      onCloseOccupancyLayer,
      handleWaypointClick,
      activeWaypointRef,
      hoveredTrainIdForChart,
      hoveredTrainId,
    ]
  );

  const {
    manchetteProps,
    spaceTimeChartProps,
    rect,
    handleScroll,
    handleXZoom,
    xZoom,
    toggleZoomMode,
    zoomMode,
    setTimeOrigin,
  } = useManchetteWithSpaceTimeChart({
    waypoints: manchetteWaypoints,
    manchetteWithSpaceTimeChartRef,
    height,
    spaceTimeChartRef,
    splitPoints,
    defaultTimeOrigin: 0,
    defaultSpaceOrigin:
      (waypointsPanelData?.filteredWaypoints ?? operationalPoints).at(0)?.position || 0,
  });

  useEffect(() => {
    const trainId = isPacedTrainId(selectedProjectionId)
      ? formatPacedTrainIdToIndexedOccurrenceId(selectedProjectionId, 0)
      : selectedProjectionId;
    const trainUsedForProjection = projectedTrains.find((train) => train.id === trainId);
    if (trainUsedForProjection) {
      setTimeOrigin(+trainUsedForProjection.departureTime);
    } else {
      const minTime = Math.min(
        ...trainScheduleProjections
          .filter((train) => train.spaceTimeCurves.length > 0)
          .map((p) => +p.departureTime)
      );

      if (Number.isFinite(minTime)) {
        setTimeOrigin(minTime);
      }
    }
  }, [selectedProjectionId, trainScheduleProjections.length]);

  const occupancyBlocks = getOccupancyBlocks(cutProjectedTrains);

  const manchettePropsWithWaypointMenu = useMemo(
    () => ({
      ...manchetteProps,
      contents: manchetteProps.contents.map((content) =>
        isInteractiveWaypoint(content)
          ? {
              ...content,
              onClick: handleWaypointClick,
            }
          : content
      ),
      activeWaypointId,
      activeWaypointRef,
    }),
    [manchetteProps, activeWaypointId, handleWaypointClick]
  );

  const handlePan = useCallback(
    // TODO: fix this lint
    // eslint-disable-next-line react-hooks-js/use-memo
    configureHandlePan({
      spaceTimeChartOnPan: spaceTimeChartProps.onPan,
      handleTrainDrag,
      selectedTrainId,
      projectedTrains,
      draggingState,
      setDraggingState,
      hoveredItem,
      previousPanning,
      setPreviousPanning,
      zoomMode,
      trainScheduleProjections,
      dispatch,
    }),
    [
      spaceTimeChartProps.onPan,
      handleTrainDrag,
      draggingState,
      hoveredItem,
      previousPanning,
      zoomMode,
      trainScheduleProjections,
      dispatch,
    ]
  );

  const handleHoveredChildUpdate: SpaceTimeChartProps['onHoveredChildUpdate'] = useCallback(
    ({ item }: { item: HoveredItem | null }) => {
      setHoveredItem(item);
    },
    [setHoveredItem]
  );

  const selectedPacedTrainId = selectedTrainId
    ? extractPacedTrainIdFromTrainId(selectedTrainId)
    : undefined;

  const selectedTrain = selectedPacedTrainId
    ? trainSchedulesWithDetailsById.get(extractEditoastIdFromPacedTrainId(selectedPacedTrainId))
    : undefined;

  const panelExceptionType: CurveStyleExceptionType =
    selectedTrainBy === 'tod' ? 'path_and_schedule' : 'start_time';

  const panelCounts =
    selectedTrain && isPacedTrainWithDetails(selectedTrain) && selectedTrainBy !== 'timetable'
      ? getPanelOccurrenceCounts(selectedTrain.paced, panelExceptionType)
      : undefined;
  const showCurvePanel = !!panelCounts;

  const handlePanelModeChange = (mode: PanelSelectionMode) => {
    setPanelSelectionMode(mode);
    if (mode === 'single') {
      const singleId =
        lastClickedOccurrenceId ??
        (selectedTrain && isPacedTrainWithDetails(selectedTrain) && selectedPacedTrainId
          ? getFirstActiveOccurrenceId(selectedTrain, selectedPacedTrainId)
          : undefined);
      if (singleId) {
        dispatch(updateSelectedTrain({ id: singleId, by: 'std' }));
      }
      return;
    }
    if (selectedPacedTrainId) {
      dispatch(updateSelectedTrain({ id: selectedPacedTrainId, by: 'std' }));
    }
  };

  const handleClick: SpaceTimeChartProps['onClick'] = () => {
    if (
      !draggingState &&
      selectedTrainId &&
      (!hoveredItem ||
        (!isSegmentPickingElement(hoveredItem.element) &&
          !isPointPickingElement(hoveredItem.element)))
    ) {
      dispatch(updateSelectedTrain({ id: selectedTrainId, by: 'timetable' }));
      return;
    }
    if (
      onTrainClick &&
      !draggingState &&
      hoveredItem &&
      (isSegmentPickingElement(hoveredItem.element) || isPointPickingElement(hoveredItem.element))
    ) {
      const clickedTrainId = hoveredItem.element.pathId;
      if (
        isTrainId(clickedTrainId) &&
        (selectedTrainId !== clickedTrainId || selectedTrainBy !== 'std')
      ) {
        if (isOccurrenceId(clickedTrainId)) {
          setLastClickedOccurrenceId(clickedTrainId);
          const trainScheduleId = extractEditoastIdFromPacedTrainId(
            extractPacedTrainIdFromOccurrenceId(clickedTrainId)
          );
          const trainSchedule = trainSchedulesWithDetailsById.get(trainScheduleId);
          const exception =
            trainSchedule && isPacedTrainWithDetails(trainSchedule)
              ? findExceptionWithOccurrenceId(trainSchedule.paced.exceptions, clickedTrainId)
              : undefined;
          setPanelSelectionMode(exception?.start_time ? 'single' : 'compliant');
        }
        onTrainClick(clickedTrainId);
      }
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.code === 'KeyS') {
      if (!selectedPacedTrainId) return;
      e.preventDefault();
      const currentIndex = PANEL_SELECTION_MODES.indexOf(panelSelectionMode);
      const nextMode = PANEL_SELECTION_MODES[(currentIndex + 1) % PANEL_SELECTION_MODES.length];
      handlePanelModeChange(nextMode);
      return;
    }
    if (e.key === 'Escape' && selectedTrainId && selectedTrainBy !== 'timetable') {
      e.preventDefault();
      dispatch(updateSelectedTrain({ id: selectedTrainId, by: 'timetable' }));
      if (showCurvePanel) setPanelSelectionMode('compliant');
    }
  };

  const handleCloseSettingsPanel = () => {
    setShowSettingsPanel(false);
    wrapperRef.current?.focus();
  };

  const handleSetWaypointsPanelIsOpen = (open: boolean) => {
    setWaypointsPanelIsOpen?.(open);
    if (!open) wrapperRef.current?.focus();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      data-testid="manchette-space-time-chart"
      className="ui-manchette-space-time-chart-wrapper"
      ref={wrapperRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {waypointsPanelData &&
        waypointsPanelIsOpen &&
        createPortal(
          <WaypointsPanel
            waypointsPanelIsOpen={waypointsPanelIsOpen}
            setWaypointsPanelIsOpen={handleSetWaypointsPanelIsOpen}
            waypoints={operationalPoints}
            waypointsPanelData={waypointsPanelData}
            hideOffsets={pathfindingHasFailed}
          />,
          document.body
        )}
      {!allTrainsProjected && (
        <ProjectionLoadingMessage
          projectedTrainsNb={trainScheduleProjections.length}
          totalTrains={totalTrains}
        />
      )}
      <div
        data-testid="manchette-spacetimediagram-ref"
        ref={manchetteWithSpaceTimeChartRef}
        className="manchette flex"
        style={{ height }}
        onScroll={handleScroll}
      >
        <Manchette
          {...manchettePropsWithWaypointMenu}
          hidePositions={pathfindingHasFailed}
          translations={translations}
        />
        {waypointMenu}
        <div
          ref={spaceTimeChartRef}
          data-testid="space-time-chart-container"
          className="space-time-chart-container"
        >
          <SpaceTimeChartToolbar
            xZoom={xZoom}
            handleXZoom={handleXZoom}
            zoomMode={zoomMode}
            disableZoom={!!waypointsPanelData?.deployedWaypoints?.size}
            toggleZoomMode={toggleZoomMode}
            setShowSettingsPanel={setShowSettingsPanel}
          />
          {showSettingsPanel && (
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              onClose={handleCloseSettingsPanel}
              isTrainScheduleValid={isTrainScheduleValid}
            />
          )}

          <SpaceTimeChart
            className={cx('inset-0 absolute h-full', {
              'without-train-simulation-mode': !isSimulationEnabled,
            })}
            height={height}
            {...spaceTimeChartProps}
            onPan={handlePan}
            onClick={handleClick}
            onHoveredChildUpdate={handleHoveredChildUpdate}
            spaceOrigin={
              (waypointsPanelData?.filteredWaypoints ?? operationalPoints).at(0)?.position || 0
            }
          >
            {paths.map((path) => {
              const hover = buildCurveHover(hoveredItem, hoveredTrainId);
              const trainId = path.id as TrainId;
              const style = getPathStyleV2(
                {
                  chart: 'std',
                  train: {
                    id: trainId,
                    isDragging: draggingState?.draggedTrain.id === trainId,
                    exceptionType: getStdExceptionType(trainSchedulesWithDetailsById, trainId),
                  },
                  selection,
                  panelMode: panelSelectionMode,
                  hover,
                },
                { colors: path.colors, isSimulated: path.isSimulated }
              );
              return (
                <PathLayer
                  key={`${path.id}-${path.points[0]?.position}`}
                  path={path}
                  color={style.color}
                  level={style.level}
                  border={style.outline}
                  label={style.label}
                />
              );
            })}
            {rect && <ZoomRect {...rect} />}
            {workSchedules && (
              <WorkScheduleLayer
                workSchedules={workSchedules.map((ws) => ({
                  type: ws.type,
                  timeStart: new Date(ws.start_date_time),
                  timeEnd: new Date(ws.end_date_time),
                  spaceRanges: ws.path_position_ranges.map(({ start, end }) => [start, end]),
                }))}
                imageUrl={upward}
              />
            )}
            {isSimulationEnabled && (
              <>
                {settings.showConflicts && <ConflictLayer conflicts={cutConflicts} />}
                {settings.showSignalsStates && (
                  <OccupancyBlockLayer occupancyBlocks={occupancyBlocks} />
                )}
              </>
            )}
          </SpaceTimeChart>
          {showCurvePanel && (
            <CurveSelectionSidePanel
              position={height / 2}
              panelSelectionMode={panelSelectionMode}
              onModeChange={handlePanelModeChange}
              counts={panelCounts}
            />
          )}
        </div>
      </div>
      <Slider
        containerClassName="space-time-h-slider-container"
        className="space-time-h-slider"
        width={122}
        value={xZoom}
        onChange={(e) => {
          handleXZoom(Number(e.target.value));
        }}
      />
    </div>
    /* TODO use margin or absolute to align with handle */
  );
};

export default SpaceTimeChartWrapper;
