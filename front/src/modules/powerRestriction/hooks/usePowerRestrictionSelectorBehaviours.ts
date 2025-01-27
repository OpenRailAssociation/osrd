import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  ManageTrainSchedulePathProperties,
  PowerRestriction,
} from 'applications/operationalStudies/types';
import type { TrackSection } from 'common/api/osrdEditoastApi';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import getTrackLengthCumulativeSums from 'modules/pathfinding/helpers/getTrackLengthCumulativeSums';
import { createCutAtPathStep } from 'modules/powerRestriction/helpers/createPathStep';
import {
  upsertPowerRestrictionRanges,
  deletePowerRestrictionRanges,
  cutPowerRestrictionRanges,
  resizeSegmentBeginInput,
  resizeSegmentEndInput,
  mergePowerRestrictionRanges,
} from 'reducers/osrdconf/operationalStudiesConf';
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
  setCutPositions: Dispatch<SetStateAction<number[]>>;
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
    } else {
      dispatch(deletePowerRestrictionRanges({ from, to }));
    }
  };

  const cutPowerRestrictionRange = (cutAtPositionInM: number) => {
    const cutAt = createCutAtPathStep(
      cutAtPositionInM,
      pathProperties,
      ranges,
      cutPositions,
      tracksLengthCumulativeSums,
      trackSectionsById,
      setCutPositions
    );
    if (cutAt) {
      dispatch(cutPowerRestrictionRanges({ cutAt }));
    }
  };

  const mergePowerRestrictionRange = (
    fromPosition: number,
    prevToPosition: number,
    newToPosition: number
  ) => {
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
          newTo:
            newTo ??
            getOrCreatePathStepAtPosition(
              newToPosition,
              pathSteps,
              tracksLengthCumulativeSums,
              pathProperties,
              trackSectionsById
            ),
        })
      );
    }

    // clean cut positions
    setCutPositions((prev) =>
      prev.filter((position) => position <= fromPosition || newToPosition <= position)
    );
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
      pathProperties,
      trackSectionsById
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

export default usePowerRestrictionSelectorBehaviours;
