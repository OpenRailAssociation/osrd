import { useState, useMemo, useEffect } from 'react';

import { Input } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { StdcmPathStep } from 'reducers/osrdconf/types';

import { StdcmStopTypes } from '../types';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';

type StdcmInputViaProps = {
  stopType: StdcmStopTypes.DRIVER_SWITCH | StdcmStopTypes.SERVICE_STOP;
  pathStep: StdcmPathStep;
};

const StdcmInputVia = ({ stopType, pathStep }: StdcmInputViaProps) => {
  const { t } = useTranslation('stdcm');

  const dispatch = useAppDispatch();
  const { updateStdcmPathStep: updatePathStep } = useOsrdConfActions() as StdcmConfSliceActions;

  const [inputValue, setInputValue] = useState('');
  const debouncedInputValue = useDebounce(inputValue, 500);

  const stopWarning = useMemo(
    () => stopType === StdcmStopTypes.DRIVER_SWITCH && Number(inputValue) < 3,
    [inputValue]
  );

  useEffect(() => {
    if (!Number.isNaN(+debouncedInputValue)) {
      const newPathStep = { ...pathStep, stopFor: debouncedInputValue };
      dispatch(updatePathStep(newPathStep));
    }
  }, [debouncedInputValue]);

  useEffect(() => {
    const { stopFor } = pathStep;
    if (stopFor !== undefined && stopFor !== inputValue) {
      setInputValue(stopFor);
    }
  }, [pathStep.stopFor]);

  return (
    <div className="stdcm-v2-via-stop-for stop-time">
      <Input
        id="stdcm-v2-via-stop-time"
        type="text"
        label={t('trainPath.stopFor')}
        onChange={(e) => {
          // TODO: Find a better way to prevent user from entering decimal values
          const value = e.target.value.replace(/[\D.,]/g, '');
          setInputValue(value);
        }}
        value={inputValue}
        trailingContent="minutes"
        statusWithMessage={
          stopWarning
            ? {
                status: 'warning',
                message: t('trainPath.warningMinStopTime'),
              }
            : undefined
        }
      />
    </div>
  );
};

export default StdcmInputVia;
