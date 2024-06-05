import nextId from 'react-id-generator';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { TrackRange } from 'common/api/osrdEditoastApi';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { getPointCoordinates } from 'utils/geometry';
import { mToKm, mToMm } from 'utils/physics';

import { NO_POWER_RESTRICTION } from '../consts';

const findTrackSectionIndex = (position: number, tracksLengthCumulativeSums: number[]) => {
  for (let i = 0; i < tracksLengthCumulativeSums.length; i += 1) {
    if (position <= tracksLengthCumulativeSums[i]) {
      return i;
    }
  }
  return -1;
};

const findTrackSection = (
  position: number, // in mm
  tracksLengthCumulativeSums: number[],
  pathProperties: ManageTrainSchedulePathProperties
) => {
  const index = findTrackSectionIndex(position, tracksLengthCumulativeSums);
  return index !== -1 ? pathProperties.trackSectionRanges[index] : null;
};

const calculateOffset = (
  trackSectionRange: TrackRange,
  position: number, // in mm
  tracksLengthCumulativeSums: number[] // in meters
) => {
  const index = findTrackSectionIndex(position, tracksLengthCumulativeSums);
  const inferiorSum = tracksLengthCumulativeSums[index];
  return trackSectionRange.direction === 'START_TO_STOP'
    ? inferiorSum - position
    : position - inferiorSum;
};

const createPathStep = (
  positionOnPathInM: number, // in meters
  tracksLengthCumulativeSums: number[],
  pathProperties: ManageTrainSchedulePathProperties,
  pathSteps: PathStep[]
): PathStep | undefined => {
  const positionOnPath = mToMm(positionOnPathInM);
  if (
    positionOnPath === 0 ||
    new Set(pathSteps.map((step) => step?.positionOnPath)).has(positionOnPath)
  )
    return undefined;

  const trackSectionRange = findTrackSection(
    positionOnPath,
    tracksLengthCumulativeSums,
    pathProperties
  );
  if (!trackSectionRange) return undefined;

  const offset = calculateOffset(trackSectionRange, positionOnPath, tracksLengthCumulativeSums);

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
    offset: mToKm(offset),
  };
};

export const createCutAtPathStep = (
  cutAtPositionInM: number,
  pathProperties: ManageTrainSchedulePathProperties,
  rangesData: IntervalItem[],
  cutPositions: number[],
  tracksLengthCumulativeSums: number[],
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
  const trackSectionRangeAtCut = findTrackSection(
    cutAtPosition,
    tracksLengthCumulativeSums,
    pathProperties
  );

  if (!trackSectionRangeAtCut) return null;

  const offsetAtCut = calculateOffset(
    trackSectionRangeAtCut,
    cutAtPosition,
    tracksLengthCumulativeSums
  );
  const coordinatesAtCut = getPointCoordinates(
    pathProperties.geometry,
    pathProperties.length,
    cutAtPosition
  );
  return {
    id: nextId(),
    positionOnPath: cutAtPosition,
    coordinates: coordinatesAtCut,
    track: trackSectionRangeAtCut.track_section,
    offset: offsetAtCut,
  };
};

export default createPathStep;
