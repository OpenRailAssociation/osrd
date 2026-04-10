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
  isOccupancyPickingElement,
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
import type {
  PathOperationalPoint,
  TrainSpaceTimeData,
  WaypointsPanelData,
  DraggingState,
} from 'modules/simulationResult/types';
import { isPacedTrainWithDetails } from 'modules/timetableItem/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/timetableItem/types';
import type { TrainId } from 'reducers/osrdconf/types';
import { getHoveredTrainId, getIsSimulationEnabled } from 'reducers/simulationResults/selectors';
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
  extractEditoastIdFromPacedTrainId,
} from 'utils/trainId';
import { mapBy } from 'utils/types';

import { buildSplitPoints } from './buildSplitPoints';
import cutSpaceTimeCurves from './helpers/cutSpaceTimeCurves';
import formatSpaceTimeCurves from './helpers/formatSpaceTimeCurves';
import getPathStyle from './helpers/getPathStyle';
import makeProjectedItems from './helpers/makeProjectedItems';
import { getOccupancyBlocks } from './helpers/utils';
import ProjectionLoadingMessage from './ProjectionLoadingMessage';
import SettingsPanel from './SettingsPanel';
import SpaceTimeChartToolbar from './SpaceTimeChartToolbar';
import useWaypointMenu from './useWaypointMenu';
import WaypointsPanel from './WaypointsPanel';

type SpaceTimeChartWrapperBaseProps = {
  operationalPoints: PathOperationalPoint[];
  timetableItemProjections: TrainSpaceTimeData[];
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

const SpaceTimeChartWrapper = ({
  operationalPoints,
  timetableItemProjections,
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
  trainSchedulesWithDetails,
  waypointsPanelIsOpen,
  setWaypointsPanelIsOpen,
  pathfindingHasFailed = false,
}: SpaceTimeChartWrapperProps) => {
  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const hoveredTrainId = useSelector(getHoveredTrainId);
  const isSimulationEnabled = useSelector(getIsSimulationEnabled);

  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const activeWaypointRef = useRef<HTMLDivElement>(null);

  const [hoveredItem, setHoveredItem] = useState<null | HoveredItem>(null);
  const [draggingState, setDraggingState] = useState<DraggingState>();

  const translations = { linearMode: t('main.linearMode') };

  const isTimetableItemValid = useMemo(() => {
    const selectedItemId = extractEditoastIdFromPacedTrainId(
      isOccurrenceId(selectedProjectionId)
        ? extractPacedTrainIdFromOccurrenceId(selectedProjectionId)
        : selectedProjectionId
    );

    const trainScheduleUsedForProjectionWithDetails = trainSchedulesWithDetails?.find(
      (trainSchedule) => trainSchedule.id === selectedItemId
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
    () => makeProjectedItems(timetableItemProjections),
    [timetableItemProjections]
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
      name: waypoint.extensions?.identifier?.name,
      secondaryCode: waypoint.extensions?.sncf?.ch,
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
        ...timetableItemProjections
          .filter((train) => train.spaceTimeCurves.length > 0)
          .map((p) => +p.departureTime)
      );
      setTimeOrigin(minTime);
    }
  }, [selectedProjectionId, timetableItemProjections.length]);

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
    // eslint-disable-next-line react-hooks/use-memo
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
      timetableItemProjections,
      dispatch,
    }),
    [
      spaceTimeChartProps.onPan,
      handleTrainDrag,
      draggingState,
      hoveredItem,
      previousPanning,
      zoomMode,
      timetableItemProjections,
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
      const clickedTrainId = hoveredItem.element.pathId;
      if (isTrainId(clickedTrainId) && selectedTrainId !== clickedTrainId) {
        onTrainClick(clickedTrainId);
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
            hideOffsets={pathfindingHasFailed}
          />,
          document.body
        )}
      {!allTrainsProjected && (
        <ProjectionLoadingMessage
          projectedTrainsNb={timetableItemProjections.length}
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
              onClose={() => setShowSettingsPanel(false)}
              isTimetableItemValid={isTimetableItemValid}
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
            {paths.map((path) => (
              <PathLayer
                key={`${path.id}-${path.points[0]?.position}`}
                path={path}
                {...getPathStyle(
                  hoveredItem,
                  path,
                  !!draggingState,
                  selectedTrainId,
                  hoveredTrainId
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
            {isSimulationEnabled && (
              <>
                {settings.showConflicts && <ConflictLayer conflicts={cutConflicts} />}
                {settings.showSignalsStates && (
                  <OccupancyBlockLayer occupancyBlocks={occupancyBlocks} />
                )}
              </>
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
