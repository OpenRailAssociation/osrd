import nextId from 'react-id-generator';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { TrackSection } from 'common/api/osrdEditoastApi';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import findTrackSectionOffset from 'modules/pathfinding/helpers/findTrackSectionOffset';
import getPointOnPathCoordinates from 'modules/pathfinding/helpers/getPointOnPathCoordinates';
import type { PathStep } from 'reducers/osrdconf/types';
import { mmToM, mToMm } from 'utils/physics';

import { NO_POWER_RESTRICTION } from '../consts';

const createPathStep = (
  positionOnPathInM: number, // in meters
  tracksLengthCumulativeSums: number[],
  pathProperties: ManageTrainSchedulePathProperties,
  pathSteps: PathStep[],
  tracksById: Record<string, TrackSection>
): PathStep => {
  const positionOnPath = mToMm(positionOnPathInM);
  if (
    positionOnPath === 0 ||
    new Set(pathSteps.map((step) => step?.positionOnPath)).has(positionOnPath)
  ) {
    throw new Error('Invalid position on path: a path step already exists at this position');
  }

  const trackOffset = findTrackSectionOffset(
    positionOnPath,
    tracksLengthCumulativeSums,
    pathProperties.trackSectionRanges
  );

  const coordinates = getPointOnPathCoordinates(
    tracksById,
    pathProperties.trackSectionRanges,
    tracksLengthCumulativeSums,
    trackOffset.offset
  );

  return {
    id: nextId(),
    positionOnPath,
    coordinates,
    ...trackOffset,
    // TODO: we should return the offset in mm once it is stored in mm in the store
    offset: mmToM(trackOffset.offset),
    isFromPowerRestriction: true,
  };
};

export const createCutAtPathStep = (
  cutAtPositionInM: number,
  pathProperties: ManageTrainSchedulePathProperties,
  rangesData: IntervalItem[],
  cutPositions: number[],
  tracksLengthCumulativeSums: number[],
  tracksById: Record<string, TrackSection>,
  setCutPositions: (newCutPosition: number[]) => void
): PathStep | null => {
  const intervalCut = rangesData.find(
    (interval) => interval.begin <= cutAtPositionInM && interval.end >= cutAtPositionInM
  );

  if (!intervalCut || intervalCut.value === NO_POWER_RESTRICTION) {
    const newCutPositions = !cutPositions.length
      ? [cutAtPositionInM]
      : cutPositions.flatMap((position, index) => {
          if (position > cutAtPositionInM) {
            return [cutAtPositionInM, position];
          }
          if (index === cutPositions.length - 1) {
            return [position, cutAtPositionInM];
          }
          return [position];
        });
    setCutPositions(newCutPositions);
    return null;
  }

  const cutAtPosition = mToMm(cutAtPositionInM);
  const trackOffset = findTrackSectionOffset(
    cutAtPosition,
    tracksLengthCumulativeSums,
    pathProperties.trackSectionRanges
  );

  const coordinatesAtCut = getPointOnPathCoordinates(
    tracksById,
    pathProperties.trackSectionRanges,
    tracksLengthCumulativeSums,
    cutAtPosition
  );
  return {
    id: nextId(),
    positionOnPath: cutAtPosition,
    coordinates: coordinatesAtCut,
    isFromPowerRestriction: true,
    ...trackOffset,
    // TODO: we should return the offset in mm once it is stored in mm in the store
    offset: mmToM(trackOffset.offset),
  };
};

export default createPathStep;
