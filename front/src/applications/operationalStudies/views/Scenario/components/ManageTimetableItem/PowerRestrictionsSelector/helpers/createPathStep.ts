import { sortBy } from 'lodash';
import { v4 as uuidV4 } from 'uuid';

import type { ManageTimetableItemPathProperties } from 'applications/operationalStudies/types';
import type { TrackSection } from 'common/api/osrdEditoastApi';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import findTrackSectionOffset from 'modules/pathfinding/helpers/findTrackSectionOffset';
import getPointOnPathCoordinates from 'modules/pathfinding/helpers/getPointOnPathCoordinates';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import type { PathStep } from 'reducers/osrdconf/types';
import { mmToM, mToMm } from 'utils/physics';

/**
 * Cut the correct range for a given position and add the new ranges to the
 * customRanges array if needed
 */
export const cutRange = (
  allRanges: IntervalItem[],
  customRanges: IntervalItem[],
  pathLength: number,
  newCutPosition: number
) => {
  if (newCutPosition >= pathLength) {
    throw Error('Invalid cut position: can not properly insert the new range');
  }

  if (allRanges.length === 1) {
    return [
      { begin: 0, end: newCutPosition, value: allRanges[0].value },
      { begin: newCutPosition, end: pathLength, value: allRanges[0].value },
    ];
  }

  for (let i = 0; i < allRanges.length; i++) {
    // if the cut position is smaller than the current range begin, we insert new ranges before the current one
    if (allRanges[i].begin < newCutPosition && newCutPosition < allRanges[i].end) {
      return sortBy(
        [
          ...customRanges.filter(
            (range) => range.begin !== allRanges[i].begin || range.end !== allRanges[i].end
          ),
          { begin: allRanges[i].begin, end: newCutPosition, value: NO_POWER_RESTRICTION },
          { begin: newCutPosition, end: allRanges[i].end, value: NO_POWER_RESTRICTION },
        ],
        'begin'
      );
    }
  }
  throw Error('Invalid cut position: can not properly insert the new range');
};

const createPathStep = (
  positionOnPathInM: number, // in meters
  tracksLengthCumulativeSums: number[],
  pathProperties: ManageTimetableItemPathProperties,
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
    id: uuidV4(),
    positionOnPath,
    coordinates,
    location: {
      ...trackOffset,
      // TODO: we should return the offset in mm once it is stored in mm in the store
      offset: mmToM(trackOffset.offset),
    },
    isFromPowerRestriction: true,
  };
};

export const createCutAtPathStep = (
  cutAtPositionInM: number,
  pathProperties: ManageTimetableItemPathProperties,
  rangesData: IntervalItem[],
  customRanges: IntervalItem[],
  tracksLengthCumulativeSums: number[],
  tracksById: Record<string, TrackSection>,
  setCustomRanges: (newRanges: IntervalItem[]) => void
): PathStep | null => {
  const intervalCut = rangesData.find(
    (interval) => interval.begin <= cutAtPositionInM && interval.end >= cutAtPositionInM
  );

  if (!intervalCut || intervalCut.value === NO_POWER_RESTRICTION) {
    const newCutPositions = cutRange(
      rangesData,
      customRanges,
      mmToM(pathProperties.length),
      cutAtPositionInM
    );
    setCustomRanges(newCutPositions);
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
    id: uuidV4(),
    positionOnPath: cutAtPosition,
    coordinates: coordinatesAtCut,
    isFromPowerRestriction: true,
    location: {
      ...trackOffset,
      // TODO: we should return the offset in mm once it is stored in mm in the store
      offset: mmToM(trackOffset.offset),
    },
  };
};

export default createPathStep;
