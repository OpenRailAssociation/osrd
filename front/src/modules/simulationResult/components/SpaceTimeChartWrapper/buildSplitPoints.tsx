import {
  BASE_WAYPOINT_HEIGHT,
  DEFAULT_THEME,
  TRACK_HEIGHT_CONTAINER,
  TrackOccupancyCanvas,
  TrackOccupancyManchette,
  WaypointComponent,
  type HoveredItem,
  type OccupancyZone,
  type SplitPoint,
  type Track,
} from '@osrd-project/ui-charts';
import { keyBy, sortBy } from 'lodash';

import type { CategoryColors } from 'applications/operationalStudies/types';
import { Spinner } from 'common/Loaders';
import type { TrainId } from 'reducers/osrdconf/types';
import { extractTrainScheduleIdFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

import getPathStyle from './helpers/getPathStyle';
import { parseOccupancyZonePathId, formatOccupancyZonePathId } from './helpers/zones';

type OccupancyZonesLayers = {
  waypointId: string;
  operationalPointId: string;
  operationalPointPosition: number;
  operationalPointName?: string;
  zones?: OccupancyZone[];
  tracks?: Track[];
  loading?: boolean;
};

type Path = {
  id: string;
  label: string;
  points: { time: number; position: number }[];
  colors: CategoryColors;
};

export function buildSplitPoints(
  occupancyZonesLayers: OccupancyZonesLayers[] | undefined,
  paths: Path[],
  hoveredItem: HoveredItem | null,
  isDragging: boolean,
  activeWaypointRef?: React.RefObject<HTMLDivElement | null>,
  selectedTrainId?: TrainId,
  onCloseOccupancyLayer?: (waypointId: string) => void,
  handleWaypointClick?: (waypointId: string) => void,
  activeWaypointId?: string,
  hoveredTrainIdForChart?: TrainId,
  hoveredTrainId?: TrainId,
  isDraggingOccupancyZoneId?: (waypointId: string, trainId: TrainId) => boolean,
  activeTrackId?: string,
  onTrackDragOver?: (trackId: string | undefined) => void
): SplitPoint[] {
  if (!occupancyZonesLayers?.length) return [];

  const pathsById = keyBy(paths, ({ id }) => id);

  const countZonesByTrainScheduleId = (zones: OccupancyZone[] = []) => {
    const counts = new Map<TrainId, Map<string, number>>();
    for (const zone of zones) {
      const { trainId } = parseOccupancyZonePathId(zone.pathId);
      if (isOccurrenceId(trainId)) {
        const pacedTrainId = extractTrainScheduleIdFromOccurrenceId(trainId);
        const pacedTrainIdCounts = counts.get(pacedTrainId) ?? new Map();
        pacedTrainIdCounts.set(zone.trackId, (pacedTrainIdCounts.get(zone.trackId) ?? 0) + 1);
        counts.set(pacedTrainId, pacedTrainIdCounts);
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
      const occupancyZones = (zones || []).map((zone) => {
        const baseZones = zones ?? [];
        const zonesCountByPacedTrainId = countZonesByTrainScheduleId(baseZones);
        const { trainId } = parseOccupancyZonePathId(zone.pathId);

        const isHovered = hoveredTrainIdForChart === trainId;
        const isSelected = selectedTrainId === trainId;
        let totalOccurrencesOnTrack = 0;
        if (isOccurrenceId(trainId)) {
          const pacedTrainId = extractTrainScheduleIdFromOccurrenceId(trainId);
          totalOccurrencesOnTrack =
            zonesCountByPacedTrainId.get(pacedTrainId)?.get(zone.trackId) ?? 0;
        }
        const path = pathsById[trainId];
        if (!path) return zone;
        const style = getPathStyle(hoveredItem, path, isDragging, selectedTrainId, hoveredTrainId);
        return {
          ...zone,
          trailingText:
            isHovered && totalOccurrencesOnTrack > 1
              ? `+${Math.max(0, totalOccurrencesOnTrack - 1)}`
              : undefined,
          curveStyle: {
            ...zone.curveStyle,
            color: style.color,
            width: isSelected || isHovered ? 2 : undefined,
            opacity: 1,
          },
        };
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

      const selectedPathId = selectedTrainId
        ? formatOccupancyZonePathId({ waypointId, trainId: selectedTrainId })
        : undefined;

      const isDraggingOccupancyZone = (zone: OccupancyZone) => {
        if (!isDraggingOccupancyZoneId) {
          return false;
        }
        const { trainId } = parseOccupancyZonePathId(zone.pathId);
        return isDraggingOccupancyZoneId(waypointId, trainId);
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
            selectedPathId={selectedPathId}
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
