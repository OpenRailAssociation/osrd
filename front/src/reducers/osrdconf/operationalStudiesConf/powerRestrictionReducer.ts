import type { PayloadAction } from '@reduxjs/toolkit';
import type { Draft } from 'immer';
import { compact, keyBy, sortBy } from 'lodash';

import type { PowerRestriction } from 'applications/operationalStudies/types';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import type { OperationalStudiesConfState, PathStep } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';

import { addPathStep, cleanPathSteps, isRangeCovered, updateRestrictions } from './utils';

const powerRestrictionReducer = {
  updatePowerRestrictionRanges(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<PowerRestriction[]>
  ) {
    state.powerRestriction = action.payload;
  },

  upsertPowerRestrictionRanges(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<{ from: PathStep; to: PathStep; code: string }>
  ) {
    const { from, to, code } = action.payload;
    let newPathSteps = compact(state.pathSteps);
    let newPowerRestrictionRanges = state.powerRestriction.filter(
      (restriction) => restriction.from !== from.id && restriction.to !== to.id
    );

    // add new pathSteps
    newPathSteps = addPathStep(newPathSteps, from);
    newPathSteps = addPathStep(newPathSteps, to);

    const newPathStepsById = keyBy(newPathSteps, 'id');

    // update power restriction ranges
    if (code !== NO_POWER_RESTRICTION) {
      newPowerRestrictionRanges.push({ from: from.id, to: to.id, value: code });
      newPowerRestrictionRanges = sortBy(
        newPowerRestrictionRanges,
        (range) => newPathStepsById[range.from]?.positionOnPath
      );
    }

    state.pathSteps = newPathSteps;
    state.powerRestriction = newPowerRestrictionRanges;
  },

  cutPowerRestrictionRanges(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<{ cutAt: PathStep }>
  ) {
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
        console.error('cutPowerRestrictionRanges: prevStep or nextStep is undefined');
      } else {
        // update the power restriction ranges by splitting 1 range into 2
        const newPowerRestrictionRanges = state.powerRestriction.reduce((acc, powerRestriction) => {
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
        }, [] as PowerRestriction[]);

        state.pathSteps = newPathSteps;
        state.powerRestriction = newPowerRestrictionRanges;
      }
    }
  },

  mergePowerRestrictionRanges(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<{ from: PathStep; prevTo: PathStep; newTo: PathStep }>
  ) {
    const { from, prevTo, newTo } = action.payload;

    if (!state.pathSteps.every((step) => step !== null)) {
      throw new Error('PathSteps should not have null values at this point');
    }
    let newPathSteps: PathStep[] = [...state.pathSteps];

    const powerRestrictionToModify = state.powerRestriction.find(
      (restriction) => restriction.from === from.id
    );

    let newPowerRestrictionRanges: PowerRestriction[] = [];
    if (!powerRestrictionToModify) {
      // we need to remove the next range if it exists
      newPowerRestrictionRanges = state.powerRestriction.filter(
        (restriction) => restriction.from !== prevTo.id && restriction.to !== newTo.id
      );
    } else {
      // replace the previous range by the new one and remove the previous one
      for (const restriction of state.powerRestriction) {
        if (restriction.from === from.id && restriction.to === prevTo.id) {
          newPowerRestrictionRanges.push({ ...restriction, to: newTo.id });
        } else if (restriction.from !== prevTo.id && restriction.to !== newTo.id) {
          newPowerRestrictionRanges.push(restriction);
        }
      }

      // add the new pathStep if needed
      const pathIds = compact(state.pathSteps).map((step) => step.id);
      if (!pathIds.includes(newTo.id)) {
        const newToIndex = newPathSteps.findIndex(
          (step) => step.positionOnPath && step.positionOnPath > newTo.positionOnPath!
        );
        if (newToIndex === -1) {
          throw new Error('Can not insert the new pathStep in the pathSteps array');
        }
        newPathSteps = addElementAtIndex(newPathSteps, newToIndex, newTo);
      }
    }

    state.pathSteps = cleanPathSteps(newPathSteps, newPowerRestrictionRanges);
    state.powerRestriction = newPowerRestrictionRanges;
  },

  deletePowerRestrictionRanges(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<{ from: PathStep; to: PathStep }>
  ) {
    const { from, to } = action.payload;

    const newPowerRestrictionRanges = state.powerRestriction.filter(
      (restriction) => restriction.from !== from.id && restriction.to !== to.id
    );

    const newPathSteps = [...state.pathSteps].map((step) => step!);
    state.pathSteps = cleanPathSteps(newPathSteps, newPowerRestrictionRanges);
    state.powerRestriction = newPowerRestrictionRanges;
  },

  resizeSegmentBeginInput(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<{
      firstRestriction?: PowerRestriction;
      secondRestriction?: PowerRestriction;
      endPosition: number; // in mm
      newFromPathStep: PathStep;
    }>
  ) {
    const { firstRestriction, secondRestriction, endPosition, newFromPathStep } = action.payload;

    // pathSteps should not be undefined or have null values
    if (state.pathSteps.every((pathStep) => !!pathStep)) {
      let newPathSteps = [...state.pathSteps];

      // find the covered ranges
      const coveredRanges = state.powerRestriction.filter((restriction) =>
        isRangeCovered(newPathSteps, restriction, newFromPathStep.positionOnPath!, endPosition)
      );

      // add the new pathStep
      newPathSteps = addPathStep(newPathSteps, newFromPathStep);

      // update the power restriction ranges
      const newPowerRestrictionRanges = updateRestrictions(
        state.powerRestriction,
        coveredRanges,
        firstRestriction,
        secondRestriction,
        newFromPathStep.id
      );

      // clean pathSteps
      newPathSteps = cleanPathSteps(newPathSteps, newPowerRestrictionRanges);

      state.pathSteps = newPathSteps;
      state.powerRestriction = newPowerRestrictionRanges;
    }
  },
  resizeSegmentEndInput(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<{
      firstRestriction?: PowerRestriction;
      secondRestriction?: PowerRestriction;
      beginPosition: number; // in mm
      newEndPathStep: PathStep;
    }>
  ) {
    const { firstRestriction, secondRestriction, beginPosition, newEndPathStep } = action.payload;

    // pathSteps should not be undefined or have null values
    if (state.pathSteps.every((pathStep) => !!pathStep)) {
      let newPathSteps = [...state.pathSteps];

      // find the covered ranges
      const coveredRanges = state.powerRestriction.filter((restriction) =>
        isRangeCovered(newPathSteps, restriction, beginPosition, newEndPathStep.positionOnPath!)
      );

      // add the new pathStep
      newPathSteps = addPathStep(newPathSteps, newEndPathStep);

      // update the power restriction ranges
      const newPowerRestrictionRanges = updateRestrictions(
        state.powerRestriction,
        coveredRanges,
        firstRestriction,
        secondRestriction,
        newEndPathStep.id
      );

      // clean pathSteps
      newPathSteps = cleanPathSteps(newPathSteps, newPowerRestrictionRanges);

      state.pathSteps = newPathSteps;
      state.powerRestriction = newPowerRestrictionRanges;
    }
  },
  cleanPowerRestrictionsCoveredByANewRange(
    state: Draft<OperationalStudiesConfState>,
    action: PayloadAction<{
      beginPosition: number;
      endPosition: number;
    }>
  ) {
    const { beginPosition, endPosition } = action.payload;

    // pathSteps should not be undefined or have null values
    if (state.pathSteps.every((pathStep) => !!pathStep)) {
      let newPathSteps = [...state.pathSteps];

      // find the covered ranges
      const coveredRanges = state.powerRestriction.filter((restriction) =>
        isRangeCovered(newPathSteps, restriction, beginPosition, endPosition)
      );

      // update the power restriction ranges
      const newPowerRestrictionRanges = updateRestrictions(state.powerRestriction, coveredRanges);

      // clean pathSteps
      newPathSteps = cleanPathSteps(newPathSteps, newPowerRestrictionRanges);

      state.pathSteps = newPathSteps;
      state.powerRestriction = newPowerRestrictionRanges;
    }
  },
};

export default powerRestrictionReducer;
