import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { updateName, updateTrainStep, updateTrainCount, updateTrainDelta } from 'reducers/osrdconf';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

import { getName, getTrainStep, getTrainCount, getTrainDelta } from 'reducers/osrdconf/selectors';
import { useDebounce } from 'utils/helpers';

export default function TrainSettings() {
  const [name, setName] = useState(useSelector(getName));
  const [trainStep, setTrainStep] = useState(useSelector(getTrainStep));
  const [trainCount, setTrainCount] = useState(useSelector(getTrainCount));
  const [trainDelta, setTrainDelta] = useState(useSelector(getTrainDelta));
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useDispatch();
  const debouncedName = useDebounce(name, 500);
  const debouncedTrainStep = useDebounce(trainStep, 500);
  const debouncedTrainCount = useDebounce(trainCount, 500);
  const debouncedTrainDelta = useDebounce(trainDelta, 500);

  useEffect(() => {
    dispatch(updateName(debouncedName));
  }, [debouncedName]);

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
    <div className="osrd-config-item-container d-flex align-items-end mb-2">
      <span className="mr-2 flex-grow-1">
        <InputSNCF
          type="text"
          label={t('trainScheduleName')}
          id="osrdconf-name"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          value={name}
          noMargin
          sm
        />
      </span>
      <span className="mr-2">
        <InputSNCF
          type="number"
          label={t('trainScheduleStep')}
          id="osrdconf-traincount"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrainStep(+e.target.value)}
          value={trainStep}
          noMargin
          sm
        />
      </span>
      <span className="mr-2">
        <InputSNCF
          type="number"
          label={t('trainScheduleCount')}
          id="osrdconf-traincount"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrainCount(+e.target.value)}
          value={trainCount}
          noMargin
          sm
        />
      </span>
      <span className="">
        <InputSNCF
          type="number"
          label={t('trainScheduleDelta')}
          id="osrdconf-delta"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTrainDelta(+e.target.value)}
          value={trainDelta}
          unit="min"
          noMargin
          sm
        />
      </span>
    </div>
  );
}
