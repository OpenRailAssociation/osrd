import { useState } from 'react';

import type { InputProps } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type {
  LightRollingStockWithLiveries,
  LoadingGaugeType,
  TowedRollingStock,
} from 'common/api/osrdEditoastApi';
import {
  updateTotalMass,
  updateTotalLength,
  updateMaxSpeed,
  updateLoadingGauge,
} from 'reducers/osrdconf/stdcmConf';
import {
  getTotalMass,
  getTotalLength,
  getMaxSpeed,
  getLoadingGauge,
  getSpeedLimitTags,
} from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';
import { kgToT } from 'utils/physics';

import calculateConsistMaxSpeed from '../utils/calculateConsistMaxSpeed';

const useStdcmConsist = () => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const speedLimitTags = useSelector(getSpeedLimitTags);

  const [totalMassChanged, setTotalMassChanged] = useState(false);
  const [totalLengthChanged, setTotalLengthChanged] = useState(false);
  const [maxSpeedChanged, setMaxSpeedChanged] = useState(false);

  const [statusWithMessage, setStatusWithMessage] = useState<{
    totalMass?: InputProps['statusWithMessage'];
    totalLength?: InputProps['statusWithMessage'];
    maxSpeed?: InputProps['statusWithMessage'];
  }>({});

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

  const loadingGauge = useSelector(getLoadingGauge);
  const onLoadingGaugeChange = (option: LoadingGaugeType) => {
    dispatch(updateLoadingGauge(option));
  };

  const prefillConsist = (
    rollingStock?: LightRollingStockWithLiveries,
    towed?: TowedRollingStock,
    maxSpeedTag?: string | null
  ) => {
    const newStatus: typeof statusWithMessage = {};

    const consistMass = Math.ceil(kgToT((rollingStock?.mass ?? 0) + (towed?.mass ?? 0)));
    dispatch(updateTotalMass(consistMass > 0 ? consistMass : undefined));
    if (totalMassChanged && totalMass !== undefined) {
      newStatus.totalMass = {
        status: 'info',
        message: t('consist.info.totalMass'),
        tooltip: 'left',
      };
    }
    setTotalMassChanged(false);

    const consistLength = Math.ceil((rollingStock?.length ?? 0) + (towed?.length ?? 0));
    dispatch(updateTotalLength(consistLength > 0 ? consistLength : undefined));
    if (totalLengthChanged && totalLength !== undefined) {
      newStatus.totalLength = {
        status: 'info',
        message: t('consist.info.totalLength'),
        tooltip: 'left',
      };
    }
    setTotalLengthChanged(false);

    dispatch(
      updateMaxSpeed(
        calculateConsistMaxSpeed(
          rollingStock,
          towed,
          maxSpeedTag ? (speedLimitTags || {})[maxSpeedTag] : undefined
        )
      )
    );
    if (maxSpeedChanged && maxSpeed !== undefined) {
      newStatus.maxSpeed = {
        status: 'info',
        message: t('consist.info.maxSpeed'),
        tooltip: 'left',
      };
    }
    setMaxSpeedChanged(false);

    setStatusWithMessage(newStatus);
  };

  return {
    totalMass,
    onTotalMassChange,
    totalLength,
    onTotalLengthChange,
    maxSpeed,
    onMaxSpeedChange,
    loadingGauge,
    onLoadingGaugeChange,
    prefillConsist,
    statusWithMessage,
    setMaxSpeedChanged,
    speedLimitTags,
  };
};

export default useStdcmConsist;
