import type { Margin } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';

const formatMargin = (pathSteps: PathStep[]): Margin => {
  const margins: Margin = {
    boundaries: [],
    values: [],
  };

  pathSteps.forEach((step, index) => {
    if (index === 0) {
      margins.values.push(step.theoreticalMargin || 'none');
    } else if (step.theoreticalMargin !== pathSteps[index - 1].theoreticalMargin) {
      margins.boundaries.push(step.id);
      margins.values.push(step.theoreticalMargin || 'none');
    }
  });
  return margins;
};

export default formatMargin;
