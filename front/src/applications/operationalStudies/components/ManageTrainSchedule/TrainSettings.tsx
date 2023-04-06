import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  updateLabels,
  updateDepartureTime,
  updateInitialSpeed,
  updateName,
} from 'reducers/osrdconf';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import { getLabels, getDepartureTime, getInitialSpeed, getName } from 'reducers/osrdconf/selectors';
import { AiOutlineTags } from 'react-icons/ai';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

import { useDebounce } from 'utils/helpers';
import { SlSpeedometer } from 'react-icons/sl';
import { MdOutlineAccessTime, MdOutlineDriveFileRenameOutline } from 'react-icons/md';

export default function TrainSettings() {
  const nameFromStore = useSelector(getName);
  const departureTimeFromStore = useSelector(getDepartureTime);
  const initialSpeedFromStore = useSelector(getInitialSpeed);
  const labels = useSelector(getLabels);
  const [name, setName] = useState<string>(nameFromStore);
  const [departureTime, setDepartureTime] = useState<string>(departureTimeFromStore);
  const [initialSpeed, setInitialSpeed] = useState<number | undefined>(initialSpeedFromStore);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useDispatch();
  const debouncedName = useDebounce(name, 500);
  const debouncedDepartureTime = useDebounce(departureTime, 500);
  const debouncedInitialSpeed = useDebounce(initialSpeed, 500);

  const removeTag = (idx: number) => {
    const newTags = Array.from(labels);
    newTags.splice(idx, 1);
    dispatch(updateLabels(newTags));
  };

  const addTag = (tag: string) => {
    const newTags = Array.from(labels);
    newTags.push(tag);
    dispatch(updateLabels(newTags));
  };

  useEffect(() => {
    dispatch(updateName(debouncedName));
  }, [debouncedName]);

  useEffect(() => {
    dispatch(updateDepartureTime(debouncedDepartureTime));
  }, [debouncedDepartureTime]);

  useEffect(() => {
    dispatch(updateInitialSpeed(debouncedInitialSpeed));
  }, [debouncedInitialSpeed]);

  useEffect(() => {
    setName(nameFromStore);
    setDepartureTime(departureTimeFromStore);
    setInitialSpeed(initialSpeedFromStore);
  }, [nameFromStore, departureTimeFromStore, initialSpeedFromStore]);

  return (
    <div className="row no-gutters">
      <div className="col-xl-2 col-lg-4 pr-2">
        <InputSNCF
          type="text"
          label={
            <>
              <MdOutlineDriveFileRenameOutline />
              <span className="text-nowrap">{t('trainScheduleName')}</span>
            </>
          }
          id="trainSchedule-name"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          value={name}
          isInvalid={!name}
          errorMsg={t('errorMessages.mandatoryField')}
          noMargin
        />
      </div>
      <div className="col-xl-2 col-lg-4 pr-2">
        <InputSNCF
          type="time"
          label={
            <>
              <MdOutlineAccessTime />
              <small className="text-nowrap">{t('trainScheduleDepartureTime')}</small>
            </>
          }
          id="trainSchedule-departureTime"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDepartureTime(e.target.value)}
          value={departureTime}
          isInvalid={!departureTime}
          errorMsg={t('errorMessages.mandatoryField')}
          noMargin
        />
      </div>
      <div className="col-xl-2 col-lg-4 pr-xl-2">
        <InputSNCF
          type="number"
          label={
            <>
              <SlSpeedometer />
              <small className="text-nowrap">{t('trainScheduleInitialSpeed')}</small>
            </>
          }
          id="trainSchedule-initialSpeed"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInitialSpeed(+e.target.value)}
          value={initialSpeed}
          noMargin
          unit="km/h"
        />
      </div>
      <div className="col-xl-6 col-lg-12 mt-xl-0 mt-lg-3">
        <ChipsSNCF
          addTag={addTag}
          tags={labels}
          removeTag={removeTag}
          color="green"
          title={
            <>
              <AiOutlineTags />
              <small className="text-nowrap">{t('trainLabels')}</small>
            </>
          }
        />
      </div>
    </div>
  );
}
