import {
  isPointPickingElement,
  isSegmentPickingElement,
  isOccupancyPickingElement,
  type HoveredItem,
  type SpaceTimeChartProps,
} from '@osrd-project/ui-charts';

import type { SimulatedException } from 'modules/trainSchedule/types';
import type { TrainId } from 'reducers/osrdconf/types';
import type { SelectionSource } from 'reducers/simulationResults/types';
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
 * Snap a candidate departure time when it is within `SNAP_DISTANCE_PX` pixels of a magnetic line:
 * first the nearest cadence grid line (`startTimeMs + k × intervalMs`), then the train's pre-drag
 * departure `originMs`. The cadence keeps priority so re-aligning an occurrence onto the grid stays
 * easy; the origin lets a drag back to the start land exactly on it, with no leftover
 * pixel-rounding diff that would trigger a no-op PUT. `timeScale` is the chart scale in ms/px, so
 * the snap radius stays constant on screen whatever the zoom.
 */
const snapDepartureTime = (
  candidateMs: number,
  originMs: number,
  pacedGrid: { startTimeMs: number; intervalMs: number } | undefined,
  timeScale: number
): number => {
  const radiusMs = SNAP_DISTANCE_PX * timeScale;
  if (pacedGrid && pacedGrid.intervalMs > 0) {
    const k = Math.round((candidateMs - pacedGrid.startTimeMs) / pacedGrid.intervalMs);
    const cadenceMs = pacedGrid.startTimeMs + k * pacedGrid.intervalMs;
    if (Math.abs(candidateMs - cadenceMs) <= radiusMs) return cadenceMs;
  }
  return Math.abs(candidateMs - originMs) <= radiusMs ? originMs : candidateMs;
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

      // Snap onto the cadence grid (single mode) so an occurrence can be re-aligned — and made
      // conforming — without pixel-perfect aiming, or back onto the pre-drag departure.
      const snappedMs = snapDepartureTime(
        initialDepartureTime.getTime() + payload.data.time - payload.initialData.time,
        initialDepartureTime.getTime(),
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
        throw new Error(`No train found with id ${hoveredTrainId}`);
      }

      if (
        canDragHoveredTrain({
          panelSelectionMode,
          hoveredTrain: train,
          selectedTrainId,
          selectedTrainBy,
          relevantExceptionType: 'start_time',
        })
      ) {
        let initialDepartureTime = train.departureTime;
        let originalPacedExceptions: SimulatedException[] | undefined;
        let pacedGrid: { startTimeMs: number; intervalMs: number } | undefined;
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
        return;
      }
    }

    if (occupancyZoneDragAndDrop) {
      if (occupancyZoneDragAndDrop.isDragging) {
        if (!isPanning) {
          occupancyZoneDragAndDrop.onDrop();
        }
        return;
      }

      if (
        isPanning &&
        !previousPanning &&
        !zoomMode &&
        hoveredItem &&
        isOccupancyPickingElement(hoveredItem.element)
      ) {
        const zoneRef = parseOccupancyZonePathId(hoveredItem.element.pathId);
        const hoveredZoneTrain = projectedTrains.find(
          (projectedTrain) => projectedTrain.id === zoneRef.trainId
        );
        if (!hoveredZoneTrain) {
          throw new Error(`No train found with id ${zoneRef.trainId}`);
        }

        if (
          canDragHoveredTrain({
            panelSelectionMode,
            hoveredTrain: hoveredZoneTrain,
            selectedTrainId,
            selectedTrainBy,
            relevantExceptionType: 'path_and_schedule',
          })
        ) {
          occupancyZoneDragAndDrop.onDragStart(zoneRef);
          return;
        }
      }
    }

    // if no hovered train (or drag not started), we pan normally
    spaceTimeChartOnPan?.(payload);

    if (isPanning !== previousPanning) {
      setPreviousPanning(isPanning);
    }
  };
}
