import { useState } from 'react';

import { min } from 'lodash';
import { useSelector } from 'react-redux';

import type { LightRollingStockWithLiveries, TowedRollingStock } from 'common/api/osrdEditoastApi';
import { updateTotalMass, updateTotalLength, updateMaxSpeed } from 'reducers/osrdconf/stdcmConf';
import { getTotalMass, getTotalLength, getMaxSpeed } from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';
import { kgToT, kmhToMs, msToKmh } from 'utils/physics';

import maxSpeedFromSpeedLimitByTag from '../utils/maxSpeedFromSpeedLimitByTag';

const useStdcmConsist = () => {
  const dispatch = useAppDispatch();

  const [totalMassChanged, setTotalMassChanged] = useState(false);
  const [totalLengthChanged, setTotalLengthChanged] = useState(false);
  const [maxSpeedChanged, setMaxSpeedChanged] = useState(false);

  const totalMass = useSelector(getTotalMass);
  const onTotalMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalMassValue = Number(e.target.value);
    setTotalMassChanged(true);
    dispatch(updateTotalMass(totalMassValue === 0 ? undefined : totalMassValue));
  };

  const totalLength = useSelector(getTotalLength);
  const onTotalLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalLengthValue = Number(e.target.value);
    setTotalLengthChanged(true);
    dispatch(updateTotalLength(totalLengthValue === 0 ? undefined : totalLengthValue));
  };

  const maxSpeed = useSelector(getMaxSpeed);
  const onMaxSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalMaxSpeed = Number(e.target.value);
    setMaxSpeedChanged(true);
    dispatch(updateMaxSpeed(totalMaxSpeed === 0 ? undefined : totalMaxSpeed));
  };

  const prefillConsist = (
    rollingStock?: LightRollingStockWithLiveries,
    towed?: TowedRollingStock,
    maxSpeedTag?: string | null
  ) => {
    if (!totalMassChanged) {
      const consistMass = Math.ceil(kgToT((rollingStock?.mass ?? 0) + (towed?.mass ?? 0)));
      dispatch(updateTotalMass(consistMass > 0 ? consistMass : undefined));
    }

    if (!totalLengthChanged) {
      const consistLength = Math.ceil((rollingStock?.length ?? 0) + (towed?.length ?? 0));
      dispatch(updateTotalLength(consistLength > 0 ? consistLength : undefined));
    }

    if (!maxSpeedChanged) {
      const maxSpeedFromTag = maxSpeedFromSpeedLimitByTag(maxSpeedTag);
      const consistMaxSpeed = min([
        rollingStock?.max_speed,
        towed?.max_speed,
        maxSpeedFromTag ? kmhToMs(maxSpeedFromTag) : undefined,
      ]);
      dispatch(updateMaxSpeed(consistMaxSpeed ? Math.floor(msToKmh(consistMaxSpeed)) : undefined));
    }
  };

  return {
    totalMass,
    onTotalMassChange,
    totalLength,
    onTotalLengthChange,
    maxSpeed,
    onMaxSpeedChange,
    prefillConsist,
  };
};

export default useStdcmConsist;
