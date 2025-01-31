import type { TFunction } from 'i18next';
import { isNil } from 'lodash';

import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { dateToHHMMSS } from 'utils/date';

import {
  StdcmConfigErrorTypes,
  ArrivalTimeTypes,
  type StdcmConfigErrors,
  type ConsistErrors,
  type MissingFields,
} from '../types';

const checkStdcmConfigErrors = ({
  t,
  pathfindingStatus,
  stdcmConf,
  prevFormErros,
  shouldCheckMandatoryFields,
}: {
  t: TFunction;
  pathfindingStatus?: 'success' | 'failure';
  stdcmConf?: OsrdStdcmConfState;
  prevFormErros?: StdcmConfigErrors;
  consistErrors?: ConsistErrors;
  shouldCheckMandatoryFields?: boolean;
}): StdcmConfigErrors | undefined => {
  const { stdcmPathSteps, rollingStockID, totalMass, totalLength, maxSpeed } = stdcmConf!;
  const origin = stdcmPathSteps.at(0)!;
  const destination = stdcmPathSteps.at(-1)!;
  const missingFields: MissingFields[] = [];

  if (shouldCheckMandatoryFields) {
    if (!rollingStockID) missingFields.push('tractionEngine');
    if (isNil(totalMass)) missingFields.push('totalMass');
    if (isNil(totalLength)) missingFields.push('totalLength');
    if (isNil(maxSpeed)) missingFields.push('maxSpeed');
    if (!origin.location) {
      missingFields.push('origin');
    }
    if (!destination.location) {
      missingFields.push('destination');
    }

    if (missingFields.length > 0) {
      return {
        errorType: StdcmConfigErrorTypes.MISSING_INFORMATIONS,
        errorDetails: { missingFields },
      };
    }
  }

  if (origin.isVia) {
    throw new Error('First step can not be a via');
  }
  if (destination.isVia) {
    throw new Error('Last step can not be a via');
  }

  if (
    origin.location?.uic === destination.location?.uic &&
    origin.location?.secondary_code === destination.location?.secondary_code
  ) {
    return { errorType: StdcmConfigErrorTypes.ZERO_LENGTH_PATH };
  }

  if (pathfindingStatus && pathfindingStatus === 'failure') {
    return { errorType: StdcmConfigErrorTypes.PATHFINDING_FAILED };
  }

  const isOriginRespectDestinationSchedule =
    origin.arrivalType === ArrivalTimeTypes.RESPECT_DESTINATION_SCHEDULE;

  const isDestinationASAP = destination.arrivalType === ArrivalTimeTypes.ASAP;

  const areBothPointsNotSchedule = isOriginRespectDestinationSchedule && isDestinationASAP;

  if (areBothPointsNotSchedule) {
    return { errorType: StdcmConfigErrorTypes.NO_SCHEDULED_POINT };
  }

  const areBothPointsScheduled =
    origin.arrivalType === ArrivalTimeTypes.PRECISE_TIME &&
    destination.arrivalType === ArrivalTimeTypes.PRECISE_TIME;

  if (areBothPointsScheduled) {
    return {
      errorType: StdcmConfigErrorTypes.BOTH_POINT_SCHEDULED,
      errorDetails: {
        originTime: origin?.arrival
          ? t('leaveAt', { time: dateToHHMMSS(origin.arrival, { withoutSeconds: true }) })
          : t('departureTime'),
        destinationTime: destination?.arrival
          ? t('arriveAt', { time: dateToHHMMSS(destination.arrival, { withoutSeconds: true }) })
          : t('destinationTime'),
      },
    };
  }

  const isOnePointScheduledWithoutTime =
    (origin.arrivalType === ArrivalTimeTypes.PRECISE_TIME && !origin.arrival) ||
    (destination.arrivalType === ArrivalTimeTypes.PRECISE_TIME && !destination.arrival);

  if (isOnePointScheduledWithoutTime) {
    return { errorType: StdcmConfigErrorTypes.NO_SCHEDULED_POINT };
  }
  return prevFormErros?.errorType === StdcmConfigErrorTypes.MISSING_INFORMATIONS
    ? prevFormErros
    : undefined;
};

export default checkStdcmConfigErrors;
