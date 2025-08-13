/* eslint-disable import/prefer-default-export */
import type { PathLevel, HoveredItem, Conflict, OccupancyBlock } from '@osrd-project/ui-charts';
import dayjs from 'dayjs';
import { compact } from 'lodash';

import type { SubCategory } from 'common/api/osrdEditoastApi';
import isMainCategory from 'modules/rollingStock/helpers/category';
import {
  ASPECT_LABELS_COLORS,
  DEFAULT_TRAIN_PATH_COLORS,
  TRAIN_MAIN_CATEGORY_PATH_COLORS,
} from 'modules/simulationResult/consts';
import type {
  AspectLabel,
  LayerRangeData,
  PathOperationalPoint,
  TrainSpaceTimeData,
  WaypointsPanelData,
} from 'modules/simulationResult/types';
import type { TimetableItemWithDetails } from 'modules/timetableItem/components/Timetable/types';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import {
  getOccurrencesNb,
  findExceptionWithOccurrenceId,
} from 'modules/timetableItem/helpers/pacedTrain';
import type { TrainId } from 'reducers/osrdconf/types';
import {
  extractPacedTrainIdFromOccurrenceId,
  formatPacedTrainIdToIndexedOccurrenceId,
  isOccurrenceId,
  isTrainScheduleProjection,
} from 'utils/trainId';

import { cutSpaceTimeRect } from '../SpaceTimeChart/helpers/utils';

export const getPathStyle = (
  hovered: HoveredItem | null,
  train: { color: string; id: string },
  dragging: boolean,
  subCategories: SubCategory[],
  timetableItemsWithDetails?: TimetableItemWithDetails[],
  selectedTrainId?: TrainId
): {
  color: string;
  level?: PathLevel;
  border?: {
    offset: number;
    color: string;
    width?: number;
    backgroundColor?: string;
  };
} => {
  const timetableItemId = isOccurrenceId(train.id)
    ? extractPacedTrainIdFromOccurrenceId(train.id)
    : train.id;
  const item = timetableItemsWithDetails?.find((t) => t.id === timetableItemId);
  const category = item?.category;

  const currentSubCategory =
    category && !isMainCategory(category)
      ? subCategories.find((option) => option.code === category.sub_category_code)
      : undefined;

  let colors = DEFAULT_TRAIN_PATH_COLORS;

  if (category && isMainCategory(category)) {
    colors = TRAIN_MAIN_CATEGORY_PATH_COLORS[category.main_category];
  } else if (category && !isMainCategory(category) && currentSubCategory) {
    colors = {
      normal: currentSubCategory.color || DEFAULT_TRAIN_PATH_COLORS.normal,
      hovered: currentSubCategory.hovered_color || DEFAULT_TRAIN_PATH_COLORS.hovered,
      background: currentSubCategory.background_color || DEFAULT_TRAIN_PATH_COLORS.background,
    };
  }

  if (hovered && 'pathId' in hovered.element && !dragging) {
    const hoveredTrainId = hovered.element.pathId as TrainId;

    if (
      train.id === hoveredTrainId ||
      // if the hovered train is an occurrence from the same paced train, apply the hovered style
      (isOccurrenceId(hoveredTrainId) &&
        timetableItemId === extractPacedTrainIdFromOccurrenceId(hoveredTrainId))
    ) {
      return { color: colors.hovered, level: 1 };
    }
  }
  // Apply occurrence style if selectedTrainId is an occurrence from the same paced
  if (selectedTrainId) {
    if (isOccurrenceId(selectedTrainId)) {
      if (train.id === selectedTrainId) {
        return {
          color: colors.normal,
          level: 1,
          border: {
            offset: 3,
            width: 0.5,
            color: colors.normal,
            backgroundColor: colors.background,
          },
        };
      }
      // Other occurrences from the same paced
      if (
        isOccurrenceId(train.id) &&
        extractPacedTrainIdFromOccurrenceId(train.id) ===
          extractPacedTrainIdFromOccurrenceId(selectedTrainId)
      ) {
        return {
          color: colors.normal,
          level: 1,
          border: {
            offset: 3.5,
            color: 'transparent',
            backgroundColor: colors.background,
          },
        };
      }
    } else if (train.id === selectedTrainId) {
      return { color: colors.normal, level: 1 };
    }
  }

  return { color: colors.normal };
};

export const expandProjectedTrains = (trains: TrainSpaceTimeData[]): TrainSpaceTimeData[] =>
  trains.flatMap<TrainSpaceTimeData>((train) => {
    if (isTrainScheduleProjection(train)) return train;
    // TODO exceptions : handle added exceptions in issue https://github.com/OpenRailAssociation/osrd/issues/11476
    const pacedTrainId = extractPacedTrainIdFromOccurrenceId(train.id);
    const occurrencesCount = getOccurrencesNb(train.paced);
    const occurrences = [];
    for (let i = 0; i < occurrencesCount; i += 1) {
      const occurrenceId = formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, i);
      const correspondingException = findExceptionWithOccurrenceId(train.exceptions, occurrenceId);
      // Disabled occurrences should not be projected
      if (correspondingException?.disabled) continue;

      const occurrenceStartTime = dayjs(train.departureTime)
        .add(i * train.paced.interval.ms, 'ms')
        .toDate();
      occurrences.push({
        ...train,
        id: occurrenceId,
        name: computeOccurrenceName(train.name, i),
        departureTime: occurrenceStartTime,
      });
    }
    return occurrences;
  });

export const cutSpaceTimeChart = (
  projectedTrains: TrainSpaceTimeData[],
  conflicts: Conflict[],
  operationalPoints: PathOperationalPoint[],
  waypointsPanelData?: WaypointsPanelData
) => {
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
};

export const getOccupancyBlocks = (trains: TrainSpaceTimeData[]): OccupancyBlock[] => {
  return trains.flatMap((train) => {
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
};
