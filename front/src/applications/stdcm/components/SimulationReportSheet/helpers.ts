import type { TFunction } from 'i18next';

import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { dateToHHMMSS } from 'utils/date';
import { capitalizeFirstLetter } from 'utils/strings';

export const getSecondaryCode = ({ location }: StdcmPathStep) => location!.secondary_code;

export const getStopType = (step: StdcmPathStep, t: TFunction) => {
  if (!step.isVia) {
    return t('serviceStop');
  }
  return capitalizeFirstLetter(t(`stdcm:trainPath.stopType.${step.stopType}`));
};

export const getArrivalTimes = (step: StdcmPathStep, t: TFunction, shouldDisplay: boolean) => {
  if (shouldDisplay && !step.isVia) {
    if (step.arrival && step.arrivalType === 'preciseTime') {
      return dateToHHMMSS(step.arrival, { withoutSeconds: true });
    }
    return t('asap');
  }
  return '';
};
