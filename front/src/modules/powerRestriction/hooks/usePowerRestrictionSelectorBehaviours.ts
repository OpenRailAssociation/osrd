import { useMemo } from 'react';

import type {
  ManageTrainSchedulePathProperties,
  PowerRestriction,
} from 'applications/operationalStudies/types';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import { useOsrdConfActions } from 'common/osrdContext';
import { createCutAtPathStep } from 'modules/powerRestriction/helpers/createPathStep';
import type { OperationalStudiesConfSliceActions } from 'reducers/osrdconf/operationalStudiesConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import { NO_POWER_RESTRICTION } from '../consts';
import getRestrictionsToResize from '../helpers/getRestrictionsToResize';
import {
  extractPathStepsFromRange,
  getOrCreatePathStepAtPosition,
  getPathStep,
} from '../helpers/utils';

type UsePowerRestrictionSelectorBehavioursArgs = {
  ranges: IntervalItem[];
  cutPositions: number[];
  pathProperties: ManageTrainSchedulePathProperties;
  pathSteps: PathStep[];
  powerRestrictionRanges: PowerRestriction[];
  setCutPositions: (newCutPosition: number[]) => void;
};

const usePowerRestrictionSelectorBehaviours = ({
  cutPositions,
  pathProperties,
  pathSteps,
  powerRestrictionRanges,
  ranges,
  setCutPositions,
}: UsePowerRestrictionSelectorBehavioursArgs) => {
  const dispatch = useAppDispatch();

  const {
    upsertPowerRestrictionRanges,
    cutPowerRestrictionRanges,
    deletePowerRestrictionRanges,
    resizeSegmentEndInput,
    resizeSegmentBeginInput,
  } = useOsrdConfActions() as OperationalStudiesConfSliceActions;

  /** Cumulative sums of the trackSections' length on path (in mm) */
  const tracksLengthCumulativeSums = useMemo(
    () =>
      pathProperties.trackSectionRanges.reduce((acc, range, index) => {
        const rangeLength = Math.abs(range.end - range.begin);
        if (index === 0) {
          acc.push(rangeLength);
        } else {
          acc.push(acc[acc.length - 1] + rangeLength);
        }
        return acc;
      }, [] as number[]),
    [pathProperties.trackSectionRanges]
  );

  const editPowerRestrictionRanges = (
    newPowerRestrictionRanges: IntervalItem[],
    selectedIntervalIndex?: number
  ) => {
    if (selectedIntervalIndex === undefined) return;

    const newRange = newPowerRestrictionRanges[selectedIntervalIndex];
    const { from, to } = extractPathStepsFromRange(
      newRange,
      pathSteps,
      tracksLengthCumulativeSums,
      pathProperties
    );

    if (from && to) {
      if (newRange.value !== NO_POWER_RESTRICTION) {
        dispatch(
          upsertPowerRestrictionRanges({
            from,
            to,
            code: newRange.value.toString(),
          })
        );
      } else {
        dispatch(deletePowerRestrictionRanges({ from, to }));
      }
    }
  };

  const cutPowerRestrictionRange = (cutAtPositionInM: number) => {
    const cutAt = createCutAtPathStep(
      cutAtPositionInM,
      pathProperties,
      ranges,
      cutPositions,
      tracksLengthCumulativeSums,
      setCutPositions
    );
    if (cutAt) {
      dispatch(cutPowerRestrictionRanges({ cutAt }));
    }
  };

  const deletePowerRestrictionRange = (from: number, to: number) => {
    const fromPathStep = getPathStep(pathSteps, from);
    const toPathStep = getPathStep(pathSteps, to);

    if (fromPathStep && toPathStep) {
      dispatch(deletePowerRestrictionRanges({ from: fromPathStep, to: toPathStep }));
    }
  };

  const resizeSegments = (
    selectedRangeIndex: number,
    context: 'begin' | 'end',
    newPosition: number
  ) => {
    const result = getRestrictionsToResize(
      ranges,
      selectedRangeIndex,
      context,
      newPosition,
      pathSteps,
      powerRestrictionRanges
    );
    if (!result) return;
    const { firstRestriction, secondRestriction } = result;

    const newPathStep = getOrCreatePathStepAtPosition(
      newPosition,
      pathSteps,
      tracksLengthCumulativeSums,
      pathProperties
    );
    if (!newPathStep) return;

    if (context === 'begin') {
      if (secondRestriction)
        dispatch(
          resizeSegmentBeginInput({
            firstRestriction,
            secondRestriction,
            newFromPathStep: newPathStep,
          })
        );
    } else if (firstRestriction)
      dispatch(
        resizeSegmentEndInput({
          firstRestriction,
          secondRestriction,
          newEndPathStep: newPathStep,
        })
      );
  };

  return {
    resizeSegments,
    deletePowerRestrictionRange,
    cutPowerRestrictionRange,
    editPowerRestrictionRanges,
  };
};

export default usePowerRestrictionSelectorBehaviours;
