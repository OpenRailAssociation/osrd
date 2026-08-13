import { useMemo, useRef, useState, useCallback, useEffect } from 'react';

import {
  type Conflict,
  type HoveredItem,
  type SpaceTimeChartProps,
  useManchetteWithSpaceTimeChart,
  useEdgePan,
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
  isOccupancyPickingElement,
  isLinkingPickingElement,
  type Track,
  DEFAULT_ZOOM_MS_PER_PX,
  timeScaleToZoomValue,
} from '@osrd-project/ui-charts';
import { Slider } from '@osrd-project/ui-core';
import cx from 'classnames';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useScenario from 'applications/operationalStudies/hooks/useScenario';
import upward from 'assets/pictures/workSchedules/ScheduledMaintenanceUp.svg';
import { type PostWorkSchedulesProjectPathApiResponse } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { configureHandlePan } from 'modules/simulationResult/components/SpaceTimeChartWrapper/helpers/configureHandlePan';
import getPathStyleV2 from 'modules/simulationResult/helpers/getPathStyleV2';
import type {
  CurveStyleExceptionType,
  CurveStyleInput,
  ProjectionWaypoint,
  TrainSpaceTimeData,
  WaypointsPanelData,
  DraggingState,
} from 'modules/simulationResult/types';
import {
  findTrainScheduleAndException,
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
import type { SelectionSource } from 'reducers/simulationResults/types';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';
import {
  extractEditoastIdFromTrainScheduleId,
  extractExceptionIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  extractTrainScheduleIdFromOccurrenceId,
  extractTrainScheduleIdFromTrainId,
  formatTrainScheduleIdToIndexedOccurrenceId,
  isAddedExceptionId,
  isOccurrenceId,
  isTrainScheduleId,
  isTrainId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import { buildSplitPoints } from './buildSplitPoints';
import CurveSelectionSidePanel, {
  PANEL_SELECTION_MODES,
  type PanelSelectionMode,
} from './CurveSelectionSidePanel';
import canDragHoveredTrain from './helpers/canDragHoveredTrain';
import cutSpaceTimeCurves from './helpers/cutSpaceTimeCurves';
import formatSpaceTimeCurves from './helpers/formatSpaceTimeCurves';
import getPanelOccurrenceCounts from './helpers/getPanelOccurrenceCounts';
import getTrainExceptionTypes from './helpers/getTrainExceptionTypes';
import type { ExistingLinking } from './helpers/linkings';
import makeProjectedTrains from './helpers/makeProjectedTrains';
import { getOccupancyBlocks } from './helpers/utils';
import {
  parseOccupancyZonePathId,
  formatOccupancyZonePathId,
  type MovableOccupancyZone,
  type DeployedWaypoint,
  type OccupancyZoneReference,
} from './helpers/zones';
import ProjectionLoadingMessage from './ProjectionLoadingMessage';
import SettingsPanel from './SettingsPanel';
import SpaceTimeChartToolbar from './SpaceTimeChartToolbar';
import TimeRangeObserver from './TimeRangeObserver';
import useLinkingMode from './useLinkingMode';
import useWaypointMenu from './useWaypointMenu';
import WaypointsPanel from './WaypointsPanel';

type SpaceTimeChartWrapperBaseProps = {
  operationalPoints: ProjectionWaypoint[];
  trainScheduleProjections: TrainSpaceTimeData[];
  conflicts?: Conflict[];
  workSchedules?: PostWorkSchedulesProjectPathApiResponse;
  trackOccupancyDiagramsData?: DeployedWaypoint[];
  linkings?: ExistingLinking[];
  onCreateLinking?: (source: TrainId, target: TrainId) => void;
  onDeleteLinking?: (linkingId: number) => void;
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
    panelSelectionMode,
  }: {
    draggedTrainId: TrainId;
    initialDepartureTime: Date;
    newDepartureTime: Date;
    stopPanning: boolean;
    panelSelectionMode: PanelSelectionMode;
  }) => Promise<void>;
  height?: number;
  onOccupancyZoneDrop?: (
    waypointId: string,
    trainId: TrainId,
    zone: MovableOccupancyZone,
    track: Track
  ) => void;
  selectedProjectionId: TrainId;
  trainSchedulesWithDetails?: TrainScheduleWithDetails[];
  pathfindingHasFailed?: boolean;
  /**
   * Duration of the hourly timetable pattern; when set, the time axis renders
   * in hourly pattern mode (signed integer hours around 0). `undefined` for
   * calendar scenarios.
   */
  hourlyTimetableDuration?: Duration;
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
const NO_CONFLICTS: Conflict[] = [];

/**
 * Builds the hover input for the curve-style helper: the hovered train, the
 * chart it is hovered from (STD wins over TOD, which wins over the train
 * list hover) and its exception types.
 */
const buildCurveStyleHover = (
  hoveredItem: HoveredItem | null,
  hoveredTrainIdFromTimetable: TrainId | undefined,
  trainSchedulesWithDetailsById: Map<number, TrainScheduleWithDetails>
): CurveStyleInput['hover'] => {
  let trainId: TrainId | undefined;
  let from: SelectionSource | undefined;

  if (
    hoveredItem &&
    (isSegmentPickingElement(hoveredItem.element) || isPointPickingElement(hoveredItem.element))
  ) {
    trainId = hoveredItem.element.pathId as TrainId;
    from = 'std';
  } else if (hoveredItem && isOccupancyPickingElement(hoveredItem.element)) {
    ({ trainId } = parseOccupancyZonePathId(hoveredItem.element.pathId));
    from = 'tod';
  } else if (hoveredTrainIdFromTimetable) {
    trainId = hoveredTrainIdFromTimetable;
    from = 'timetable';
  }

  if (!trainId || !from) return undefined;
  return {
    trainId,
    from,
    relevantExceptionTypes: getTrainExceptionTypes(trainSchedulesWithDetailsById, trainId),
  };
};
function formatDragOffset(ms: number): string {
  const sign = ms >= 0 ? '+' : '-';
  const minutes = Math.round(Math.abs(ms) / 60_000);
  return `${sign} ${minutes} min`;
}

const SpaceTimeChartWrapper = ({
  operationalPoints,
  trainScheduleProjections,
  waypointsPanelData,
  conflicts = NO_CONFLICTS,
  workSchedules,
  trackOccupancyDiagramsData,
  linkings,
  onCreateLinking,
  onDeleteLinking,
  onCloseOccupancyLayer,
  projectionLoaderData: { totalTrains, allTrainsProjected },
  height = MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
  handleTrainDrag,
  onOccupancyZoneDrop,
  selectedProjectionId,
  trainSchedulesWithDetails,
  waypointsPanelIsOpen,
  setWaypointsPanelIsOpen,
  pathfindingHasFailed = false,
  hourlyTimetableDuration,
}: SpaceTimeChartWrapperProps) => {
  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const hoveredTrainId = useSelector(getHoveredTrainId);
  const isSimulationEnabled = useSelector(getIsSimulationEnabled);
  const { scenario: { timetable_type: timetableType } = {} } = useScenario();
  const selection = useSelector(getSelectedTrain);
  const { id: selectedTrainId, by: selectedTrainBy } = selection ?? {};

  const wrapperRef = useRef<HTMLDivElement>(null);
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const activeWaypointRef = useRef<HTMLDivElement>(null);

  const [hoveredItem, setHoveredItem] = useState<null | HoveredItem>(null);
  const [draggingState, setDraggingState] = useState<DraggingState>();
  const [draggingOccupancyZoneRef, setDraggingOccupancyZoneRef] =
    useState<OccupancyZoneReference | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | undefined>();
  const [dragOffsetMs, setDragOffsetMs] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [chartTimeRange, setChartTimeRange] = useState<{ start: number; end: number }>();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) =>
      setMousePosition({ x: e.clientX, y: e.clientY + 15 });
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const hasDeployedWaypoint = !!trackOccupancyDiagramsData?.length;
  const { linkingMode, toggleLinkingMode, handleLinkingClick } = useLinkingMode({
    hasDeployedWaypoint,
    onCreateLinking,
    onDeleteLinking,
  });

  const [panelSelectionMode, setPanelSelectionMode] = useState<PanelSelectionMode>('compliant');
  const [lastClickedOccurrenceId, setLastClickedOccurrenceId] = useState<OccurrenceId>();

  const translations = { linearMode: t('main.linearMode') };

  const isTrainScheduleValid = useMemo(() => {
    const selectedTrainScheduleId = extractEditoastIdFromTrainScheduleId(
      isOccurrenceId(selectedProjectionId)
        ? extractTrainScheduleIdFromOccurrenceId(selectedProjectionId)
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

  const repeatTimeRange = useMemo(
    () =>
      chartTimeRange && timetableType === 'HOURLY'
        ? {
            start: new Duration({ milliseconds: chartTimeRange.start }),
            end: new Duration({ milliseconds: chartTimeRange.end }),
          }
        : undefined,
    [chartTimeRange, timetableType]
  );

  const projectedTrains = useMemo(
    () => makeProjectedTrains(trainScheduleProjections, repeatTimeRange),
    [trainScheduleProjections, repeatTimeRange]
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
    if (element) {
      if (isSegmentPickingElement(element) || isPointPickingElement(element)) {
        return element.pathId as TrainId;
      }
      if (isOccupancyPickingElement(element)) {
        const { trainId } = parseOccupancyZonePathId(element.pathId);
        return trainId;
      }
    }
    return hoveredTrainId;
  }, [hoveredItem, hoveredTrainId]);

  const curveHover = useMemo(
    () => buildCurveStyleHover(hoveredItem, hoveredTrainId, trainSchedulesWithDetailsById),
    [hoveredItem, hoveredTrainId, trainSchedulesWithDetailsById]
  );

  const hoveredLinkingId =
    hoveredItem?.element && isLinkingPickingElement(hoveredItem.element)
      ? hoveredItem.element.linkingId
      : undefined;

  // If we're dealing a unique train or a path_and_schedule exception, use the
  // ID as-is so that only this single occupancy zone gets dragged. Otherwise,
  // we're dealing with a compliant occurrence: extract the paced train ID so
  // that all compliant occurrences get dragged.
  const draggingOccupancyZoneBaseTrainId = useMemo(() => {
    if (!draggingOccupancyZoneRef) {
      return null;
    }
    const { trainId } = draggingOccupancyZoneRef;
    const { exception } = findTrainScheduleAndException(trainSchedulesWithDetails ?? [], trainId);
    if (isTrainScheduleId(trainId) || exception?.path_and_schedule) {
      return trainId;
    } else {
      return extractTrainScheduleIdFromOccurrenceId(trainId);
    }
  }, [draggingOccupancyZoneRef]);

  const isDraggingOccupancyZoneId = useCallback(
    (waypointId: string, trainId: TrainId) => {
      if (
        waypointId !== draggingOccupancyZoneRef?.waypointId ||
        !draggingOccupancyZoneBaseTrainId
      ) {
        return false;
      }

      // When dragging a single occurrence, a single occupancy zone is marked
      // as being dragged
      if (isOccurrenceId(draggingOccupancyZoneBaseTrainId)) {
        return trainId === draggingOccupancyZoneBaseTrainId;
      }

      // When dragging a paced train, mark all compliant occupancy zones as
      // being dragged
      if (
        isOccurrenceId(trainId) &&
        extractTrainScheduleIdFromOccurrenceId(trainId) !== draggingOccupancyZoneBaseTrainId
      ) {
        return false;
      }
      const { exception } = findTrainScheduleAndException(trainSchedulesWithDetails ?? [], trainId);
      return !exception?.path_and_schedule;
    },
    [draggingOccupancyZoneRef, draggingOccupancyZoneBaseTrainId, trainSchedulesWithDetails]
  );

  const splitPoints = useMemo<SplitPoint[]>(
    () =>
      buildSplitPoints({
        occupancyZonesLayers: trackOccupancyDiagramsData,
        paths,
        activeWaypointRef,
        selectedTrain: selection,
        panelMode: panelSelectionMode,
        onCloseOccupancyLayer,
        handleWaypointClick,
        activeWaypointId,
        hoveredTrainIdForChart,
        curveHover,
        isDraggingOccupancyZoneId,
        activeTrackId: dragOverTrackId,
        onTrackDragOver: setDragOverTrackId,
        linkings: {
          existing: linkings ?? [],
          hoveredId: hoveredLinkingId,
          showSuggestions: linkingMode,
        },
      }),
    [
      trackOccupancyDiagramsData,
      paths,
      subCategories,
      trainSchedulesWithDetails,
      selection,
      panelSelectionMode,
      onCloseOccupancyLayer,
      handleWaypointClick,
      activeWaypointRef,
      hoveredTrainIdForChart,
      curveHover,
      isDraggingOccupancyZoneId,
      dragOverTrackId,
      setDragOverTrackId,
      linkings,
      hoveredLinkingId,
      linkingMode,
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
    pan,
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
    const trainId = isTrainScheduleId(selectedProjectionId)
      ? formatTrainScheduleIdToIndexedOccurrenceId(selectedProjectionId, 0)
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

  const isZoomAtDefault = xZoom === timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX);
  const handleResetClick = useCallback(() => {
    let xPosition: number | undefined;

    if (hourlyTimetableDuration) {
      if (spaceTimeChartProps.xOffset) {
        pan({ dx: -spaceTimeChartProps.xOffset });
      }
      setTimeOrigin(0);
      xPosition = 0;
    }

    if (!isZoomAtDefault) {
      handleXZoom(timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX), xPosition);
    }
  }, [
    hourlyTimetableDuration,
    spaceTimeChartProps.xOffset,
    pan,
    setTimeOrigin,
    isZoomAtDefault,
    handleXZoom,
  ]);

  const isResetButtonDisabled =
    isZoomAtDefault &&
    (!hourlyTimetableDuration ||
      (spaceTimeChartProps.timeOrigin === 0 && spaceTimeChartProps.xOffset === 0));

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

  const handleOccupancyZoneDragStart = useCallback((zoneRef: OccupancyZoneReference) => {
    setDraggingOccupancyZoneRef(zoneRef);
  }, []);

  const handleOccupancyZoneDrop = useCallback(() => {
    if (!draggingOccupancyZoneRef) {
      throw new Error('Got occupancy zone drop event with no dragging occupancy zone');
    }
    if (!draggingOccupancyZoneBaseTrainId) {
      throw new Error('Got occupancy zone drop event with no dragging base train ID');
    }

    const { waypointId } = draggingOccupancyZoneRef;
    const waypoint = trackOccupancyDiagramsData!.find((wp) => wp.waypointId === waypointId)!;
    const draggingPathId = formatOccupancyZonePathId(draggingOccupancyZoneRef);
    const zone = waypoint.zones!.find(({ pathId }) => pathId === draggingPathId)!;
    const dragOverTrack = waypoint.tracks!.find((tr) => tr.id === dragOverTrackId);
    if (dragOverTrack && zone.trackId !== dragOverTrackId && onOccupancyZoneDrop) {
      onOccupancyZoneDrop(waypointId, draggingOccupancyZoneBaseTrainId, zone, dragOverTrack);
    }
    setDraggingOccupancyZoneRef(null);
  }, [
    trackOccupancyDiagramsData,
    draggingOccupancyZoneRef,
    draggingOccupancyZoneBaseTrainId,
    dragOverTrackId,
    onOccupancyZoneDrop,
  ]);

  const isDraggingOccupancyZone = Boolean(draggingOccupancyZoneRef);

  // Whether the curve currently under the cursor can be dragged: it mirrors the
  // drag-start gate so the cursor previews the "move" affordance (ew-resize)
  // before the drag actually begins.
  const canDragHovered = useMemo(() => {
    if (selectedTrainBy !== 'std' || !hoveredItem) return false;
    const { element } = hoveredItem;
    if (!isSegmentPickingElement(element) && !isPointPickingElement(element)) return false;
    const hoveredPathId = element.pathId;
    if (!isTrainId(hoveredPathId)) return false;
    const hoveredTrain = projectedTrains.find((train) => train.id === hoveredPathId);
    if (!hoveredTrain) return false;
    return canDragHoveredTrain({ panelSelectionMode, hoveredTrain, selectedTrainId });
  }, [selectedTrainBy, hoveredItem, projectedTrains, panelSelectionMode, selectedTrainId]);

  const handlePan = useCallback(
    // TODO: fix this lint
    // eslint-disable-next-line react-hooks-js/use-memo
    configureHandlePan({
      spaceTimeChartOnPan: spaceTimeChartProps.onPan,
      handleTrainDrag,
      selectedTrainId,
      selectedTrainBy,
      panelSelectionMode,
      projectedTrains,
      draggingState,
      setDraggingState,
      setDragOffsetMs,
      hoveredItem,
      previousPanning,
      setPreviousPanning,
      zoomMode,
      trainScheduleProjections,
      occupancyZoneDragAndDrop: {
        isDragging: isDraggingOccupancyZone,
        onDragStart: handleOccupancyZoneDragStart,
        onDrop: handleOccupancyZoneDrop,
      },
      dispatch,
    }),
    [
      spaceTimeChartProps.onPan,
      handleTrainDrag,
      selectedTrainBy,
      panelSelectionMode,
      draggingState,
      hoveredItem,
      previousPanning,
      zoomMode,
      trainScheduleProjections,
      isDraggingOccupancyZone,
      handleOccupancyZoneDragStart,
      handleOccupancyZoneDrop,
      dispatch,
    ]
  );

  const handleHoveredChildUpdate: SpaceTimeChartProps['onHoveredChildUpdate'] = useCallback(
    ({ item }: { item: HoveredItem | null }) => {
      setHoveredItem(item);
    },
    [setHoveredItem]
  );

  const selectedTrainScheduleId = selectedTrainId
    ? extractTrainScheduleIdFromTrainId(selectedTrainId)
    : undefined;

  const selectedTrain = selectedTrainScheduleId
    ? trainSchedulesWithDetailsById.get(
        extractEditoastIdFromTrainScheduleId(selectedTrainScheduleId)
      )
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

    const by = selectedTrainBy === 'tod' ? 'tod' : 'std';
    if (mode === 'single') {
      const singleId =
        lastClickedOccurrenceId ??
        (selectedTrain && isPacedTrainWithDetails(selectedTrain) && selectedTrainScheduleId
          ? getFirstActiveOccurrenceId(selectedTrain, selectedTrainScheduleId)
          : undefined);
      if (singleId) {
        dispatch(updateSelectedTrain({ id: singleId, by }));
      }
      return;
    }
    if (selectedTrainScheduleId) {
      dispatch(updateSelectedTrain({ id: selectedTrainScheduleId, by }));
    }
  };

  const commitSelection = (id: TrainId, by: 'std' | 'tod', panelMode: PanelSelectionMode) => {
    if (selectedTrainId === id && selectedTrainBy === by) return;
    if (isOccurrenceId(id)) setLastClickedOccurrenceId(id);
    setPanelSelectionMode(panelMode);
    dispatch(updateSelectedTrain({ id, by }));
  };

  const handleClick: SpaceTimeChartProps['onClick'] = ({ event }) => {
    if (draggingState) return;

    const element = hoveredItem?.element;

    if (handleLinkingClick(element)) return;

    if (
      !element ||
      (!isSegmentPickingElement(element) &&
        !isPointPickingElement(element) &&
        !isOccupancyPickingElement(element))
    ) {
      // Click outside any train → deselect (return to timetable selection).
      if (selectedTrainId) dispatch(updateSelectedTrain({ id: selectedTrainId, by: 'timetable' }));
      return;
    }

    // click on any STD curve
    if (isSegmentPickingElement(element) || isPointPickingElement(element)) {
      const clickedTrainId = element.pathId;
      if (isTrainId(clickedTrainId)) {
        const { exception } = findTrainScheduleAndException(
          trainSchedulesWithDetails ?? [],
          clickedTrainId
        );
        // By default selecting an occurrence selects its whole paced train; alt-click (or
        // clicking a start_time exception) isolates the single occurrence.
        const isolate = event.altKey || !!exception?.start_time;
        const id = isolate ? clickedTrainId : extractTrainScheduleIdFromTrainId(clickedTrainId);
        setLastClickedOccurrenceId(isOccurrenceId(clickedTrainId) ? clickedTrainId : undefined);
        commitSelection(id, 'std', isOccurrenceId(id) ? 'single' : 'compliant');
      }
      return;
    }

    // Click on a TOD occupancy zone.
    if (isOccupancyPickingElement(element)) {
      const { trainId } = parseOccupancyZonePathId(element.pathId);
      const { exception } = findTrainScheduleAndException(trainSchedulesWithDetails ?? [], trainId);
      commitSelection(trainId, 'tod', exception?.path_and_schedule ? 'single' : 'compliant');
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.code === 'KeyS') {
      if (!selectedTrainScheduleId || selectedTrainBy !== 'std') return;
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

  const { onMouseMove } = useEdgePan({
    enableY: isDraggingOccupancyZone,
    hideTimeCaptions: spaceTimeChartProps.hideTimeCaptions,
    themeTimeCaptionsSize: spaceTimeChartProps.theme?.timeCaptionsSize,
    pan,
  });

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
        style={{ height, cursor: isDraggingOccupancyZone ? 'ns-resize' : undefined }}
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
          style={{
            cursor:
              draggingState || canDragHovered
                ? 'ew-resize'
                : hoveredItem &&
                    (isSegmentPickingElement(hoveredItem.element) ||
                      isPointPickingElement(hoveredItem.element) ||
                      isOccupancyPickingElement(hoveredItem.element))
                  ? 'pointer'
                  : undefined,
          }}
        >
          <SpaceTimeChartToolbar
            onResetClick={handleResetClick}
            zoomMode={zoomMode}
            disableZoom={!!waypointsPanelData?.deployedWaypoints?.size}
            toggleZoomMode={toggleZoomMode}
            setShowSettingsPanel={setShowSettingsPanel}
            isResetButtonDisabled={isResetButtonDisabled}
            linkingMode={linkingMode}
            disableLinkingMode={!hasDeployedWaypoint}
            toggleLinkingMode={toggleLinkingMode}
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
            onMouseMove={onMouseMove}
            spaceOrigin={
              (waypointsPanelData?.filteredWaypoints ?? operationalPoints).at(0)?.position || 0
            }
            hourlyTimetableDuration={hourlyTimetableDuration?.ms}
          >
            {paths.map((path) => {
              const trainId = path.id as TrainId;
              const style = getPathStyleV2(
                {
                  chart: 'std',
                  train: isOccurrenceId(trainId)
                    ? {
                        id: trainId,
                        relevantExceptionTypes: getTrainExceptionTypes(
                          trainSchedulesWithDetailsById,
                          trainId
                        ),
                      }
                    : { id: trainId },
                  selection,
                  panelMode: panelSelectionMode,
                  hover: curveHover,
                  dragging: draggingState
                    ? {
                        trainId: draggingState.draggedTrain.id,
                        relevantExceptionTypes: getTrainExceptionTypes(
                          trainSchedulesWithDetailsById,
                          draggingState.draggedTrain.id
                        ),
                      }
                    : undefined,
                },
                { colors: path.colors, isSimulated: path.isSimulated }
              );
              return (
                <PathLayer
                  key={path.key}
                  path={path}
                  color={style.color}
                  level={style.level}
                  opacity={style.opacity}
                  border={style.outline}
                  label={style.label}
                  stop={style.stop}
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
            <TimeRangeObserver onChange={setChartTimeRange} />
          </SpaceTimeChart>
          {showCurvePanel && (
            <CurveSelectionSidePanel
              position={height / 2}
              panelSelectionMode={panelSelectionMode}
              onModeChange={handlePanelModeChange}
              counts={panelCounts}
              isFaded={!!draggingState}
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
      {draggingState &&
        dragOffsetMs !== null &&
        createPortal(
          // tooltip following the cursor with the drag's time offset
          <div className="drag-tooltip" style={{ left: mousePosition.x, top: mousePosition.y }}>
            {formatDragOffset(dragOffsetMs)}
          </div>,
          document.body
        )}
    </div>
    /* TODO use margin or absolute to align with handle */
  );
};

export default SpaceTimeChartWrapper;
