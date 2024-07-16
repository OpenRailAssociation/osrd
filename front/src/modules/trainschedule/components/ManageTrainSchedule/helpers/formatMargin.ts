import type { Margin } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';

const formatMargin = (pathSteps: PathStep[]): Margin | undefined => {
  const boundaries: string[] = [];
  const values: string[] = [];

  pathSteps.forEach(({ id, theoreticalMargin }, index) => {
    if (index === 0) {
      values.push(theoreticalMargin || '0%');
    } else if (index === pathSteps.length - 1) {
      if (values.length === 1 && values[0] !== '0%' && values[0] !== '0min/100km') {
        boundaries.push(id);
        values.push('0%');
      }
    } else if (theoreticalMargin) {
      boundaries.push(id);
      values.push(theoreticalMargin);
    }
  });

  if (values.length === 1) {
    return undefined;
  }
  return { boundaries, values };
};

export default formatMargin;
