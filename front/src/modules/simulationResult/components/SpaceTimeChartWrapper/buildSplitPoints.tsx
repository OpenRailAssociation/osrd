import {
  BASE_WAYPOINT_HEIGHT,
  DEFAULT_THEME,
  TRACK_HEIGHT_CONTAINER,
  TrackOccupancyCanvas,
  TrackOccupancyManchette,
  WaypointComponent,
  type SplitPoint,
} from '@osrd-project/ui-charts';
import { keyBy, sortBy } from 'lodash';

import type { CategoryColors } from 'applications/operationalStudies/types';
import { Spinner } from 'common/Loaders';
import getPathStyleV2 from 'modules/simulationResult/helpers/getPathStyleV2';
import type { TrainId } from 'reducers/osrdconf/types';
import type { SelectedTrain } from 'reducers/simulationResults/types';
import { extractTrainScheduleIdFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

import type { PanelSelectionMode } from './CurveSelectionSidePanel';
import type { MovableOccupancyZone, DeployedWaypoint } from './helpers/zones';

type Path = {
  id: string;
  label: string;
  points: { time: number; position: number }[];
  colors: CategoryColors;
  isSimulated?: boolean;
};

type BuildSplitPointsProps = {
  occupancyZonesLayers: DeployedWaypoint[] | undefined;
  paths: Path[];
  activeWaypointRef?: React.RefObject<HTMLDivElement | null>;
  selectedTrain?: SelectedTrain;
  panelMode?: PanelSelectionMode;
  onCloseOccupancyLayer?: (waypointId: string) => void;
  handleWaypointClick?: (waypointId: string) => void;
  activeWaypointId?: string;
  hoveredTrainIdForChart?: TrainId;
  isDraggingOccupancyZoneId?: (waypointId: string, trainId: TrainId) => boolean;
  activeTrackId?: string;
  onTrackDragOver?: (trackId: string | undefined) => void;
};

export function buildSplitPoints({
  occupancyZonesLayers,
  paths,
  activeWaypointRef,
  selectedTrain,
  panelMode,
  onCloseOccupancyLayer,
  handleWaypointClick,
  activeWaypointId,
  hoveredTrainIdForChart,
  isDraggingOccupancyZoneId,
  activeTrackId,
  onTrackDragOver,
}: BuildSplitPointsProps): SplitPoint[] {
  if (!occupancyZonesLayers?.length) return [];

  const pathsById = keyBy(paths, ({ id }) => id);

  const countZonesByTrainScheduleId = (zones: MovableOccupancyZone[] = []) => {
    const counts = new Map<TrainId, Map<string, number>>();
    for (const zone of zones) {
      if (isOccurrenceId(zone.trainId)) {
        const trainScheduleId = extractTrainScheduleIdFromOccurrenceId(zone.trainId);
        const trainScheduleIdCounts = counts.get(trainScheduleId) ?? new Map();
        trainScheduleIdCounts.set(zone.trackId, (trainScheduleIdCounts.get(zone.trackId) ?? 0) + 1);
        counts.set(trainScheduleId, trainScheduleIdCounts);
      }
    }
    return counts;
  };

  return sortBy(
    occupancyZonesLayers,
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
    }) => {
      const baseZones = zones ?? [];
      const zonesCountByTrainScheduleId = countZonesByTrainScheduleId(baseZones);

      const occupancyZones = baseZones.flatMap((zone) => {
        const isHovered = hoveredTrainIdForChart === zone.trainId;
        let totalOccurrencesOnTrack = 0;
        if (isOccurrenceId(zone.trainId)) {
          const trainScheduleId = extractTrainScheduleIdFromOccurrenceId(zone.trainId);
          totalOccurrencesOnTrack =
            zonesCountByTrainScheduleId.get(trainScheduleId)?.get(zone.trackId) ?? 0;
        }

        const path = pathsById[zone.trainId];
        // No matching curve on the STD (e.g. a disabled occurrence): skip this zone instead of
        // showing it in the TOD without a curveStyle.
        if (!path) return [];

        const curveStyle = getPathStyleV2(
          {
            chart: 'tod',
            train: { id: zone.trainId, exceptionType: zone.exceptionType },
            selection: selectedTrain,
            panelMode,
            hover: hoveredTrainIdForChart
              ? {
                  trainId: hoveredTrainIdForChart,
                  from: 'tod',
                  exceptionType: zone.exceptionType,
                }
              : undefined,
          },
          { colors: path.colors, isSimulated: path.isSimulated }
        );

        return [
          {
            ...zone,
            trailingText:
              isHovered && totalOccurrencesOnTrack > 1
                ? `+${Math.max(0, totalOccurrencesOnTrack - 1)}`
                : undefined,
            curveStyle,
          },
        ];
      });

      const waypoint = {
        id: waypointId,
        name: (
          <div className="d-flex flex-row align-items-center">
            {operationalPointName || operationalPointId}
            {loading && <Spinner className="ml-2 small" spinnerClassName="spinner-border-sm" />}
          </div>
        ),
        position: operationalPointPosition,
        onClick: handleWaypointClick,
      };

      const isDraggingOccupancyZone = (zone: MovableOccupancyZone) => {
        if (!isDraggingOccupancyZoneId) {
          return false;
        }
        return isDraggingOccupancyZoneId(waypointId, zone.trainId);
      };

      return {
        id: operationalPointId,
        position: operationalPointPosition,
        size: (tracks?.length || 0) * TRACK_HEIGHT_CONTAINER + DEFAULT_THEME.timeCaptionsSize,
        spaceTimeChartNode: (
          <TrackOccupancyCanvas
            position={operationalPointPosition}
            tracks={tracks || []}
            occupancyZones={occupancyZones.filter((zone) => !isDraggingOccupancyZone(zone))}
            draggingOccupancyZones={occupancyZones.filter(isDraggingOccupancyZone)}
            onClose={() => onCloseOccupancyLayer?.(waypointId)}
            onDragOver={onTrackDragOver}
            topPadding={BASE_WAYPOINT_HEIGHT}
          />
        ),
        manchetteNode: (
          <TrackOccupancyManchette tracks={tracks || []} activeTrackId={activeTrackId}>
            <WaypointComponent
              waypoint={waypoint}
              waypointRef={waypointId === activeWaypointId ? activeWaypointRef : undefined}
              isActive={waypointId === activeWaypointId}
              isMenuActive={false}
            />
          </TrackOccupancyManchette>
        ),
      };
    }
  );
}
