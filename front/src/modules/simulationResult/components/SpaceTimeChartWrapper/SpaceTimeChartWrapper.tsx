import { useMemo, useRef, useState, useCallback, useEffect } from 'react';

import {
  type Conflict,
  type HoveredItem,
  type SpaceTimeChartProps,
  useManchetteWithSpaceTimeChart,
  timeScaleToZoomValue,
  DEFAULT_ZOOM_MS_PER_PX,
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
  usePaths,
  isInteractiveWaypoint,
  TrackOccupancyCanvas,
  TrackOccupancyManchette,
  WaypointComponent,
  type Track,
  type OccupancyZone,
  TRACK_HEIGHT_CONTAINER,
  DEFAULT_THEME,
  BASE_WAYPOINT_HEIGHT,
  isOccupancyPickingElement,
} from '@osrd-project/ui-charts';
import { Slider } from '@osrd-project/ui-core';
import { Sliders, Iterations, ZoomIn } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { keyBy, sortBy } from 'lodash';
import { createPortal } from 'react-dom';

import upward from 'assets/pictures/workSchedules/ScheduledMaintenanceUp.svg';
import { type PostWorkSchedulesProjectPathApiResponse } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import type {
  PathOperationalPoint,
  TrainSpaceTimeData,
  WaypointsPanelData,
  DraggingState,
} from 'modules/simulationResult/types';
import type { TimetableItemWithDetails } from 'modules/timetableItem/components/Timetable/types';
import type { OccurrenceId, PacedTrainId, TrainId, TrainScheduleId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import {
  isTrainId,
  extractPacedTrainIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  isPacedTrainId,
  formatPacedTrainIdToIndexedOccurrenceId,
} from 'utils/trainId';

import getPathStyle from './helpers/getPathStyle';
import makeProjectedItems from './helpers/makeProjectedItems';
import {
  cutSpaceTimeChart,
  getOccupancyBlocks,
  isIndividualOccurrenceProjection,
} from './helpers/utils';
import ProjectionLoadingMessage from './ProjectionLoadingMessage';
import SettingsPanel from './SettingsPanel';
import useWaypointMenu from './useWaypointMenu';
import WaypointsPanel from './WaypointsPanel';
import { Spinner } from '../../../../common/Loaders';

type SpaceTimeChartWrapperBaseProps = {
  operationalPoints: PathOperationalPoint[];
  projectPathTrainResult: TrainSpaceTimeData[];
  selectedTrainId?: TrainId;
  conflicts?: Conflict[];
  workSchedules?: PostWorkSchedulesProjectPathApiResponse;
  occupancyZonesLayers?: {
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
  selectedProjectionId: TrainScheduleId | PacedTrainId | OccurrenceId;
  timetableItemsWithDetails?: TimetableItemWithDetails[];
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

const SpaceTimeChartWrapper = ({
  operationalPoints,
  projectPathTrainResult,
  waypointsPanelData,
  conflicts = [],
  workSchedules,
  occupancyZonesLayers,
  onCloseOccupancyLayer,
  projectionLoaderData: { totalTrains, allTrainsProjected },
  height = MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
  handleTrainDrag,
  onTrainClick,
  selectedProjectionId,
  selectedTrainId,
  timetableItemsWithDetails,
  waypointsPanelIsOpen,
  setWaypointsPanelIsOpen,
}: SpaceTimeChartWrapperProps) => {
  const dispatch = useAppDispatch();

  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const activeWaypointRef = useRef<HTMLDivElement>(null);

  const [hoveredItem, setHoveredItem] = useState<null | HoveredItem>(null);
  const [draggingState, setDraggingState] = useState<DraggingState>();

  const isTimetableItemValid = useMemo(() => {
    const timetableItemUsedForProjectionWithDetails = timetableItemsWithDetails?.find(
      (item) => item.id === selectedProjectionId
    );
    return timetableItemUsedForProjectionWithDetails?.summary?.isValid ?? false;
  }, [timetableItemsWithDetails, selectedProjectionId]);

  const spaceTimeChartRef = useRef<HTMLDivElement>(null);

  const subCategories = useSubCategoryContext();

  const projectedTrains = useMemo(
    () => makeProjectedItems(projectPathTrainResult),
    [projectPathTrainResult]
  );

  const [previousPanning, setPreviousPanning] = useState(false);

  // Cut the spacetime chart curves if the first or last waypoints are hidden
  const { filteredProjectPathTrainResult: cutProjectedTrains, filteredConflicts: cutConflicts } =
    useMemo(
      () => cutSpaceTimeChart(projectedTrains, conflicts, operationalPoints, waypointsPanelData),
      [waypointsPanelData?.filteredWaypoints, projectedTrains, conflicts]
    );

  const paths = usePaths(cutProjectedTrains);

  const manchetteWaypoints = useMemo(() => {
    const rawWaypoints = waypointsPanelData?.filteredWaypoints ?? operationalPoints;
    return rawWaypoints.map((waypoint) => ({
      id: waypoint.waypointId,
      position: waypoint.position,
      name: waypoint.extensions?.identifier?.name,
      secondaryCode: waypoint.extensions?.sncf?.ch,
      weight: waypoint.weight ?? 0,
    }));
  }, [waypointsPanelData, operationalPoints]);

  const { waypointMenu, activeWaypointId, handleWaypointClick } = useWaypointMenu(
    activeWaypointRef,
    waypointsPanelData,
    allTrainsProjected
  );

  const splitPoints = useMemo<SplitPoint[]>(() => {
    const pathsIndex = keyBy(paths, ({ id }) => id);

    return (
      sortBy(
        occupancyZonesLayers || [],
        ({ operationalPointPosition }) => operationalPointPosition
      ).map(
        ({
          waypointId,
          operationalPointId,
          operationalPointName,
          operationalPointPosition,
          zones,
          tracks,
          loading,
        }) => ({
          id: operationalPointId,
          position: operationalPointPosition,
          size: (tracks?.length || 0) * TRACK_HEIGHT_CONTAINER + DEFAULT_THEME.timeCaptionsSize,
          spaceTimeChartNode: (
            <TrackOccupancyCanvas
              position={operationalPointPosition}
              tracks={tracks || []}
              occupancyZones={(zones || []).map((zone) => {
                const path = pathsIndex[zone.trainId];
                if (!path) return zone;
                const pathStyle = getPathStyle(
                  hoveredItem,
                  path,
                  !!draggingState,
                  subCategories,
                  timetableItemsWithDetails,
                  selectedTrainId
                );
                return {
                  ...zone,
                  color: pathStyle.color,
                  size: pathStyle.level === 1 ? 2 : undefined,
                };
              })}
              selectedTrainId={selectedTrainId}
              onClose={() => onCloseOccupancyLayer?.(waypointId)}
              topPadding={BASE_WAYPOINT_HEIGHT}
            />
          ),
          manchetteNode: (
            <TrackOccupancyManchette tracks={tracks || []}>
              <div className="waypoint-wrapper flex justify-start">
                <WaypointComponent
                  waypoint={{
                    id: waypointId,
                    name: (
                      <div className="d-flex flex-row align-items-center">
                        {operationalPointName || operationalPointId}
                        {loading && (
                          <Spinner className="ml-2 small" spinnerClassName="spinner-border-sm" />
                        )}
                      </div>
                    ),
                    position: operationalPointPosition,
                    onClick: handleWaypointClick,
                  }}
                  waypointRef={activeWaypointRef}
                  isActive={false}
                  isMenuActive={false}
                />
              </div>
            </TrackOccupancyManchette>
          ),
        })
      ) || []
    );
  }, [
    occupancyZonesLayers,
    activeWaypointId,
    timetableItemsWithDetails,
    selectedTrainId,
    hoveredItem,
  ]);

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
      const filteredProjectedTrains = projectPathTrainResult.filter(
        (train) => train.spaceTimeCurves.length > 0
      );
      const minTime = Math.min(...filteredProjectedTrains.map((p) => +p.departureTime));
      setTimeOrigin(minTime);
    }
  }, [selectedProjectionId, projectPathTrainResult.length]);

  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settings, setSettings] = useState({
    showConflicts: false,
    showSignalsStates: false,
  });

  const occupancyBlocks = getOccupancyBlocks(cutProjectedTrains);

  const onPanOverloaded: SpaceTimeChartProps['onPan'] = async (payload) => {
    const { isPanning } = payload;

    if (!handleTrainDrag) {
      // if no handleTrainDrag, we pan normally
      spaceTimeChartProps.onPan?.(payload);
      return;
    }

    // if dragging
    if (draggingState) {
      const { draggedTrain, initialDepartureTime } = draggingState;

      if (draggedTrain.id !== selectedTrainId) {
        dispatch(updateSelectedTrainId(draggedTrain.id));
      }

      const timeDiff = payload.data.time - payload.initialData.time;

      let newDepartureTime = new Date(initialDepartureTime.getTime() + timeDiff);

      // if the dragged train is an occurrence, we need to update the first occurrence because the others are based on it
      if (
        isIndividualOccurrenceProjection(draggedTrain) &&
        (!draggedTrain.exception || !draggedTrain.exception.start_time)
      ) {
        const occurrencesIndex = extractOccurrenceIndexFromOccurrenceId(draggedTrain.id);
        const pacedTrainId = extractPacedTrainIdFromOccurrenceId(draggedTrain.id);
        const pacedTrain = projectPathTrainResult.find(
          ({ id }) => isPacedTrainId(id) && id === pacedTrainId
        );
        if (pacedTrain && 'paced' in pacedTrain) {
          newDepartureTime = dayjs(newDepartureTime)
            .add(occurrencesIndex * -pacedTrain.paced.interval.ms, 'ms')
            .toDate();
        }
      }

      // stop dragging if necessary
      if (!isPanning) {
        setDraggingState(undefined);
      }

      await handleTrainDrag({
        draggedTrainId: draggedTrain.id,
        initialDepartureTime,
        newDepartureTime,
        stopPanning: !isPanning,
      });
      return;
    }

    // if not dragging, we check if we should start dragging
    // Only a mouse hover that starts already over a path should register
    // if we start panning, and then the mouse hovers over the path,
    // it should continue just sliding the chart, not start dragging the train path
    if (
      isPanning &&
      !previousPanning &&
      !zoomMode &&
      hoveredItem &&
      (isSegmentPickingElement(hoveredItem.element) || isPointPickingElement(hoveredItem.element))
    ) {
      const hoveredTrainId = hoveredItem.element.pathId;
      if (!isTrainId(hoveredTrainId)) return;

      const train = projectedTrains.find((projectedTrain) => projectedTrain.id === hoveredTrainId);
      if (!train) {
        console.error(`No train found with id ${hoveredTrainId}`);
        return;
      }

      // disable start time exception for now
      const isStartTimeException =
        isIndividualOccurrenceProjection(train) && !!train.exception?.start_time;
      if (isStartTimeException) return;

      setDraggingState({
        draggedTrain: train,
        initialDepartureTime: train.departureTime,
      });
    }

    // if no hovered train, we pan normally
    spaceTimeChartProps.onPan?.(payload);

    if (isPanning !== previousPanning) {
      setPreviousPanning(isPanning);
    }
  };

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

  const handleHoveredChildUpdate: SpaceTimeChartProps['onHoveredChildUpdate'] = useCallback(
    ({ item }: { item: HoveredItem | null }) => {
      setHoveredItem(item);
    },
    [setHoveredItem]
  );

  const handleClick: SpaceTimeChartProps['onClick'] = () => {
    if (
      onTrainClick &&
      !draggingState &&
      hoveredItem &&
      (isSegmentPickingElement(hoveredItem.element) ||
        isPointPickingElement(hoveredItem.element) ||
        isOccupancyPickingElement(hoveredItem.element))
    ) {
      const hoveredTrainId = hoveredItem.element.pathId;
      if (isTrainId(hoveredTrainId) && selectedTrainId !== hoveredTrainId) {
        onTrainClick(hoveredTrainId);
      }
    }
  };

  return (
    <div data-testid="manchette-space-time-chart" className="ui-manchette-space-time-chart-wrapper">
      {waypointsPanelData &&
        waypointsPanelIsOpen &&
        createPortal(
          <WaypointsPanel
            waypointsPanelIsOpen={waypointsPanelIsOpen}
            setWaypointsPanelIsOpen={setWaypointsPanelIsOpen}
            waypoints={operationalPoints}
            waypointsPanelData={waypointsPanelData}
          />,
          document.body
        )}
      {!allTrainsProjected && (
        <ProjectionLoadingMessage
          projectedTrainsNb={projectPathTrainResult.length}
          totalTrains={totalTrains}
        />
      )}
      <div
        ref={manchetteWithSpaceTimeChartRef}
        className="manchette flex"
        style={{ height }}
        onScroll={handleScroll}
      >
        <Manchette {...manchettePropsWithWaypointMenu} />
        {waypointMenu}
        <div
          ref={spaceTimeChartRef}
          data-testid="space-time-chart-container"
          className="space-time-chart-container"
        >
          <div className="toolbar">
            <button
              type="button"
              className={cx('reset-button', {
                'reset-button-disabled': xZoom === timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX),
              })}
              onClick={() => {
                if (xZoom !== timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX)) {
                  handleXZoom(timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX));
                }
              }}
            >
              <Iterations />
            </button>
            <button
              type="button"
              className={cx('zoom-button', {
                'zoom-button-clicked': zoomMode,
                'zoom-button-disabled': !!waypointsPanelData?.deployedWaypoints?.size,
              })}
              onClick={toggleZoomMode}
              disabled={!!waypointsPanelData?.deployedWaypoints?.size}
            >
              <ZoomIn className="icon" />
            </button>
            <button
              type="button"
              className="menu-button"
              onClick={() => setShowSettingsPanel(true)}
            >
              <Sliders />
            </button>
          </div>
          {showSettingsPanel && (
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              onClose={() => setShowSettingsPanel(false)}
              isTimetableItemValid={isTimetableItemValid}
            />
          )}

          <SpaceTimeChart
            className="inset-0 absolute h-full"
            height={height}
            {...spaceTimeChartProps}
            onPan={onPanOverloaded}
            onClick={handleClick}
            onHoveredChildUpdate={handleHoveredChildUpdate}
            spaceOrigin={
              (waypointsPanelData?.filteredWaypoints ?? operationalPoints).at(0)?.position || 0
            }
          >
            {paths.map((path) => (
              <PathLayer
                key={`${path.id}-${path.points[0]?.position}`}
                path={path}
                {...getPathStyle(
                  hoveredItem,
                  path,
                  !!draggingState,
                  subCategories,
                  timetableItemsWithDetails,
                  selectedTrainId
                )}
              />
            ))}
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
            {settings.showConflicts && <ConflictLayer conflicts={cutConflicts} />}
            {settings.showSignalsStates && (
              <OccupancyBlockLayer occupancyBlocks={occupancyBlocks} />
            )}
          </SpaceTimeChart>
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
