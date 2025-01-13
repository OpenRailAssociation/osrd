import { useMemo, useRef, useState, useCallback, useEffect } from 'react';

import { Slider } from '@osrd-project/ui-core';
import { KebabHorizontal, Iterations } from '@osrd-project/ui-icons';
import Manchette, { type WaypointMenuData } from '@osrd-project/ui-manchette';
import {
  useManchettesWithSpaceTimeChart,
  timeScaleToZoomValue,
  DEFAULT_ZOOM_MS_PER_PX,
} from '@osrd-project/ui-manchette-with-spacetimechart';
import {
  ConflictLayer,
  PathLayer,
  SpaceTimeChart,
  WorkScheduleLayer,
  OccupancyBlockLayer,
} from '@osrd-project/ui-spacetimechart';
import type { Conflict } from '@osrd-project/ui-spacetimechart';
import type {
  SpaceTimeChartProps,
  HoveredItem,
} from '@osrd-project/ui-spacetimechart/dist/lib/types';
import cx from 'classnames';
import { compact } from 'lodash';
import { createPortal } from 'react-dom';

import type { OperationalPoint, TrainSpaceTimeData } from 'applications/operationalStudies/types';
import upward from 'assets/pictures/workSchedules/ScheduledMaintenanceUp.svg';
import type { PostWorkSchedulesProjectPathApiResponse } from 'common/api/osrdEditoastApi';
import OSRDMenu from 'common/OSRDMenu';
import cutSpaceTimeRect from 'modules/simulationResult/components/SpaceTimeChart/helpers/utils';
import { ASPECT_LABELS_COLORS } from 'modules/simulationResult/consts';
import type {
  AspectLabel,
  LayerRangeData,
  WaypointsPanelData,
} from 'modules/simulationResult/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';

import SettingsPanel from './SettingsPanel';
import { getIdFromTrainPath, getPathStyle } from './utils';
import ManchetteMenuButton from '../SpaceTimeChart/ManchetteMenuButton';
import ProjectionLoadingMessage from '../SpaceTimeChart/ProjectionLoadingMessage';
import useWaypointMenu from '../SpaceTimeChart/useWaypointMenu';
import WaypointsPanel from '../SpaceTimeChart/WaypointsPanel';

type ManchetteWithSpaceTimeChartProps = {
  operationalPoints: OperationalPoint[];
  projectPathTrainResult: TrainSpaceTimeData[];
  selectedTrainScheduleId?: number;
  waypointsPanelData?: WaypointsPanelData;
  conflicts?: Conflict[];
  workSchedules?: PostWorkSchedulesProjectPathApiResponse;
  projectionLoaderData: {
    totalTrains: number;
    allTrainsProjected: boolean;
  };
  handleTrainDrag?: (
    draggedTrainId: number,
    newDepartureTime: Date,
    { stopPanning }: { stopPanning: boolean }
  ) => Promise<void>;
  height?: number;
  onTrainClick?: (trainId: number) => void;
};

export const MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT = 561;
const BOTTOM_TOOLBAR_HEIGHT = 40;
const SPACE_TIME_CHART_DIFF_HEIGHT = 8;

const ManchetteWithSpaceTimeChartWrapper = ({
  operationalPoints,
  projectPathTrainResult,
  selectedTrainScheduleId,
  waypointsPanelData,
  conflicts = [],
  workSchedules,
  projectionLoaderData: { totalTrains, allTrainsProjected },
  height = MANCHETTE_WITH_SPACE_TIME_CHART_DEFAULT_HEIGHT,
  handleTrainDrag,
  onTrainClick,
}: ManchetteWithSpaceTimeChartProps) => {
  const dispatch = useAppDispatch();

  const manchetteWithSpaceTimeCharWrappertRef = useRef<HTMLDivElement>(null);
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);

  const [hoveredItem, setHoveredItem] = useState<null | HoveredItem>(null);
  const [draggingState, setDraggingState] = useState<{
    draggedTrain: TrainSpaceTimeData;
    initialDepartureTime: Date;
  }>();
  const spaceTimeChartRef = useRef<HTMLDivElement>(null);

  const [waypointsPanelIsOpen, setWaypointsPanelIsOpen] = useState(false);

  const [tmpSelectedTrain, setTmpSelectedTrain] = useState(selectedTrainScheduleId);
  useEffect(() => {
    setTmpSelectedTrain(selectedTrainScheduleId);
  }, [selectedTrainScheduleId]);

  // Cut the space time chart curves if the first or last waypoints are hidden
  const { filteredProjectPathTrainResult: cutProjectedTrains, filteredConflicts: cutConflicts } =
    useMemo(() => {
      let filteredProjectPathTrainResult = projectPathTrainResult;
      let filteredConflicts = conflicts;

      if (!waypointsPanelData || waypointsPanelData.filteredWaypoints.length < 2)
        return { filteredProjectPathTrainResult, filteredConflicts };

      const { filteredWaypoints } = waypointsPanelData;
      const firstPosition = filteredWaypoints.at(0)!.position;
      const lastPosition = filteredWaypoints.at(-1)!.position;

      if (firstPosition !== 0 || lastPosition !== operationalPoints.at(-1)!.position) {
        filteredProjectPathTrainResult = projectPathTrainResult.map((train) => ({
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
    }, [waypointsPanelData?.filteredWaypoints, projectPathTrainResult, conflicts]);

  const manchetteWaypoints = useMemo(() => {
    const rawWaypoints = waypointsPanelData?.filteredWaypoints ?? operationalPoints;
    return rawWaypoints.map((waypoint) => ({
      id: waypoint.id,
      position: waypoint.position,
      name: waypoint.extensions?.identifier?.name,
      secondaryCode: waypoint.extensions?.sncf?.ch,
      weight: waypoint.weight ?? 0,
    }));
  }, [waypointsPanelData, operationalPoints]);

  const { manchetteProps, spaceTimeChartProps, handleScroll, handleXZoom, xZoom } =
    useManchettesWithSpaceTimeChart(
      manchetteWaypoints,
      cutProjectedTrains,
      manchetteWithSpaceTimeChartRef,
      tmpSelectedTrain,
      height,
      spaceTimeChartRef
    );

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
    }));
  });

  const onPanOverloaded: SpaceTimeChartProps['onPan'] = async (payload) => {
    const { isPanning } = payload;

    if (!handleTrainDrag) {
      // if no handleTrainDrag, we pan normally
      spaceTimeChartProps.onPan(payload);
      return;
    }

    // if dragging
    if (draggingState) {
      const { draggedTrain, initialDepartureTime } = draggingState;
      dispatch(updateSelectedTrainId(draggedTrain.id));

      const timeDiff = payload.data.time - payload.initialData.time;
      const newDeparture = new Date(initialDepartureTime.getTime() + timeDiff);

      await handleTrainDrag(draggedTrain.id, newDeparture, { stopPanning: !isPanning });

      // stop dragging if necessary
      if (!isPanning) {
        setDraggingState(undefined);
      }
      return;
    }

    // if not dragging, we check if we should start dragging
    if (hoveredItem && 'pathId' in hoveredItem.element) {
      const hoveredTrainId = getIdFromTrainPath(hoveredItem.element.pathId);
      const train = projectPathTrainResult.find((res) => res.id === hoveredTrainId);
      if (train) {
        setTmpSelectedTrain(train.id);
        setDraggingState({
          draggedTrain: train,
          initialDepartureTime: train.departureTime,
        });
      } else {
        console.error(`No train found with id ${hoveredTrainId}`);
      }
    }

    // if no hovered train, we pan normally
    spaceTimeChartProps.onPan(payload);
  };

  const waypointMenuData = useWaypointMenu(waypointsPanelData);

  const manchettePropsWithWaypointMenu = useMemo(
    () => ({
      ...manchetteProps,
      waypoints: manchetteProps.waypoints.map((waypoint) => ({
        ...waypoint,
        onClick: waypointMenuData.handleWaypointClick,
      })),
      waypointMenuData: {
        menu: <OSRDMenu menuRef={waypointMenuData.menuRef} items={waypointMenuData.menuItems} />,
        activeWaypointId: waypointMenuData.activeWaypointId,
        manchetteWrapperRef: manchetteWithSpaceTimeCharWrappertRef,
      } as WaypointMenuData,
    }),
    [manchetteProps, waypointMenuData]
  );

  const handleHoveredChildUpdate: SpaceTimeChartProps['onHoveredChildUpdate'] = useCallback(
    ({ item }: { item: HoveredItem | null }) => {
      setHoveredItem(item);
    },
    [setHoveredItem]
  );

  const handleClick: SpaceTimeChartProps['onClick'] = () => {
    if (!draggingState && hoveredItem && 'pathId' in hoveredItem.element) {
      if (selectedTrainScheduleId !== Number(hoveredItem.element.pathId)) {
        const trainId = getIdFromTrainPath(hoveredItem.element.pathId);
        onTrainClick?.(trainId);
      }
    }
  };

  return (
    <div ref={manchetteWithSpaceTimeCharWrappertRef} className="manchette-space-time-chart-wrapper">
      {waypointMenuData.activeWaypointId &&
        manchetteWithSpaceTimeCharWrappertRef.current &&
        createPortal(
          <div
            style={{
              width: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
            }}
          />,
          manchetteWithSpaceTimeCharWrappertRef.current
        )}
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
        className={cx('manchette flex', {
          'no-scroll': !!waypointMenuData.activeWaypointId,
        })}
        style={{ height }}
        onScroll={handleScroll}
      >
        <Manchette {...manchettePropsWithWaypointMenu} height={height - BOTTOM_TOOLBAR_HEIGHT} />
        <div
          ref={spaceTimeChartRef}
          className="space-time-chart-container"
          style={{
            bottom: 0,
            left: 0,
            top: 2,
            height: height - SPACE_TIME_CHART_DIFF_HEIGHT,
          }}
        >
          <div className="toolbar">
            <button
              type="button"
              className="reset-button"
              onClick={() => handleXZoom(timeScaleToZoomValue(DEFAULT_ZOOM_MS_PER_PX))}
            >
              <Iterations />
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
            spaceOrigin={
              (waypointsPanelData?.filteredWaypoints ?? operationalPoints).at(0)?.position || 0
            }
            timeOrigin={Math.min(...projectPathTrainResult.map((p) => +p.departureTime))}
            {...spaceTimeChartProps}
            onPan={onPanOverloaded}
            onClick={handleClick}
            onHoveredChildUpdate={handleHoveredChildUpdate}
          >
            {spaceTimeChartProps.paths.map((path) => (
              <PathLayer
                key={path.id}
                path={path}
                {...getPathStyle(hoveredItem, path, !!draggingState)}
              />
            ))}
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
