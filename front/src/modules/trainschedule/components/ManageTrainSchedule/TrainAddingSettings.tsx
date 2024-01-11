import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { AiOutlineNumber } from 'react-icons/ai';
import { IoFootstepsSharp } from 'react-icons/io5';
import { RxSpaceEvenlyHorizontally } from 'react-icons/rx';

import { useDebounce } from 'utils/helpers';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';

export default function TrainAddingSettings() {
  const { getTrainStep, getTrainCount, getTrainDelta } = useOsrdConfSelectors();
  const { updateTrainStep, updateTrainCount, updateTrainDelta } = useOsrdConfActions();
  const [trainStep, setTrainStep] = useState(useSelector(getTrainStep));
  const [trainCount, setTrainCount] = useState(useSelector(getTrainCount));
  const [trainDelta, setTrainDelta] = useState(useSelector(getTrainDelta));
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useDispatch();
  const debouncedTrainStep = useDebounce(trainStep, 500);
  const debouncedTrainCount = useDebounce(trainCount, 500);
  const debouncedTrainDelta = useDebounce(trainDelta, 500);

  useEffect(() => {
    dispatch(updateTrainStep(debouncedTrainStep));
  }, [debouncedTrainStep]);

  useEffect(() => {
    dispatch(updateTrainCount(debouncedTrainCount));
  }, [debouncedTrainCount]);

  useEffect(() => {
    dispatch(updateTrainDelta(debouncedTrainDelta));
  }, [debouncedTrainDelta]);

  return (
    <div className="osrd-config-item-container d-flex align-items-start">
      <span className="mr-2">
        <InputSNCF
          type="number"
          label={
            <>
              <IoFootstepsSharp />
              <small className="text-nowrap">{t('trainScheduleStep')}</small>
            </>
          }
          id="osrdconf-trainstep"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrainStep(+e.target.value)}
          value={trainStep}
          noMargin
          isInvalid={trainStep < 1}
          errorMsg={trainStep < 1 ? t('errorMessages.noTrainStepInput') : undefined}
          min={1}
          sm
        />
      </span>
      <span className="mr-2">
        <InputSNCF
          type="number"
          label={
            <>
              <AiOutlineNumber />
              <small className="text-nowrap">{t('trainScheduleCount')}</small>
            </>
          }
          id="osrdconf-traincount"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrainCount(+e.target.value)}
          value={trainCount}
          noMargin
          isInvalid={trainCount < 1}
          errorMsg={trainCount < 1 ? t('errorMessages.noTrainCountInput') : undefined}
          min={1}
          sm
        />
      </span>
      <span>
        <InputSNCF
          type="number"
          label={
            <>
              <RxSpaceEvenlyHorizontally />
              <small className="text-nowrap">{t('trainScheduleDelta')}</small>
            </>
          }
          id="osrdconf-delta"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrainDelta(+e.target.value)}
          value={trainDelta}
          unit="min"
          noMargin
          isInvalid={trainDelta < 1}
          errorMsg={trainDelta < 1 ? t('errorMessages.noDeltaInput') : undefined}
          min={1}
          sm
          textRight
        />
      </span>
    </div>
  );
}
