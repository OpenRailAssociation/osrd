import type { Margin } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';

const formatMargin = (pathSteps: PathStep[]): Margin | undefined => {
  const boundaries: string[] = [];
  const values: string[] = [];

  pathSteps.forEach((step, index) => {
    if (index === 0) {
      values.push(step.theoreticalMargin || 'none');
    } else if (index === pathSteps.length - 1) {
      if (values.length === 1 && values[0] !== 'none') {
        boundaries.push(step.id);
        values.push('none');
      }
    } else if (step.theoreticalMargin) {
      boundaries.push(step.id);
      values.push(step.theoreticalMargin);
    }
  });

  if (values.length === 1) {
    return undefined;
  }
  return { boundaries, values };
};

export default formatMargin;
