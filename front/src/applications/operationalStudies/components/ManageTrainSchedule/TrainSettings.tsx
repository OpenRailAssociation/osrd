import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { updateName } from 'reducers/osrdconf';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import debounce from 'lodash/debounce';

import { getOSRDConf } from 'reducers/osrdconf/selectors';

export default function TrainSettings() {
  const [trainCount, setTrainCount] = useState(1);
  const [trainStep, setTrainStep] = useState(2);
  const [trainDelta, setTrainDelta] = useState(15);
  const [name, setName] = useState('');
  const osrdconf = useSelector(getOSRDConf);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useDispatch();

  const debouncedUpdateName = debounce((newName) => {
    dispatch(updateName(newName));
  }, 300);

  const handleNameChange = useCallback((newName) => {
    setName(newName);
    debouncedUpdateName(newName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (osrdconf && osrdconf.name) {
      setName(osrdconf.name);
    }
  }, [osrdconf]);

  return (
    osrdconf && (
      <div className="osrd-config-item-container d-flex align-items-end mb-2">
        <span className="mr-2 flex-grow-1">
          <InputSNCF
            type="text"
            label={t('trainScheduleName')}
            id="osrdconf-name"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNameChange(e.target.value)}
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setTrainStep(parseInt(e.target.value, 10))
            }
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
        <span className="mr-2">
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
    )
  );
}
