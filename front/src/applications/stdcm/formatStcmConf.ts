import { Dispatch } from 'redux';
import { TFunction } from 'i18next';

import { TYPES_UNITS } from 'applications/operationalStudies/components/SimulationResults/Allowances/allowancesConsts';
import { STDCM_MODES, OsrdConfState } from 'applications/operationalStudies/consts';
import { time2sec } from 'utils/timeManipulation';
import { makeEnumBooleans } from 'utils/constants';

import { ActionFailure } from 'reducers/main';
import { ThunkAction } from 'types';

type standardStdcmAllowanceForApi = {
  value_type: number;
  minutes?: number;
  seconds?: number;
  percentage?: number;
};

type typeUnitTranslation = {
  time: string;
  percentage: string;
  time_per_distance: string;
};

export default function formatStdcmConf(
  dispatch: Dispatch,
  setFailure: (e: Error) => ThunkAction<ActionFailure>,
  t: TFunction,
  osrdconf: OsrdConfState,
  osrdStdcmConf: OsrdConfState
) {
  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, osrdconf.stdcmMode);

  let error = false;
  if (!osrdStdcmConf.origin && isByOrigin) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOrigin'),
      })
    );
  }
  if (!osrdStdcmConf.originTime && isByOrigin) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOriginTime'),
      })
    );
  }
  if (!osrdStdcmConf.destination && isByDestination) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noDestination'),
      })
    );
  }
  if (!osrdStdcmConf.destinationTime && isByDestination) {
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

  const originDate = osrdStdcmConf.originTime ? time2sec(osrdconf.originTime) : null;
  const destinationDate = osrdStdcmConf.destinationTime ? time2sec(osrdconf.destinationTime) : null;
  const maximumDepartureDelay =
  osrdStdcmConf.originTime && osrdStdcmConf.originUpperBoundTime
      ? time2sec(osrdconf.originUpperBoundTime) - time2sec(osrdconf.originTime)
      : null;

  if (!error) {
    const standardAllowanceType: string =
      (osrdStdcmConf.standardStdcmAllowance?.type as string) || 'time';
    const standardAllowanceValue: number = osrdStdcmConf.standardStdcmAllowance?.value || 0;
    const standardAllowance: { [index: string]: any } = {};
    const typeUnitTanslationIndex: { [index: string]: any } = TYPES_UNITS;
    const correspondantTypesForApi: string = typeUnitTanslationIndex[standardAllowanceType];
    standardAllowance[correspondantTypesForApi] = standardAllowanceValue;
    standardAllowance.value_type = standardAllowanceType;

    const osrdConfStdcm = {
      infra: osrdconf.infraID,
      rolling_stock: osrdconf.rollingStockID,
      comfort: osrdconf.rollingStockComfort,
      timetable: osrdconf.timetableID,
      start_time: originDate, // Build a date
      end_time: destinationDate, // Build a date
      start_points: [
        {
          track_section: osrdStdcmConf?.origin?.id,
          geo_coordinate: osrdStdcmConf?.origin?.clickLngLat,
        },
      ],
      end_points: [
        {
          track_section: osrdStdcmConf?.destination?.id,
          geo_coordinate: osrdStdcmConf?.destination?.clickLngLat,
        },
      ],
      maximum_departure_delay: maximumDepartureDelay,
      maximum_relative_run_time: 2,
      speed_limit_composition: osrdconf.speedLimitByTag,
      margin_before: osrdconf.gridMarginBefore,
      margin_after: osrdconf.gridMarginAfter,
      standard_allowance: standardAllowance,
    };

    if (standardAllowance.value > 0) osrdConfStdcm.standard_allowance = standardAllowance;
    return osrdConfStdcm;
  }
  return false;
}
