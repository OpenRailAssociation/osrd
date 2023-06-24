import { Dispatch } from 'redux';
import { TFunction } from 'i18next';

import {
  ALLOWANCE_UNIT_TYPES,
  TYPES_UNITS,
} from 'applications/stdcm/components/OldAllowances/allowancesConsts';
import { STDCM_MODES, OsrdStdcmConfState } from 'applications/operationalStudies/consts';
import { time2sec } from 'utils/timeManipulation';
import { makeEnumBooleans } from 'utils/constants';

import { ActionFailure } from 'reducers/main';
import { ThunkAction } from 'types';
import { getOpenApiSteps } from 'common/Pathfinding/Pathfinding';

export default function formatStdcmConf(
  dispatch: Dispatch,
  setFailure: (e: Error) => ThunkAction<ActionFailure>,
  t: TFunction,
  osrdconf: OsrdStdcmConfState
) {
  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, osrdconf.stdcmMode);

  let error = false;
  if (!osrdconf.origin && isByOrigin) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOrigin'),
      })
    );
  }
  if (!osrdconf.originTime && isByOrigin) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOriginTime'),
      })
    );
  }
  if (!osrdconf.destination && isByDestination) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noDestination'),
      })
    );
  }
  if (!osrdconf.destinationTime && isByDestination) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOriginTime'),
      })
    );
  }
  if (!osrdconf.rollingStockID) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noRollingStock'),
      })
    );
  }
  if (!osrdconf.infraID) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noName'),
      })
    );
  }
  if (!osrdconf.timetableID) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noTimetable'),
      })
    );
  }

  // Demander: on indique si c'est par origin ou destination en mettant null sur l'autre ?
  // Demander: format de date
  // Demander: pourquoi tableaux

  const originDate = osrdconf.originTime ? time2sec(osrdconf.originTime) : null;
  const destinationDate = osrdconf.destinationTime ? time2sec(osrdconf.destinationTime) : null;
  const maximumDepartureDelay =
    osrdconf.originTime && osrdconf.originUpperBoundTime
      ? time2sec(osrdconf.originUpperBoundTime) - time2sec(osrdconf.originTime)
      : null;

  if (!error) {
    // TODO: refactor: have a clearer way to set dynamics units
    const standardAllowanceType: string =
      (osrdconf.standardStdcmAllowance?.type as string) || ALLOWANCE_UNIT_TYPES.PERCENTAGE;
    const standardAllowanceValue: number = osrdconf.standardStdcmAllowance?.value || 0;
    const standardAllowance: { [index: string]: string | number } = {};
    const typeUnitTanslationIndex: { [index: string]: string } = TYPES_UNITS;
    const correspondantTypesForApi: string = typeUnitTanslationIndex[standardAllowanceType];
    standardAllowance[correspondantTypesForApi] = standardAllowanceValue;
    standardAllowance.value_type = standardAllowanceType;

    const osrdConfStdcm = {
      ...getOpenApiSteps(osrdconf),
      rolling_stock: osrdconf.rollingStockID,
      comfort: osrdconf.rollingStockComfort,
      timetable: osrdconf.timetableID,
      start_time: originDate, // Build a date
      end_time: destinationDate, // Build a date
      maximum_departure_delay: maximumDepartureDelay,
      speed_limit_tags: osrdconf.speedLimitByTag,
      margin_before: osrdconf.gridMarginBefore,
      margin_after: osrdconf.gridMarginAfter,
      standard_allowance: standardAllowance,
      maximum_run_time: osrdconf.maximumRunTime,
    };

    return osrdConfStdcm;
  }
  return false;
}
