import { useMemo, useState } from 'react';

import type { InputProps } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type {
  LightRollingStockWithLiveries,
  LoadingGaugeType,
  TowedRollingStock,
} from 'common/api/osrdEditoastApi';
import { getStdcmSpeedLimitsByTag } from 'reducers/osrdconf/stdcmConf/selectors';
import { kgToT } from 'utils/physics';

import type { ConsistData, ConsistErrors } from '../types';
import calculateConsistMaxSpeed from '../utils/calculateConsistMaxSpeed';
import {
  validateMaxSpeed,
  validateTotalLength,
  validateTotalMass,
} from '../utils/consistValidation';

const useStdcmConsist = (
  consist: ConsistData,
  onConsistChange: (consist: ConsistData) => void,
  selectedRollingStock: LightRollingStockWithLiveries | undefined,
  selectedTowedRollingStock: TowedRollingStock | undefined,
  onConsistErrorsChange: (errors: ConsistErrors) => void
) => {
  const { t } = useTranslation('stdcm');
  const speedLimitTags = useSelector(getStdcmSpeedLimitsByTag);

  const [totalMassChanged, setTotalMassChanged] = useState(false);
  const [totalLengthChanged, setTotalLengthChanged] = useState(false);
  const [maxSpeedChanged, setMaxSpeedChanged] = useState(false);

  const [statusWithMessage, setStatusWithMessage] = useState<{
    totalMass?: InputProps['statusWithMessage'];
    totalLength?: InputProps['statusWithMessage'];
    maxSpeed?: InputProps['statusWithMessage'];
  }>({});

  const [consistErrors, setConsistErrors] = useState<ConsistErrors>({
    totalMass: { message: undefined, display: false, type: 'missing' },
    totalLength: { message: undefined, display: false, type: 'missing' },
    maxSpeed: { message: undefined, display: false, type: 'missing' },
  });

  const missingValueMessage = t('consist.errors.missingValue');

  const getMissingFieldMessage = (value?: number): string | null =>
    !value ? missingValueMessage : null;

  const updateConsistErrors = (
    errors: Partial<Record<keyof ConsistErrors, string | undefined>>
  ) => {
    const next = (Object.entries(errors) as [keyof ConsistErrors, string | undefined][]).reduce(
      (acc, [field, error]) => ({
        ...acc,
        [field]: {
          message: error,
          display: !!error,
          type: error === missingValueMessage ? 'missing' : 'invalid',
        },
      }),
      consistErrors
    );
    setConsistErrors(next);
    onConsistErrorsChange(next);
  };

  const onTotalMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalMassValue = Number(e.target.value);
    setTotalMassChanged(true);
    const newMass = totalMassValue === 0 ? undefined : totalMassValue;
    const newError =
      getMissingFieldMessage(newMass) ??
      validateTotalMass({
        tractionEngineMass: selectedRollingStock?.mass,
        towedMass: selectedTowedRollingStock?.mass,
        totalMass: newMass,
      });
    if (consistErrors.totalMass.display) {
      updateConsistErrors({ totalMass: newError });
    }
    onConsistChange({ ...consist, totalMass: newMass });
  };

  const onTotalLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalLengthValue = Number(e.target.value);
    setTotalLengthChanged(true);
    const newLength = totalLengthValue === 0 ? undefined : totalLengthValue;
    const newError =
      getMissingFieldMessage(newLength) ??
      validateTotalLength({
        tractionEngineLength: selectedRollingStock?.length,
        towedLength: selectedTowedRollingStock?.length,
        totalLength: newLength,
      });
    if (consistErrors.totalLength.display) {
      updateConsistErrors({ totalLength: newError });
    }
    onConsistChange({ ...consist, totalLength: newLength });
  };

  const onMaxSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalMaxSpeed = Number(e.target.value);
    setMaxSpeedChanged(true);
    const newSpeed = totalMaxSpeed === 0 ? undefined : totalMaxSpeed;
    const newError =
      getMissingFieldMessage(newSpeed) ??
      validateMaxSpeed(newSpeed, selectedRollingStock?.max_speed);
    if (consistErrors.maxSpeed.display) {
      updateConsistErrors({ maxSpeed: newError });
    }
    onConsistChange({ ...consist, maxSpeed: newSpeed });
  };

  const onLoadingGaugeChange = (option: LoadingGaugeType | undefined) => {
    onConsistChange({ ...consist, loadingGauge: option });
  };

  const prefillConsist = (
    isConsistChange: boolean,
    rollingStock?: LightRollingStockWithLiveries,
    towed?: TowedRollingStock,
    maxSpeedTag?: string | null,
    extraFields?: Partial<ConsistData>
  ) => {
    const newStatus: typeof statusWithMessage = {};

    const consistMass = Math.ceil(kgToT((rollingStock?.mass ?? 0) + (towed?.mass ?? 0)));
    const newTotalMass = consistMass > 0 ? consistMass : undefined;
    if (totalMassChanged && consist.totalMass !== undefined) {
      newStatus.totalMass = {
        status: 'info',
        message: t('consist.info.totalMass'),
        tooltip: 'left',
      };
    }
    setTotalMassChanged(false);

    const consistLength = Math.ceil((rollingStock?.length ?? 0) + (towed?.length ?? 0));
    const newTotalLength = consistLength > 0 ? consistLength : undefined;
    if (totalLengthChanged && consist.totalLength !== undefined) {
      newStatus.totalLength = {
        status: 'info',
        message: t('consist.info.totalLength'),
        tooltip: 'left',
      };
    }
    setTotalLengthChanged(false);

    const newMaxSpeed = isConsistChange
      ? undefined
      : calculateConsistMaxSpeed(
          rollingStock,
          towed,
          maxSpeedTag ? (speedLimitTags || {})[maxSpeedTag] : undefined
        );

    if (maxSpeedChanged && consist.maxSpeed !== undefined) {
      newStatus.maxSpeed = {
        status: 'info',
        message: t('consist.info.maxSpeed'),
        tooltip: 'left',
      };
    }
    setMaxSpeedChanged(false);

    setStatusWithMessage(newStatus);

    onConsistChange({
      ...consist,
      totalMass: newTotalMass,
      totalLength: newTotalLength,
      maxSpeed: newMaxSpeed,
      ...extraFields,
    });

    updateConsistErrors({ totalMass: undefined, totalLength: undefined, maxSpeed: undefined });
  };

  const totalMassError = useMemo(
    () =>
      getMissingFieldMessage(consist.totalMass) ??
      validateTotalMass({
        tractionEngineMass: selectedRollingStock?.mass,
        towedMass: selectedTowedRollingStock?.mass,
        totalMass: consist.totalMass,
      }),
    [consist.totalMass, selectedRollingStock?.mass, selectedTowedRollingStock?.mass]
  );

  const totalLengthError = useMemo(
    () =>
      getMissingFieldMessage(consist.totalLength) ??
      validateTotalLength({
        tractionEngineLength: selectedRollingStock?.length,
        towedLength: selectedTowedRollingStock?.length,
        totalLength: consist.totalLength,
      }),
    [consist.totalLength, selectedRollingStock?.length, selectedTowedRollingStock?.length]
  );

  const maxSpeedError = useMemo(
    () =>
      getMissingFieldMessage(consist.maxSpeed) ??
      validateMaxSpeed(consist.maxSpeed, selectedRollingStock?.max_speed),
    [consist.maxSpeed, selectedRollingStock?.max_speed]
  );

  return {
    onTotalMassChange,
    onTotalLengthChange,
    onMaxSpeedChange,
    onLoadingGaugeChange,
    prefillConsist,
    statusWithMessage,
    setMaxSpeedChanged,
    consistErrors,
    updateConsistErrors,
    totalMassError,
    totalLengthError,
    maxSpeedError,
  };
};

export default useStdcmConsist;
