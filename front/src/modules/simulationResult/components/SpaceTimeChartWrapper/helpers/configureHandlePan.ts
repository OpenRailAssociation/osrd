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
  extractEditoastIdFromTrainScheduleId,
  extractTrainScheduleIdFromOccurrenceId,
  isOccurrenceId,
  isTrainId,
} from 'utils/trainId';

import type { IndividualTrainProjection, TrainSpaceTimeData } from '../../../types';
import type { PanelSelectionMode } from '../CurveSelectionSidePanel';
import canDragHoveredTrain from './canDragHoveredTrain';
import { parseOccupancyZonePathId, type OccupancyZoneReference } from './zones';

/** Magnetic snap radius (in pixels) used to align a dragged occurrence onto the cadence grid. */
const SNAP_DISTANCE_PX = 8;

/**
 * Line(s) a dragged train magnetically snaps onto: the repeating cadence `startTimeMs + k ×
 * intervalMs`, or the single `startTimeMs` line when `intervalMs` is absent. `originMs` is a
 * fallback line (the train's own pre-drag time) used only when no cadence line is in range, so an
 * off-grid occurrence can still land exactly back where it started.
 */
type SnapGrid = { startTimeMs: number; intervalMs?: number; originMs?: number };

type DraggingState =
  | {
      draggedTrain: IndividualTrainProjection;
      initialDepartureTime: Date;
      /** Original exceptions captured at drag start — used to compute shifts without accumulation */
      originalPacedExceptions?: SimulatedException[];
      /**
       * Cadence grid (model start + k × interval) a dragged train snaps onto. Set with
       * `intervalMs` for a 'single'-mode occurrence (repeating cadence lines), or without it for
       * the model train (compliant/all modes, or a direct model-curve drag) so the train snaps
       * back exactly onto its pre-drag position instead of drifting by pixel-rounding jitter.
       */
      pacedGrid?: SnapGrid;
    }
  | undefined;

/**
 * Snap a candidate time onto the nearest grid line (`startTimeMs + k × intervalMs`, or just
 * `startTimeMs` when `intervalMs` is absent) when it is within `SNAP_DISTANCE_PX` pixels of it.
 * `timeScale` is the chart scale in ms/px, so the snap radius stays constant on screen whatever
 * the zoom. Falls back to `grid.originMs` when it is in range and the cadence line is not — the
 * cadence keeps priority so re-aligning an occurrence that started near a grid line stays easy.
 * Returns the candidate unchanged when there is no grid or it is too far from every line.
 */
const snapToCadenceGrid = (
  candidateMs: number,
  grid: SnapGrid | undefined,
  timeScale: number
): number => {
  if (!grid) return candidateMs;
  const radiusMs = SNAP_DISTANCE_PX * timeScale;
  const cadenceMs =
    grid.intervalMs && grid.intervalMs > 0
      ? grid.startTimeMs +
        Math.round((candidateMs - grid.startTimeMs) / grid.intervalMs) * grid.intervalMs
      : grid.startTimeMs;
  if (Math.abs(candidateMs - cadenceMs) <= radiusMs) return cadenceMs;
  if (grid.originMs !== undefined && Math.abs(candidateMs - grid.originMs) <= radiusMs) {
    return grid.originMs;
  }
  return candidateMs;
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
  setDragOffsetMs: (ms: number | null) => void;
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
  setDragOffsetMs,
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

      setDragOffsetMs(snappedMs - initialDepartureTime.getTime());

      // stop dragging if necessary
      if (!isPanning) {
        setDraggingState(undefined);
        setDragOffsetMs(null);
        setPreviousPanning(false);
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
        let pacedGrid: SnapGrid | undefined;
        if (isOccurrenceId(hoveredTrainId)) {
          const editoastId = extractEditoastIdFromTrainScheduleId(
            extractTrainScheduleIdFromOccurrenceId(hoveredTrainId)
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
            // 'single' snaps the occurrence onto the model's cadence grid, with its own pre-drag
            // time as a fallback line: an occurrence that is already an exception sits off the
            // cadence, and without it a drag back onto its origin would still trigger a PUT.
            if (panelSelectionMode === 'single' && modelTrain.paced) {
              pacedGrid = {
                startTimeMs: modelTrain.departureTime.getTime(),
                intervalMs: modelTrain.paced.interval.ms,
                originMs: initialDepartureTime.getTime(),
              };
            }
          }
        }
        // Model train (compliant/all modes, or a direct model-curve drag): snap back onto its
        // own pre-drag departure so a drag ending at +0 lands exactly on it, with no leftover
        // pixel-rounding diff that would otherwise still trigger a PUT.
        pacedGrid ??= { startTimeMs: initialDepartureTime.getTime() };

        setDraggingState({
          draggedTrain: train,
          initialDepartureTime,
          originalPacedExceptions,
          pacedGrid,
        });
        return;
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
