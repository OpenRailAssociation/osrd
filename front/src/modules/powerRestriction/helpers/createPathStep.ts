import nextId from 'react-id-generator';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { TrackRange } from 'common/api/osrdEditoastApi';
import type { PathStep } from 'reducers/osrdconf/types';
import { getPointCoordinates } from 'utils/geometry';

const findTrackSectionIndex = (position: number, cumulativeSums: number[]) => {
  for (let i = 0; i < cumulativeSums.length; i += 1) {
    if (position <= cumulativeSums[i]) {
      return i;
    }
  }
  return -1;
};

const findTrackSection = (
  position: number,
  cumulativeSums: number[],
  pathProperties: ManageTrainSchedulePathProperties | undefined
) => {
  const index = findTrackSectionIndex(position, cumulativeSums);
  return index !== -1 ? pathProperties?.trackSectionRanges[index] : null;
};

const calculateOffset = (
  trackSectionRange: TrackRange,
  position: number,
  cumulativeSums: number[]
) => {
  const index = findTrackSectionIndex(position, cumulativeSums);
  const inferiorSum = cumulativeSums[index];
  return trackSectionRange.direction === 'START_TO_STOP'
    ? inferiorSum - position
    : position - inferiorSum;
};

const createPathStep = (
  positionOnPath: number,
  cumulativeSums: number[],
  pathProperties: ManageTrainSchedulePathProperties | undefined,
  pathSteps: PathStep[]
) => {
  const trackSectionRange = findTrackSection(positionOnPath, cumulativeSums, pathProperties);
  const existingPositions = new Set(pathSteps.map((step) => step?.positionOnPath));
  const isStepDuplicate = existingPositions.has(positionOnPath);
  if (positionOnPath === 0 || !pathProperties || !trackSectionRange || isStepDuplicate)
    return undefined;

  const offset = calculateOffset(trackSectionRange, positionOnPath, cumulativeSums);
  const coordinates = getPointCoordinates(
    pathProperties.geometry,
    pathProperties.length,
    positionOnPath
  );

  return {
    id: nextId(),
    positionOnPath,
    coordinates,
    track: trackSectionRange.track_section,
    offset,
  };
};

export default createPathStep;
