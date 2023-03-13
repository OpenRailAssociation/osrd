import { Dispatch } from 'redux';
import { TFunction } from 'i18next';

import {
  ALLOWANCE_UNIT_TYPES,
  TYPES_UNITS,
} from 'applications/operationalStudies/components/SimulationResults/Allowances/allowancesConsts';
import { STDCM_MODES, OsrdMultiConfState } from 'applications/operationalStudies/consts';
import { time2sec } from 'utils/timeManipulation';
import { makeEnumBooleans } from 'utils/constants';

import { ActionFailure } from 'reducers/main';
import { ThunkAction } from 'types';

export default function formatStdcmConf(
  dispatch: Dispatch,
  setFailure: (e: Error) => ThunkAction<ActionFailure>,
  t: TFunction,
  osrdconf: OsrdMultiConfState
) {

  const specificSection = osrdconf.stdcmConf

  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, specificSection.stdcmMode);

  let error = false;
  if (!specificSection.origin && isByOrigin) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOrigin'),
      })
    );
  }
  if (!specificSection.originTime && isByOrigin) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOriginTime'),
      })
    );
  }
  if (!specificSection.destination && isByDestination) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noDestination'),
      })
    );
  }
  if (!specificSection.destinationTime && isByDestination) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOriginTime'),
      })
    );
  }
  if (!specificSection.rollingStockID) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noRollingStock'),
      })
    );
  }
  if (!specificSection.infraID) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noName'),
      })
    );
  }
  if (!specificSection.timetableID) {
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

  const originDate = specificSection.originTime ? time2sec(specificSection.originTime) : null;
  const destinationDate = specificSection.destinationTime ? time2sec(specificSection.destinationTime) : null;
  const maximumDepartureDelay =
  specificSection.originTime && specificSection.originUpperBoundTime
      ? time2sec(specificSection.originUpperBoundTime) - time2sec(specificSection.originTime)
      : null;

  if (!error) {
    const standardAllowanceType: string =
      (specificSection.standardStdcmAllowance?.type as string) || ALLOWANCE_UNIT_TYPES.PERCENTAGE;
    const standardAllowanceValue: number = specificSection.standardStdcmAllowance?.value || 0;
    const standardAllowance: { [index: string]: any } = {};
    const typeUnitTanslationIndex: { [index: string]: any } = TYPES_UNITS;
    const correspondantTypesForApi: string = typeUnitTanslationIndex[standardAllowanceType];
    standardAllowance[correspondantTypesForApi] = standardAllowanceValue;
    standardAllowance.value_type = standardAllowanceType;

    const osrdConfStdcm = {
      infra: specificSection.infraID,
      rolling_stock: specificSection.rollingStockID,
      comfort: specificSection.rollingStockComfort,
      timetable: specificSection.timetableID,
      start_time: originDate, // Build a date
      end_time: destinationDate, // Build a date
      start_points: [
        {
          track_section: specificSection?.origin?.id,
          geo_coordinate: specificSection?.origin?.clickLngLat,
        },
      ],
      end_points: [
        {
          track_section: specificSection?.destination?.id,
          geo_coordinate: specificSection?.destination?.clickLngLat,
        },
      ],
      maximum_departure_delay: maximumDepartureDelay,
      maximum_relative_run_time: 2,
      speed_limit_tags: specificSection.speedLimitByTag,
      margin_before: specificSection.gridMarginBefore,
      margin_after: specificSection.gridMarginAfter,
      standard_allowance: standardAllowance,
    };

    if (standardAllowance.value > 0) osrdConfStdcm.standard_allowance = standardAllowance;
    return osrdConfStdcm;
  }
  return false;
}
