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
  isSegmentPickingElement,
  isPointPickingElement,
  usePaths,
  isInteractiveWaypoint,
} from '@osrd-project/ui-charts';
import { Slider } from '@osrd-project/ui-core';
import { KebabHorizontal, Iterations, ZoomIn } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { compact } from 'lodash';

import upward from 'assets/pictures/workSchedules/ScheduledMaintenanceUp.svg';
import type { PostWorkSchedulesProjectPathApiResponse } from 'common/api/osrdEditoastApi';
import { cutSpaceTimeRect } from 'modules/simulationResult/components/SpaceTimeChart/helpers/utils';
import { ASPECT_LABELS_COLORS } from 'modules/simulationResult/consts';
import type {
  AspectLabel,
  LayerRangeData,
  PathOperationalPoint,
  TrainSpaceTimeData,
  WaypointsPanelData,
} from 'modules/simulationResult/types';
import computeOccurrenceName from 'modules/trainschedule/helpers/computeOccurrenceName';
import { getOccurrencesNb } from 'modules/trainschedule/helpers/pacedTrain';
import type { TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import {
  isTrainId,
  formatPacedTrainIdToOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  isTrainScheduleProjection,
  isOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
} from 'utils/trainId';

import SettingsPanel from './SettingsPanel';
import getPathStyle from './utils';
import ManchetteMenuButton from '../SpaceTimeChart/ManchetteMenuButton';
import ProjectionLoadingMessage from '../SpaceTimeChart/ProjectionLoadingMessage';
import useWaypointMenu from '../SpaceTimeChart/useWaypointMenu';
import WaypointsPanel from '../SpaceTimeChart/WaypointsPanel';

type ManchetteWithSpaceTimeChartProps = {
  operationalPoints: PathOperationalPoint[];
  projectPathTrainResult: TrainSpaceTimeData[];
  selectedTrainId?: TrainId;
  waypointsPanelData?: WaypointsPanelData;
  conflicts?: Conflict[];
  workSchedules?: PostWorkSchedulesProjectPathApiResponse;
  projectionLoaderData: {
    totalTrains: number;
    allTrainsProjected: boolean;
  };
  handleTrainDrag?: (
    draggedTrainId: TrainId,
    newDepartureTime: Date,
    { stopPanning }: { stopPanning: boolean }
  ) => Promise<void>;
  height?: number;
  onTrainClick?: (trainId: TrainId) => void;
  selectedProjectionId: TimetableItemId;
};

export const MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT = 561;

const ManchetteWithSpaceTimeChartWrapper = ({
  operationalPoints,
  projectPathTrainResult,
  waypointsPanelData,
  conflicts = [],
  workSchedules,
  projectionLoaderData: { totalTrains, allTrainsProjected },
  height = MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
  handleTrainDrag,
  onTrainClick,
  selectedProjectionId,
  selectedTrainId,
}: ManchetteWithSpaceTimeChartProps) => {
  const dispatch = useAppDispatch();

  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const activeWaypointRef = useRef<HTMLDivElement>(null);

  const [hoveredItem, setHoveredItem] = useState<null | HoveredItem>(null);
  const [draggingState, setDraggingState] = useState<{
    draggedTrain: TrainSpaceTimeData;
    initialDepartureTime: Date;
  }>();

  const spaceTimeChartRef = useRef<HTMLDivElement>(null);

  const [waypointsPanelIsOpen, setWaypointsPanelIsOpen] = useState(false);

  const projectedTrains = useMemo(
    () =>
      projectPathTrainResult.flatMap<TrainSpaceTimeData>((train) => {
        if (isTrainScheduleProjection(train)) {
          return train;
        }
        const pacedTrainId = extractPacedTrainIdFromOccurrenceId(train.id);
        const occurrencesCount = getOccurrencesNb(train.paced);
        const occurrences = [];
        for (let i = 0; i < occurrencesCount; i += 1) {
          const occurrenceStartTime = dayjs(train.departureTime)
            .add(i * train.paced.interval.ms, 'ms')
            .toDate();
          occurrences.push({
            ...train,
            id: formatPacedTrainIdToOccurrenceId(pacedTrainId, i),
            name: computeOccurrenceName(train.name, i),
            departureTime: occurrenceStartTime,
          });
        }
        return occurrences;
      }),
    [projectPathTrainResult]
  );

  const [previousPanning, setPreviousPanning] = useState(false);
  // Cut the space time chart curves if the first or last waypoints are hidden
  const { filteredProjectPathTrainResult: cutProjectedTrains, filteredConflicts: cutConflicts } =
    useMemo(() => {
      let filteredProjectPathTrainResult = projectedTrains;
      let filteredConflicts = conflicts;

      if (!waypointsPanelData || waypointsPanelData.filteredWaypoints.length < 2)
        return { filteredProjectPathTrainResult, filteredConflicts };

      const { filteredWaypoints } = waypointsPanelData;
      const firstPosition = filteredWaypoints.at(0)!.position;
      const lastPosition = filteredWaypoints.at(-1)!.position;

      if (firstPosition !== 0 || lastPosition !== operationalPoints.at(-1)!.position) {
        filteredProjectPathTrainResult = projectedTrains.map((train) => ({
          ...train,
          spaceTimeCurves: train.spaceTimeCurves.map(({ positions, times }) => {
            const cutPositions: number[] = [];
            const cutTimes: number[] = [];

            for (let i = 1; i < positions.length; i += 1) {
              const currentRange: LayerRangeData = {
                spaceStart: positions[i - 1],
                spaceEnd: positions[i],
                timeStart: times[i - 1],
                timeEnd: times[i],
              };

              const interpolatedRange = cutSpaceTimeRect(currentRange, firstPosition, lastPosition);

              // TODO : remove reformatting the datas when https://github.com/OpenRailAssociation/osrd-ui/issues/694 is merged
              if (!interpolatedRange) continue;

              if (i === 1 || cutPositions.length === 0) {
                cutPositions.push(interpolatedRange.spaceStart);
                cutTimes.push(interpolatedRange.timeStart);
              }
              cutPositions.push(interpolatedRange.spaceEnd);
              cutTimes.push(interpolatedRange.timeEnd);
            }

            return {
              positions: cutPositions,
              times: cutTimes,
            };
          }),
          signalUpdates: compact(
            train.signalUpdates.map((signal) => {
              const updatedSignalRange = cutSpaceTimeRect(
                {
                  spaceStart: signal.position_start,
                  spaceEnd: signal.position_end,
                  timeStart: signal.time_start,
                  timeEnd: signal.time_end,
                },
                firstPosition,
                lastPosition
              );

              if (!updatedSignalRange) return null;

              // TODO : remove reformatting the datas when https://github.com/OpenRailAssociation/osrd-ui/issues/694 is merged
              return {
                ...signal,
                position_start: updatedSignalRange.spaceStart,
                position_end: updatedSignalRange.spaceEnd,
                time_start: updatedSignalRange.timeStart,
                time_end: updatedSignalRange.timeEnd,
              };
            })
          ),
        }));

        filteredConflicts = compact(
          conflicts.map((conflict) => cutSpaceTimeRect(conflict, firstPosition, lastPosition))
        );

        return { filteredProjectPathTrainResult, filteredConflicts };
      }

      return { filteredProjectPathTrainResult, filteredConflicts };
    }, [waypointsPanelData?.filteredWaypoints, projectedTrains, conflicts]);

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
    defaultTimeOrigin: 0,
    defaultSpaceOrigin:
      (waypointsPanelData?.filteredWaypoints ?? operationalPoints).at(0)?.position || 0,
  });

  useEffect(() => {
    const trainUsedForProjection = projectPathTrainResult.find((train) =>
      train.id.includes(selectedProjectionId)
    );
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

  const occupancyBlocks = cutProjectedTrains.flatMap((train) => {
    const departureTime = train.departureTime.getTime();

    return train.signalUpdates.map((block) => ({
      timeStart: departureTime + block.time_start,
      timeEnd: departureTime + block.time_end,
      spaceStart: block.position_start,
      spaceEnd: block.position_end,
      color: ASPECT_LABELS_COLORS[block.aspect_label as AspectLabel],
      blinking: block.blinking,
    }));
  });

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
      dispatch(updateSelectedTrainId(draggedTrain.id));

      const timeDiff = payload.data.time - payload.initialData.time;

      let newDeparture = new Date(initialDepartureTime.getTime() + timeDiff);
      let draggedTrainId = draggedTrain.id;

      // if the dragged train is an occurrence, we need to update the first occurrence because the others are based on it
      if (isOccurrenceId(draggedTrain.id)) {
        const occurrencesIndex = extractOccurrenceIndexFromOccurrenceId(draggedTrain.id);
        const pacedTrainId = extractPacedTrainIdFromOccurrenceId(draggedTrain.id);
        const firstOccurrence = projectPathTrainResult.find(
          ({ id }) => isOccurrenceId(id) && extractPacedTrainIdFromOccurrenceId(id) === pacedTrainId
        );
        if (firstOccurrence && 'paced' in firstOccurrence) {
          newDeparture = dayjs(newDeparture)
            .add(occurrencesIndex * -firstOccurrence.paced.interval.ms, 'ms')
            .toDate();
          draggedTrainId = firstOccurrence.id;
        }
      }

      await handleTrainDrag(draggedTrainId, newDeparture, {
        stopPanning: !isPanning,
      });

      // stop dragging if necessary
      if (!isPanning) {
        setDraggingState(undefined);
      }
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
      if (train) {
        setDraggingState({
          draggedTrain: train,
          initialDepartureTime: train.departureTime,
        });
      } else {
        console.error(`No train found with id ${hoveredTrainId}`);
      }
    }

    // if no hovered train, we pan normally
    spaceTimeChartProps.onPan?.(payload);

    if (isPanning !== previousPanning) {
      setPreviousPanning(isPanning);
    }
  };

  const { waypointMenu, activeWaypointId, handleWaypointClick } = useWaypointMenu(
    activeWaypointRef,
    waypointsPanelData
  );

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
      (isSegmentPickingElement(hoveredItem.element) || isPointPickingElement(hoveredItem.element))
    ) {
      const hoveredTrainId = hoveredItem.element.pathId;
      if (isTrainId(hoveredTrainId) && selectedTrainId !== hoveredTrainId) {
        onTrainClick(hoveredTrainId);
      }
    }
  };

  return (
    <div data-testid="manchette-space-time-chart" className="manchette-space-time-chart-wrapper">
      <div className="header">
        {waypointsPanelData && (
          <>
            <ManchetteMenuButton setWaypointsPanelIsOpen={setWaypointsPanelIsOpen} />
            {waypointsPanelIsOpen && (
              <WaypointsPanel
                waypointsPanelIsOpen={waypointsPanelIsOpen}
                setWaypointsPanelIsOpen={setWaypointsPanelIsOpen}
                waypoints={operationalPoints}
                waypointsPanelData={waypointsPanelData}
              />
            )}
          </>
        )}
        {!allTrainsProjected && (
          <ProjectionLoadingMessage
            projectedTrainsNb={projectPathTrainResult.length}
            totalTrains={totalTrains}
          />
        )}
      </div>
      <div className="header-separator" />
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
              className={cx('zoom-button', { 'zoom-button-clicked': zoomMode })}
              onClick={toggleZoomMode}
            >
              <ZoomIn className="icon" />
            </button>
            <button
              type="button"
              className="menu-button"
              onClick={() => setShowSettingsPanel(true)}
            >
              <KebabHorizontal />
            </button>
          </div>
          {showSettingsPanel && (
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              onClose={() => setShowSettingsPanel(false)}
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
                key={path.id}
                path={path}
                {...getPathStyle(hoveredItem, path, !!draggingState, selectedTrainId)}
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
        value={xZoom}
        onChange={(e) => {
          handleXZoom(Number(e.target.value));
        }}
      />
    </div>
    /* TODO use margin or absolute to align with handle */
  );
};

export default ManchetteWithSpaceTimeChartWrapper;
