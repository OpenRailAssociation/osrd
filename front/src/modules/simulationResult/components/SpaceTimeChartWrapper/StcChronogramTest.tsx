import { useMemo, useRef, useState, useCallback, useEffect } from 'react';

import {
  type HoveredItem,
  type SpaceTimeChartProps,
  useManchetteWithSpaceTimeChart,
  timeScaleToZoomValue,
  DEFAULT_ZOOM_MS_PER_PX,
  ZoomRect,
  SpaceTimeChart,
  Manchette,
  isSegmentPickingElement,
  isPointPickingElement,
  ChronogramLayer,
  type LevelCrossingOccupancy,
} from '@osrd-project/ui-charts';
import { Slider } from '@osrd-project/ui-core';
import { Iterations, ZoomIn } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { createPortal } from 'react-dom';

import { configureHandlePan } from 'modules/simulationResult/components/SpaceTimeChartWrapper/helpers/configureHandlePan';
import type {
  PathOperationalPoint,
  TrainSpaceTimeData,
  WaypointsPanelData,
  DraggingState,
} from 'modules/simulationResult/types';
import type { OccurrenceId, PacedTrainId, TrainId, TrainScheduleId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { isTrainId, isPacedTrainId, formatPacedTrainIdToIndexedOccurrenceId } from 'utils/trainId';

import makeProjectedItems from './helpers/makeProjectedItems';
import ProjectionLoadingMessage from './ProjectionLoadingMessage';
import useWaypointMenu from './useWaypointMenu';
import WaypointsPanel from './WaypointsPanel';

type SpaceTimeChartWrapperBaseProps = {
  operationalPoints: PathOperationalPoint[];
  projectPathTrainResult: TrainSpaceTimeData[];
  selectedTrainId?: TrainId;
  projectionLoaderData: {
    totalTrains: number;
    allTrainsProjected: boolean;
  };
  height?: number;
  onTrainClick?: (trainId: TrainId) => void;
  selectedProjectionId: TrainScheduleId | PacedTrainId | OccurrenceId;
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

const StcChronogramTest = ({
  operationalPoints,
  projectPathTrainResult,
  waypointsPanelData,
  projectionLoaderData: { totalTrains, allTrainsProjected },
  height = MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
  onTrainClick,
  selectedProjectionId,
  selectedTrainId,
  waypointsPanelIsOpen,
  setWaypointsPanelIsOpen,
}: SpaceTimeChartWrapperProps) => {
  const dispatch = useAppDispatch();

  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const activeWaypointRef = useRef<HTMLDivElement>(null);

  const [hoveredItem, setHoveredItem] = useState<null | HoveredItem>(null);
  const [draggingState, setDraggingState] = useState<DraggingState>();

  const spaceTimeChartRef = useRef<HTMLDivElement>(null);

  const projectedTrains = useMemo(
    () => makeProjectedItems(projectPathTrainResult),
    [projectPathTrainResult]
  );

  const [previousPanning, setPreviousPanning] = useState(false);

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
    splitPoints: undefined,
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

  const testingTextList = [
    'Test 1',
    'Test 2',
    'Test 3',
    'Test 4',
    'Test 5',
    'Test 6',
    'Test 7',
    'Test 8',
  ];

  const manchettePropsWithWaypointMenu = useMemo(
    () => ({
      ...manchetteProps,
      contents: testingTextList.map((text) => (
        <p
          key={text}
          style={{
            height: '60px',
            backgroundColor: '#f2f0e4',
            textAlign: 'center',
            marginBottom: '0',
          }}
        >
          {text}
        </p>
      )),
      activeWaypointId,
      activeWaypointRef,
    }),
    [manchetteProps, activeWaypointId, handleWaypointClick]
  );

  const handlePan = useCallback(
    configureHandlePan({
      spaceTimeChartOnPan: spaceTimeChartProps.onPan,
      handleTrainDrag: undefined,
      selectedTrainId: undefined,
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
      (isSegmentPickingElement(hoveredItem.element) || isPointPickingElement(hoveredItem.element))
    ) {
      const hoveredTrainId = hoveredItem.element.pathId;
      if (isTrainId(hoveredTrainId) && selectedTrainId !== hoveredTrainId) {
        onTrainClick(hoveredTrainId);
      }
    }
  };

  const chronogramData = useMemo<LevelCrossingOccupancy[]>(() => {
    // exemple simple : 1 PN centré autour du premier waypoint
    const firstWaypoint = (waypointsPanelData?.filteredWaypoints ?? operationalPoints)[0];
    if (!firstWaypoint) return [];

    const baseSpace = firstWaypoint.position;
    const startTime = projectPathTrainResult[0]?.departureTime ?? 0;
    const startMs = Number(startTime);

    console.log('chronogramData calc pos => ', {
      baseSpace,
      startMs,
      dep_time: projectPathTrainResult[0]?.departureTime,
    });

    return [
      {
        spaceStart: baseSpace - 50000,
        spaceEnd: baseSpace + 50000,
        occupancy: [
          [
            { startTime: startMs, endTime: startMs + 30000 },
            { startTime: startMs + 32000, endTime: startMs + 60000 },
          ],
        ],
      },
    ];
  }, [operationalPoints, waypointsPanelData, projectPathTrainResult]);

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
          </div>

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
            <ChronogramLayer />
            {rect && <ZoomRect {...rect} />}
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

export default StcChronogramTest;
