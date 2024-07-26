import { useEffect, useMemo, useState } from 'react';

import { compact } from 'lodash';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { RangedValue, RollingStock } from 'common/api/osrdEditoastApi';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { mmToM } from 'utils/physics';

import usePowerRestrictionSelectorBehaviours from './usePowerRestrictionSelectorBehaviours';
import { NO_POWER_RESTRICTION } from '../consts';
import formatPowerRestrictions from '../helpers/formatPowerRestrictions';
import getPowerRestrictionsWarningsData from '../helpers/powerRestrictionWarnings';

const usePowerRestrictionSelector = (
  voltageRanges: RangedValue[],
  rollingStockPowerRestrictions: RollingStock['power_restrictions'],
  rollingStockModes: RollingStock['effort_curves']['modes'],
  pathProperties: ManageTrainSchedulePathProperties
) => {
  const { getPowerRestrictionV2, getPathSteps } = useOsrdConfSelectors();
  const powerRestrictionRanges = useSelector(getPowerRestrictionV2);
  const pathSteps = compact(useSelector(getPathSteps));

  const [cutPositions, setCutPositions] = useState<number[]>([]); // in meters
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
    deletePowerRestrictionRange,
    cutPowerRestrictionRange,
    editPowerRestrictionRanges,
  } = usePowerRestrictionSelectorBehaviours({
    cutPositions,
    pathProperties,
    pathSteps,
    powerRestrictionRanges,
    ranges,
    setCutPositions,
  });

  const { warnings, warningsNb } = useMemo(
    () =>
      getPowerRestrictionsWarningsData({
        pathSteps,
        rollingStockPowerRestrictions,
        pathElectrificationRanges: voltageRanges,
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
      [...electrificationChangePoints.map(({ position }) => position), ...cutPositions],
      compact(pathSteps),
      mmToM(pathProperties.length)
    );
    setRanges(newRanges);
  }, [electrificationChangePoints, cutPositions, powerRestrictionRanges]);

  return {
    ranges,
    compatibleVoltageRanges,
    electrificationChangePoints,
    pathLength: mmToM(pathProperties.length),
    powerRestrictionOptions,
    warnings,
    warningsNb,
    resizeSegments,
    deletePowerRestrictionRange,
    cutPowerRestrictionRange,
    editPowerRestrictionRanges,
  };
};

export default usePowerRestrictionSelector;
