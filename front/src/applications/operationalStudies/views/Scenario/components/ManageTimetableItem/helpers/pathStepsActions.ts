import { v4 as uuidV4 } from 'uuid';

import type { PathStepV2 } from 'reducers/osrdconf/types';

export const createEmptyPathStep = (): PathStepV2 => ({
  id: uuidV4(),
  location: null,
  arrival: null,
  stopFor: null,
  theoreticalMargin: null,
  receptionSignal: null,
});

export const isEmptyStep = (step: PathStepV2, input?: string) => {
  if (step.location) return false;
  return (input ?? '').trim() === '';
};

export const ensureTrailingEmptyStep = (steps: PathStepV2[]): PathStepV2[] => {
  const last = steps.at(-1);
  if (last && !isEmptyStep(last, '')) return [...steps, createEmptyPathStep()];
  return steps;
};

export const deletePathStep = (steps: PathStepV2[], stepId: string): PathStepV2[] =>
  steps.filter((s) => s.id !== stepId);
