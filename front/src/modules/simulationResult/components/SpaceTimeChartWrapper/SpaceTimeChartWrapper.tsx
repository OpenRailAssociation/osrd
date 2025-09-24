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
import { keyBy, sortBy } from 'lodash';
import { createPortal } from 'react-dom';

import upward from 'assets/pictures/workSchedules/ScheduledMaintenanceUp.svg';
import { type PostWorkSchedulesProjectPathApiResponse } from 'common/api/osrdEditoastApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { configureHandlePan } from 'modules/simulationResult/components/SpaceTimeChartWrapper/helpers/configureHandlePan';
import type {
  PathOperationalPoint,
  TrainSpaceTimeData,
  WaypointsPanelData,
  DraggingState,
} from 'modules/simulationResult/types';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { OccurrenceId, PacedTrainId, TrainId, TrainScheduleId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import {
  isTrainId,
  isPacedTrainId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  extractExceptionIdFromOccurrenceId,
  isAddedExceptionId,
} from 'utils/trainId';

import getPathStyle from './helpers/getPathStyle';
import makeProjectedItems from './helpers/makeProjectedItems';
import { cutSpaceTimeChart, getOccupancyBlocks } from './helpers/utils';
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
  trackOccupancyDiagramsData,
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
    const selectedItemId = isOccurrenceId(selectedProjectionId)
      ? extractPacedTrainIdFromOccurrenceId(selectedProjectionId)
      : selectedProjectionId;

    const timetableItemUsedForProjectionWithDetails = timetableItemsWithDetails?.find(
      (item) => item.id === selectedItemId
    );

    if (
      timetableItemUsedForProjectionWithDetails &&
      'exceptions' in timetableItemUsedForProjectionWithDetails &&
      isOccurrenceId(selectedProjectionId)
    ) {
      const exeptionUsedForProjection = timetableItemUsedForProjectionWithDetails.exceptions.find(
        (exception) =>
          isAddedExceptionId(selectedProjectionId)
            ? exception.key === extractExceptionIdFromOccurrenceId(selectedProjectionId)
            : exception.occurrence_index ===
              extractOccurrenceIndexFromOccurrenceId(selectedProjectionId)
      );
      if (exeptionUsedForProjection?.summary) return exeptionUsedForProjection.summary.isValid;
    }

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
        trackOccupancyDiagramsData || [],
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
    trackOccupancyDiagramsData,
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
      projectPathTrainResult,
      dispatch,
    }),
    [
      spaceTimeChartProps.onPan,
      handleTrainDrag,
      draggingState,
      hoveredItem,
      previousPanning,
      zoomMode,
      projectPathTrainResult,
      dispatch,
    ]
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
        data-testid="manchette-spacetimediagram-ref"
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
              data-testid="zoom-reset-button"
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
              data-testid="zoom-button"
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
              data-testid="menu-button"
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
            onPan={handlePan}
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
