import { useEffect, useMemo, useState } from 'react';

import { compact } from 'lodash';
import { useSelector } from 'react-redux';

import type { ManageTimetableItemPathProperties } from 'applications/operationalStudies/types';
import type { RollingStock } from 'common/api/osrdEditoastApi';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import type { RangedValue } from 'common/types';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import {
  getPowerRestrictions,
  getPathSteps,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { mmToM } from 'utils/physics';

import usePowerRestrictionsSelectorBehaviours from './usePowerRestrictionsSelectorBehaviours';
import formatPowerRestrictions from '../helpers/formatPowerRestrictions';
import getPowerRestrictionsWarningsData from '../helpers/powerRestrictionWarnings';

const usePowerRestrictionsSelector = (
  voltageRanges: RangedValue[],
  rollingStockPowerRestrictions: RollingStock['power_restrictions'],
  rollingStockModes: RollingStock['effort_curves']['modes'],
  pathProperties: ManageTimetableItemPathProperties
) => {
  const powerRestrictionRanges = useSelector(getPowerRestrictions);
  const pathSteps = compact(useSelector(getPathSteps));

  // custom empty interval items, which were created by the user thanks to the cut tool
  // (with begin and end in meters)
  // if the users sets it a value, it will be converted into a power restriction range and
  // removed from the customRanges
  const [customRanges, setCustomRanges] = useState<IntervalItem[]>([]);
  const [ranges, setRanges] = useState<IntervalItem[]>([]);

  const electrificationChangePoints = useMemo(() => {
    const specialPoints = voltageRanges.map((range) => ({
      position: mmToM(range.end),
    }));
    specialPoints.pop();
    return specialPoints;
  }, [voltageRanges]);

  const powerRestrictionOptions = useMemo(
    () => [NO_POWER_RESTRICTION, ...Object.keys(rollingStockPowerRestrictions)],
    [rollingStockPowerRestrictions]
  );

  const compatibleVoltageRanges = useMemo(() => {
    const handledModes = Object.keys(rollingStockModes);
    return voltageRanges.map(({ begin, end, value: mode }) => ({
      begin: mmToM(begin),
      end: mmToM(end),
      value: handledModes.includes(mode) ? mode : '',
    }));
  }, [voltageRanges]);

  const {
    resizeSegments,
    mergePowerRestrictionRange,
    deletePowerRestrictionRange,
    cutPowerRestrictionRange,
    editPowerRestrictionRanges,
  } = usePowerRestrictionsSelectorBehaviours({
    customRanges,
    pathProperties,
    pathSteps,
    powerRestrictionRanges,
    ranges,
    setCustomRanges,
  });

  const { warnings, warningsNb } = useMemo(
    () =>
      getPowerRestrictionsWarningsData({
        pathSteps,
        rollingStockPowerRestrictions,
        voltageRanges,
        rollingStockModes,
        powerRestrictionRanges,
      }),
    [
      pathSteps,
      rollingStockPowerRestrictions,
      voltageRanges,
      rollingStockModes,
      powerRestrictionRanges,
    ]
  );

  useEffect(() => {
    const newRanges = formatPowerRestrictions(
      powerRestrictionRanges,
      pathSteps,
      customRanges,
      electrificationChangePoints.map(({ position }) => position),
      mmToM(pathProperties.length)
    );
    setRanges(newRanges);
  }, [electrificationChangePoints, powerRestrictionRanges, customRanges]);

  return {
    ranges,
    compatibleVoltageRanges,
    electrificationChangePoints,
    pathLength: mmToM(pathProperties.length),
    powerRestrictionOptions,
    warnings,
    warningsNb,
    resizeSegments,
    mergePowerRestrictionRange,
    deletePowerRestrictionRange,
    cutPowerRestrictionRange,
    editPowerRestrictionRanges,
  };
};

export default usePowerRestrictionsSelector;
