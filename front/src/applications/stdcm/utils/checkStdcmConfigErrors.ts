import type { TFunction } from 'i18next';
import { isNil } from 'lodash';

import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';

import {
  StdcmConfigErrorTypes,
  ArrivalTimeTypes,
  type StdcmConfigErrors,
  type ConsistErrors,
  type MissingFields,
} from '../types';
import filterMissingFields from './filterMissingFields';
import getInvalidFields from './getInvalidFields';

const checkStdcmConfigErrors = ({
  t,
  dateTimeLocale,
  pathfindingStatus,
  stdcmConf,
  prevFormErrors,
  consistErrors,
  shouldCheckMandatoryFields,
}: {
  t: TFunction<'stdcm'>;
  dateTimeLocale: Intl.Locale;
  pathfindingStatus?: 'success' | 'failure';
  stdcmConf?: OsrdStdcmConfState;
  prevFormErrors?: StdcmConfigErrors;
  consistErrors?: ConsistErrors;
  shouldCheckMandatoryFields?: boolean;
}): StdcmConfigErrors | undefined => {
  const { stdcmPathSteps, rollingStockID, totalMass, totalLength, maxSpeed } = stdcmConf!;
  const origin = stdcmPathSteps.at(0)!;
  const vias = stdcmPathSteps.slice(1, -1);
  const destination = stdcmPathSteps.at(-1)!;

  const missingFields: MissingFields[] = [];

  missingFields.push(
    ...filterMissingFields({
      missingFields: prevFormErrors?.errorDetails?.missingFields,
      rollingStockID,
      totalMass,
      totalLength,
      maxSpeed,
      origin,
      vias,
      destination,
      checkAllFields: shouldCheckMandatoryFields,
    })
  );

  let invalidFields = consistErrors ? getInvalidFields(consistErrors) : [];

  if (!shouldCheckMandatoryFields) {
    const prevInvalid = prevFormErrors?.errorDetails?.invalidFields || [];
    invalidFields = invalidFields.filter((field) =>
      prevInvalid.some((prev) => prev.fieldName === field.fieldName)
    );
  }

  let routeErrors: StdcmConfigErrorTypes[] = [];
  const routeErrorDetails: { originTime?: string; destinationTime?: string } = {};

  if (origin.location && destination.location) {
    if (
      origin.location.uic === destination.location.uic &&
      origin.location.secondary_code === destination.location.secondary_code
    ) {
      routeErrors.push(StdcmConfigErrorTypes.ZERO_LENGTH_PATH);
    }

    const isOriginRespectDestinationSchedule =
      !origin.isVia && origin.arrivalType === ArrivalTimeTypes.RESPECT_DESTINATION_SCHEDULE;
    const isDestinationASAP =
      !destination.isVia && destination.arrivalType === ArrivalTimeTypes.ASAP;

    if (isOriginRespectDestinationSchedule && isDestinationASAP) {
      routeErrors.push(StdcmConfigErrorTypes.NO_SCHEDULED_POINT);
    }

    const areBothPointsScheduled =
      !origin.isVia &&
      !destination.isVia &&
      origin.arrivalType === ArrivalTimeTypes.PRECISE_TIME &&
      destination.arrivalType === ArrivalTimeTypes.PRECISE_TIME;

    if (areBothPointsScheduled) {
      routeErrors.push(StdcmConfigErrorTypes.BOTH_POINT_SCHEDULED);
      routeErrorDetails.originTime = origin.arrival
        ? t('leaveAt', {
            time: origin.arrival.toLocaleString(dateTimeLocale, { timeStyle: 'short' }),
          })
        : t('departureTime');
      routeErrorDetails.destinationTime = destination.arrival
        ? t('arriveAt', {
            time: destination.arrival.toLocaleString(dateTimeLocale, { timeStyle: 'short' }),
          })
        : t('destinationTime');
    }
  }

  if (pathfindingStatus === 'failure') {
    return {
      errorType: StdcmConfigErrorTypes.PATHFINDING_FAILED,
    };
  }

  if (origin.isVia) {
    throw new Error('First step can not be a via');
  }
  if (destination.isVia) {
    throw new Error('Last step can not be a via');
  }

  stdcmPathSteps.forEach((step) => {
    if (step.isVia) {
      const { stopType, stopFor } = step;

      if ((stopType === 'driverSwitch' || stopType === 'serviceStop') && isNil(stopFor)) {
        routeErrors.push(StdcmConfigErrorTypes.VIA_STOP_DURATION_MISSING);
      }

      if (stopType === 'driverSwitch' && !isNil(stopFor) && stopFor.total('minute') < 3) {
        routeErrors.push(StdcmConfigErrorTypes.VIA_STOP_DURATION_TOO_SHORT);
      }

      if (stopType === 'serviceStop' && stopFor?.total('minute') === 0) {
        routeErrors.push(StdcmConfigErrorTypes.VIA_STOP_DURATION_MISSING);
      }
    }
  });

  const prevRouteErrors = prevFormErrors?.errorDetails?.routeErrors || [];

  if (!shouldCheckMandatoryFields) {
    const keptErrors: StdcmConfigErrorTypes[] = [];

    for (const error of routeErrors) {
      if (prevRouteErrors.includes(error)) {
        keptErrors.push(error);
      }
    }

    routeErrors = keptErrors;
  }

  const finalMissingFields = missingFields.length > 0 ? missingFields : undefined;
  const finalInvalidFields = invalidFields.length > 0 ? invalidFields : undefined;
  const finalRouteErrors = routeErrors.length > 0 ? routeErrors : undefined;

  const stillHasErrors = !!finalMissingFields || !!finalInvalidFields || !!finalRouteErrors;

  if (!stillHasErrors) {
    return undefined;
  }

  const activeErrorTypes = [finalMissingFields, finalInvalidFields, finalRouteErrors].filter(
    Boolean
  ).length;

  let errorType: StdcmConfigErrorTypes;

  if (activeErrorTypes > 1) {
    errorType = StdcmConfigErrorTypes.MULTIPLE_ERRORS;
  } else if (finalMissingFields) {
    errorType = StdcmConfigErrorTypes.MISSING_INFORMATIONS;
  } else if (finalInvalidFields) {
    errorType = StdcmConfigErrorTypes.INVALID_FIELDS;
  } else {
    const [firstRouteError] = routeErrors;
    errorType = firstRouteError;
  }

  return {
    errorType,
    errorDetails: {
      ...(finalMissingFields && { missingFields: finalMissingFields }),
      ...(finalInvalidFields && { invalidFields: finalInvalidFields }),
      ...(finalRouteErrors && { routeErrors: finalRouteErrors, ...routeErrorDetails }),
    },
  };
};
export default checkStdcmConfigErrors;
