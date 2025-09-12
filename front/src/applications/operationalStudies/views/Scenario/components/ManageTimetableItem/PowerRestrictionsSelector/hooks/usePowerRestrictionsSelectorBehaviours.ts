import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import { sortBy } from 'lodash';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  ManageTimetableItemPathProperties,
  PowerRestriction,
} from 'applications/operationalStudies/types';
import type { TrackSection } from 'common/api/osrdEditoastApi';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import getTrackLengthCumulativeSums from 'modules/pathfinding/helpers/getTrackLengthCumulativeSums';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import {
  upsertPowerRestrictionRanges,
  deletePowerRestrictionRanges,
  cutPowerRestrictionRanges,
  resizeSegmentBeginInput,
  resizeSegmentEndInput,
  mergePowerRestrictionRanges,
  cleanPowerRestrictionsCoveredByANewRange,
} from 'reducers/osrdconf/operationalStudiesConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { mmToM, mToMm } from 'utils/physics';

import { createCutAtPathStep } from '../helpers/createPathStep';
import getRestrictionsToResize, {
  cleanCustomRanges,
  getRangesToResize,
} from '../helpers/getRestrictionsToResize';
import {
  extractPathStepsFromRange,
  getOrCreatePathStepAtPosition,
  getPathStep,
} from '../helpers/utils';

type UsePowerRestrictionsSelectorBehavioursArgs = {
  ranges: IntervalItem[];
  customRanges: IntervalItem[];
  pathProperties: ManageTimetableItemPathProperties;
  pathSteps: PathStep[];
  powerRestrictionRanges: PowerRestriction[];
  setCustomRanges: Dispatch<SetStateAction<IntervalItem[]>>;
};

const usePowerRestrictionsSelectorBehaviours = ({
  customRanges,
  pathProperties,
  pathSteps,
  powerRestrictionRanges,
  ranges,
  setCustomRanges,
}: UsePowerRestrictionsSelectorBehavioursArgs) => {
  const dispatch = useAppDispatch();

  const { getTrackSectionsByIds } = useScenarioContext();

  const [trackSectionsById, setTrackSectionsById] = useState<Record<string, TrackSection>>({});

  /** Cumulative sums of the trackSections' length on path (in mm) */
  const tracksLengthCumulativeSums = useMemo(
    () => getTrackLengthCumulativeSums(pathProperties.trackSectionRanges),
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
      pathProperties,
      trackSectionsById
    );

    if (newRange.value !== NO_POWER_RESTRICTION) {
      dispatch(
        upsertPowerRestrictionRanges({
          from,
          to,
          code: newRange.value.toString(),
        })
      );
      setCustomRanges((prev) =>
        prev.filter((range) => range.begin !== newRange.begin && range.end !== newRange.end)
      );
    } else {
      dispatch(deletePowerRestrictionRanges({ from, to }));
      setCustomRanges((prev) => sortBy([...prev, newRange], (range) => range.begin));
    }
  };

  const cutPowerRestrictionRange = (cutAtPositionInM: number) => {
    const cutAt = createCutAtPathStep(
      cutAtPositionInM,
      pathProperties,
      ranges,
      customRanges,
      tracksLengthCumulativeSums,
      trackSectionsById,
      setCustomRanges
    );
    if (cutAt) {
      dispatch(cutPowerRestrictionRanges({ cutAt }));
    }
  };

  const mergePowerRestrictionRange = (data: IntervalItem[], selectedIntervalIndex: number) => {
    const fromPosition = data[selectedIntervalIndex].begin;
    const prevToPosition = data[selectedIntervalIndex].end;
    const newToPosition = data[selectedIntervalIndex + 1].end;

    const from = getPathStep(pathSteps, fromPosition);
    const prevTo = getPathStep(pathSteps, prevToPosition);
    let newTo = getPathStep(pathSteps, newToPosition);

    // if the first range is empty but not the next one
    // => delete the next range
    if (!from && prevTo && newTo) {
      dispatch(deletePowerRestrictionRanges({ from: prevTo, to: newTo }));
    }

    // the first range is not empty, then we need to extend it and to remove the next range
    else if (from && prevTo) {
      newTo = getOrCreatePathStepAtPosition(
        newToPosition,
        pathSteps,
        tracksLengthCumulativeSums,
        pathProperties,
        trackSectionsById
      );
      dispatch(
        mergePowerRestrictionRanges({
          from,
          prevTo,
          newTo,
        })
      );
    }

    // clean custom ranges
    setCustomRanges((prev) =>
      prev.reduce<IntervalItem[]>((acc, range) => {
        // extend the first range
        if (range.begin === fromPosition) {
          acc.push({ ...range, end: newToPosition });
          return acc;
        }
        // remove the second range (it has been merged into the first one)
        if (range.begin === newToPosition) {
          return acc;
        }
        acc.push(range);
        return acc;
      }, [])
    );
  };

  const deletePowerRestrictionRange = (from: number, to: number) => {
    const fromPathStep = getPathStep(pathSteps, from);
    const toPathStep = getPathStep(pathSteps, to);

    if (fromPathStep && toPathStep) {
      dispatch(deletePowerRestrictionRanges({ from: fromPathStep, to: toPathStep }));
      // clean customRanges if the deleted range was the only non-empty one
      if (
        ranges.length === 3 &&
        ranges.filter((range) => range.value !== NO_POWER_RESTRICTION).length === 1
      ) {
        setCustomRanges([]);
      }
      return;
    }

    // handle empty range (custom range) deletion
    if (ranges.length === 2 && ranges.every((range) => range.value === NO_POWER_RESTRICTION)) {
      setCustomRanges([]);
    } else {
      setCustomRanges((prev) => prev.filter((range) => range.begin !== from && range.end !== to));
    }
  };

  const resizeSegments = (
    selectedRangeIndex: number,
    context: 'begin' | 'end',
    newPosition: number
  ) => {
    const { firstRange, secondRange } = getRangesToResize(
      ranges,
      selectedRangeIndex,
      newPosition,
      context
    );

    // clean customRanges
    if (firstRange?.value === NO_POWER_RESTRICTION || secondRange?.value === NO_POWER_RESTRICTION) {
      const newCustomRanges = cleanCustomRanges(
        customRanges,
        firstRange,
        secondRange,
        newPosition,
        mmToM(pathProperties.length)
      );
      setCustomRanges(newCustomRanges);

      if (
        (!firstRange || firstRange?.value === NO_POWER_RESTRICTION) &&
        (!secondRange || secondRange?.value === NO_POWER_RESTRICTION)
      ) {
        // clean the power restriction ranges which may have been covered by the new range
        dispatch(
          cleanPowerRestrictionsCoveredByANewRange({
            beginPosition: firstRange ? mToMm(firstRange.begin) : 0,
            endPosition: secondRange ? mToMm(secondRange.end) : pathProperties.length,
          })
        );
        return;
      }
    }

    // handle the store update since at least one range is stored in the store
    const newPathStep = getOrCreatePathStepAtPosition(
      newPosition,
      pathSteps,
      tracksLengthCumulativeSums,
      pathProperties,
      trackSectionsById
    );

    const { firstRestriction, secondRestriction } = getRestrictionsToResize(
      firstRange,
      secondRange,
      pathSteps,
      powerRestrictionRanges
    );

    if (context === 'begin') {
      dispatch(
        resizeSegmentBeginInput({
          firstRestriction,
          secondRestriction,
          endPosition: mToMm(secondRange!.end),
          newFromPathStep: newPathStep,
        })
      );
    } else
      dispatch(
        resizeSegmentEndInput({
          firstRestriction,
          secondRestriction,
          beginPosition: mToMm(firstRange!.begin),
          newEndPathStep: newPathStep,
        })
      );
  };

  useEffect(() => {
    const fetchTracks = async () => {
      const trackIds = pathProperties.trackSectionRanges.map((range) => range.track_section);
      const tracks = await getTrackSectionsByIds(trackIds);
      setTrackSectionsById(tracks);
    };

    if (pathProperties.trackSectionRanges) fetchTracks();
  }, [pathProperties.trackSectionRanges]);

  return {
    resizeSegments,
    mergePowerRestrictionRange,
    deletePowerRestrictionRange,
    cutPowerRestrictionRange,
    editPowerRestrictionRanges,
  };
};

export default usePowerRestrictionsSelectorBehaviours;
