import type { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';
import { compact, isEqual, keyBy, sortBy } from 'lodash';

import type { PowerRestrictionV2 } from 'applications/operationalStudies/types';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import type { OsrdConfState, PathStep } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';

import { addPathStep, cleanPathSteps, isRangeCovered, updateRestrictions } from './utils';

export type PowerRestrictionReducer<S extends OsrdConfState> = {
  ['updatePowerRestrictionRangesV2']: CaseReducer<S, PayloadAction<PowerRestrictionV2[]>>;
  ['upsertPowerRestrictionRangesV2']: CaseReducer<
    S,
    PayloadAction<{ from: PathStep; to: PathStep; code: string }>
  >;
  ['cutPowerRestrictionRangesV2']: CaseReducer<S, PayloadAction<{ cutAt: PathStep }>>;
  ['deletePowerRestrictionRangesV2']: CaseReducer<
    S,
    PayloadAction<{ from: PathStep; to: PathStep }>
  >;
  ['resizeSegmentEndInput']: CaseReducer<
    S,
    PayloadAction<{
      firstRestriction: PowerRestrictionV2;
      secondRestriction?: PowerRestrictionV2;
      newEndPathStep: PathStep;
    }>
  >;
  ['resizeSegmentBeginInput']: CaseReducer<
    S,
    PayloadAction<{
      firstRestriction?: PowerRestrictionV2;
      secondRestriction: PowerRestrictionV2;
      newFromPathStep: PathStep;
    }>
  >;
  ['resetPowerRestrictionRangesV2']: CaseReducer<S>;
};

export function builPowerRestrictionReducer<S extends OsrdConfState>(): PowerRestrictionReducer<S> {
  return {
    updatePowerRestrictionRangesV2(state: Draft<S>, action: PayloadAction<PowerRestrictionV2[]>) {
      state.powerRestrictionV2 = action.payload;
    },

    upsertPowerRestrictionRangesV2(
      state: Draft<S>,
      action: PayloadAction<{ from: PathStep; to: PathStep; code: string }>
    ) {
      const { from, to, code } = action.payload;
      let newPathSteps = compact(state.pathSteps);
      let newPowerRestrictionRangesV2 = state.powerRestrictionV2.filter(
        (restriction) => restriction.from !== from.id && restriction.to !== to.id
      );

      // add new pathSteps
      newPathSteps = addPathStep(newPathSteps, from);
      newPathSteps = addPathStep(newPathSteps, to);

      const newPathStepsById = keyBy(newPathSteps, 'id');

      // update power restriction ranges
      if (code !== NO_POWER_RESTRICTION) {
        newPowerRestrictionRangesV2.push({ from: from.id, to: to.id, value: code });
        newPowerRestrictionRangesV2 = sortBy(
          newPowerRestrictionRangesV2,
          (range) => newPathStepsById[range.from]?.positionOnPath
        );
      }

      state.pathSteps = newPathSteps;
      state.powerRestrictionV2 = newPowerRestrictionRangesV2;
    },

    cutPowerRestrictionRangesV2(state: Draft<S>, action: PayloadAction<{ cutAt: PathStep }>) {
      const { cutAt } = action.payload;
      let newPathSteps = [...state.pathSteps];

      const pathIds = compact(state.pathSteps).map((step) => step.id);

      if (!pathIds.includes(cutAt.id)) {
        const cutAtIndex = newPathSteps.findIndex(
          (step) => step?.positionOnPath && step.positionOnPath > cutAt.positionOnPath!
        );

        if (cutAtIndex === -1) return;

        // add the new pathStep at the right index
        newPathSteps = addElementAtIndex(newPathSteps, cutAtIndex, cutAt);

        const prevStep = newPathSteps[cutAtIndex - 1];
        const nextStep = newPathSteps[cutAtIndex + 1];

        if (!prevStep || !nextStep) {
          console.error('cutPowerRestrictionRangesV2: prevStep or nextStep is undefined');
        } else {
          // update the power restriction ranges by splitting 1 range into 2
          const newPowerRestrictionRangesV2 = state.powerRestrictionV2.reduce(
            (acc, powerRestriction) => {
              if (powerRestriction.from === prevStep.id) {
                acc.push({
                  ...powerRestriction,
                  to: cutAt.id,
                });
                acc.push({
                  ...powerRestriction,
                  from: cutAt.id,
                  to: nextStep.id,
                });
              } else {
                acc.push(powerRestriction);
              }
              return acc;
            },
            [] as PowerRestrictionV2[]
          );

          state.pathSteps = newPathSteps;
          state.powerRestrictionV2 = newPowerRestrictionRangesV2;
        }
      }
    },

    deletePowerRestrictionRangesV2(
      state: Draft<S>,
      action: PayloadAction<{ from: PathStep; to: PathStep }>
    ) {
      const { from, to } = action.payload;

      const newPowerRestrictionRanges = state.powerRestrictionV2.filter(
        (restriction) => restriction.from !== from.id && restriction.to !== to.id
      );

      const newPathSteps = [...state.pathSteps] as PathStep[];
      state.pathSteps = cleanPathSteps(newPathSteps, newPowerRestrictionRanges);
      state.powerRestrictionV2 = newPowerRestrictionRanges;
    },

    resizeSegmentBeginInput(
      state: Draft<S>,
      action: PayloadAction<{
        firstRestriction?: PowerRestrictionV2;
        secondRestriction: PowerRestrictionV2;
        newFromPathStep: PathStep;
      }>
    ) {
      const { firstRestriction, secondRestriction, newFromPathStep } = action.payload;

      // pathSteps should not be undefined or have null values
      if (state.pathSteps && !state.pathSteps.some((pathStep) => !pathStep)) {
        let newPathSteps = [...state.pathSteps] as PathStep[];
        let newPowerRestrictionRanges = state.powerRestrictionV2.filter(
          (restriction) =>
            !isEqual(restriction, firstRestriction) || !isEqual(restriction, secondRestriction)
        );

        // find the covered ranges
        const pathStepEnd = newPathSteps.find((pathStep) => pathStep.id === secondRestriction.to);
        const coveredRanges = pathStepEnd
          ? newPowerRestrictionRanges.filter((restriction) =>
              isRangeCovered(
                newPathSteps,
                restriction,
                newFromPathStep.positionOnPath,
                pathStepEnd.positionOnPath
              )
            )
          : [];

        // add the new pathStep
        newPathSteps = addPathStep(newPathSteps, newFromPathStep);

        // update the power restriction ranges
        newPowerRestrictionRanges = updateRestrictions(
          newPowerRestrictionRanges,
          firstRestriction,
          secondRestriction,
          newFromPathStep.id,
          coveredRanges
        );

        // clean pathSteps
        newPathSteps = cleanPathSteps(newPathSteps, newPowerRestrictionRanges);

        state.pathSteps = newPathSteps;
        state.powerRestrictionV2 = newPowerRestrictionRanges;
      }
    },
    resizeSegmentEndInput(
      state: Draft<S>,
      action: PayloadAction<{
        firstRestriction: PowerRestrictionV2;
        secondRestriction?: PowerRestrictionV2;
        newEndPathStep: PathStep;
      }>
    ) {
      const { firstRestriction, secondRestriction, newEndPathStep } = action.payload;

      // pathSteps should not be undefined or have null values
      if (state.pathSteps && !state.pathSteps.some((pathStep) => !pathStep)) {
        let newPathSteps = [...state.pathSteps] as PathStep[];
        let newPowerRestrictionRanges = state.powerRestrictionV2.filter(
          (restriction) =>
            !isEqual(restriction, firstRestriction) || !isEqual(restriction, secondRestriction)
        );
        const pathStepBegin = newPathSteps.find(
          (pathStep) => pathStep.id === firstRestriction.from
        );

        // find the covered ranges
        const coveredRanges = pathStepBegin
          ? newPowerRestrictionRanges.filter((restriction) =>
              isRangeCovered(
                newPathSteps,
                restriction,
                pathStepBegin.positionOnPath,
                newEndPathStep.positionOnPath
              )
            )
          : [];

        // add the new pathStep
        newPathSteps = addPathStep(newPathSteps, newEndPathStep);

        // update the power restriction ranges
        newPowerRestrictionRanges = updateRestrictions(
          newPowerRestrictionRanges,
          firstRestriction,
          secondRestriction,
          newEndPathStep.id,
          coveredRanges
        );

        // clean pathSteps
        newPathSteps = cleanPathSteps(newPathSteps, newPowerRestrictionRanges);

        state.pathSteps = newPathSteps;
        state.powerRestrictionV2 = newPowerRestrictionRanges;
      }
    },
    resetPowerRestrictionRangesV2(state: Draft<S>) {
      state.powerRestrictionV2 = [];
    },
  };
}
