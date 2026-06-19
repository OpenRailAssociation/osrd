import {
  isPointPickingElement,
  isSegmentPickingElement,
  isOccupancyPickingElement,
  type HoveredItem,
  type SpaceTimeChartProps,
} from '@osrd-project/ui-charts';

import type { SimulatedException } from 'modules/trainSchedule/types';
import type { TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrain } from 'reducers/simulationResults';
import type { SelectionSource } from 'reducers/simulationResults/types';
import type { AppDispatch } from 'store';
import {
  extractEditoastIdFromPacedTrainId,
  extractPacedTrainIdFromOccurrenceId,
  isOccurrenceId,
  isTrainId,
} from 'utils/trainId';

import type { IndividualTrainProjection, TrainSpaceTimeData } from '../../../types';
import type { PanelSelectionMode } from '../CurveSelectionSidePanel';
import canDragHoveredTrain from './canDragHoveredTrain';
import { parseOccupancyZonePathId, type OccupancyZoneReference } from './zones';

/** Magnetic snap radius (in pixels) used to align a dragged occurrence onto the cadence grid. */
const SNAP_DISTANCE_PX = 8;

type DraggingState =
  | {
      draggedTrain: IndividualTrainProjection;
      initialDepartureTime: Date;
      /** Original exceptions captured at drag start — used to compute shifts without accumulation */
      originalPacedExceptions?: SimulatedException[];
      /** Cadence grid (model start + k × interval) a 'single'-mode occurrence snaps onto. */
      pacedGrid?: { startTimeMs: number; intervalMs: number };
    }
  | undefined;

/**
 * Snap a candidate time onto the nearest cadence grid line (`startTimeMs + k × intervalMs`)
 * when it is within `SNAP_DISTANCE_PX` pixels of it. `timeScale` is the chart scale in ms/px,
 * so the snap radius stays constant on screen whatever the zoom. Returns the candidate
 * unchanged when there is no grid or it is too far from a line.
 */
const snapToCadenceGrid = (
  candidateMs: number,
  grid: { startTimeMs: number; intervalMs: number } | undefined,
  timeScale: number
): number => {
  if (!grid || grid.intervalMs <= 0) return candidateMs;
  const k = Math.round((candidateMs - grid.startTimeMs) / grid.intervalMs);
  const gridMs = grid.startTimeMs + k * grid.intervalMs;
  return Math.abs(candidateMs - gridMs) <= SNAP_DISTANCE_PX * timeScale ? gridMs : candidateMs;
};

type ConfigureHandlePanParams = {
  spaceTimeChartOnPan?: SpaceTimeChartProps['onPan'];
  handleTrainDrag?: (args: {
    draggedTrainId: TrainId;
    initialDepartureTime: Date;
    newDepartureTime: Date;
    stopPanning: boolean;
    panelSelectionMode: PanelSelectionMode;
    originalPacedExceptions?: SimulatedException[];
  }) => Promise<void>;
  selectedTrainId?: TrainId;
  selectedTrainBy?: SelectionSource;
  panelSelectionMode: PanelSelectionMode;
  projectedTrains: IndividualTrainProjection[];
  draggingState: DraggingState;
  setDraggingState: (s: DraggingState) => void;
  hoveredItem: HoveredItem | null;
  previousPanning: boolean;
  setPreviousPanning: (v: boolean) => void;
  zoomMode: boolean;
  trainScheduleProjections: TrainSpaceTimeData[];
  occupancyZoneDragAndDrop?: {
    isDragging: boolean;
    onDragStart: (zoneRef: OccupancyZoneReference) => void;
    onDrop: () => void;
  };
  dispatch: AppDispatch;
};

export function configureHandlePan({
  spaceTimeChartOnPan,
  handleTrainDrag,
  selectedTrainId,
  selectedTrainBy,
  panelSelectionMode,
  projectedTrains,
  draggingState,
  setDraggingState,
  hoveredItem,
  previousPanning,
  setPreviousPanning,
  zoomMode,
  trainScheduleProjections,
  occupancyZoneDragAndDrop,
  dispatch,
}: ConfigureHandlePanParams): NonNullable<SpaceTimeChartProps['onPan']> {
  return async (payload) => {
    const { isPanning } = payload;

    if (!handleTrainDrag) {
      // if no handleTrainDrag, we pan normally
      spaceTimeChartOnPan?.(payload);
      return;
    }

    // If dragging
    if (draggingState) {
      const { draggedTrain, initialDepartureTime, originalPacedExceptions, pacedGrid } =
        draggingState;

      // In 'all' mode, selectedTrainId is a PacedTrainId — don't overwrite it with the occurrence id
      if (draggedTrain.id !== selectedTrainId && panelSelectionMode !== 'all') {
        dispatch(updateSelectedTrain({ id: draggedTrain.id, by: 'std' }));
      }

      // Snap onto the cadence grid (single mode) so an occurrence can be re-aligned — and made
      // conforming — without pixel-perfect aiming.
      const snappedMs = snapToCadenceGrid(
        initialDepartureTime.getTime() + payload.data.time - payload.initialData.time,
        pacedGrid,
        payload.context.timeScale
      );
      const newDepartureTime = new Date(snappedMs);

      // stop dragging if necessary
      if (!isPanning) {
        setDraggingState(undefined);
      }

      await handleTrainDrag({
        draggedTrainId: draggedTrain.id,
        initialDepartureTime,
        newDepartureTime,
        stopPanning: !isPanning,
        panelSelectionMode,
        originalPacedExceptions,
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
      !occupancyZoneDragAndDrop?.isDragging &&
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

      // Gate: drag is only allowed when the selected train has blue curves (by === 'std')
      if (
        selectedTrainBy === 'std' &&
        canDragHoveredTrain({ panelSelectionMode, hoveredTrain: train, selectedTrainId })
      ) {
        let initialDepartureTime = train.departureTime;
        let originalPacedExceptions: SimulatedException[] | undefined;
        let pacedGrid: { startTimeMs: number; intervalMs: number } | undefined;
        if (isOccurrenceId(hoveredTrainId)) {
          const editoastId = extractEditoastIdFromPacedTrainId(
            extractPacedTrainIdFromOccurrenceId(hoveredTrainId)
          );
          const modelTrain = trainScheduleProjections.find((t) => t.id === editoastId);
          if (modelTrain) {
            // 'all' and 'compliant' move the whole model: anchor on the model departure so
            // handleTrainDrag receives the model's absolute new departure (no frame accumulation).
            if (panelSelectionMode !== 'single') {
              initialDepartureTime = modelTrain.departureTime;
            }
            // 'single' and 'all' shift exceptions: capture their pre-drag values as a stable base.
            if (panelSelectionMode !== 'compliant') {
              originalPacedExceptions = modelTrain.paced?.exceptions;
            }
            // 'single' snaps the occurrence onto the model's cadence grid.
            if (panelSelectionMode === 'single' && modelTrain.paced) {
              pacedGrid = {
                startTimeMs: modelTrain.departureTime.getTime(),
                intervalMs: modelTrain.paced.interval.ms,
              };
            }
          }
        }

        setDraggingState({
          draggedTrain: train,
          initialDepartureTime,
          originalPacedExceptions,
          pacedGrid,
        });
      }
    }

    if (occupancyZoneDragAndDrop) {
      if (
        isPanning &&
        !previousPanning &&
        !occupancyZoneDragAndDrop.isDragging &&
        !zoomMode &&
        hoveredItem &&
        isOccupancyPickingElement(hoveredItem.element)
      ) {
        occupancyZoneDragAndDrop.onDragStart(parseOccupancyZonePathId(hoveredItem.element.pathId));
        return;
      }

      if (occupancyZoneDragAndDrop?.isDragging) {
        if (!isPanning) {
          occupancyZoneDragAndDrop.onDrop();
        }
        return;
      }
    }

    // if no hovered train (or drag not started), we pan normally
    spaceTimeChartOnPan?.(payload);

    if (isPanning !== previousPanning) {
      setPreviousPanning(isPanning);
    }
  };
}
