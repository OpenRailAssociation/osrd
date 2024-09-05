import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { AiOutlineTags } from 'react-icons/ai';
import { MdOutlineAccessTime, MdOutlineDriveFileRenameOutline } from 'react-icons/md';
import { SlSpeedometer } from 'react-icons/sl';
import { useSelector } from 'react-redux';

import { isInvalidName } from 'applications/operationalStudies/utils';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { useAppDispatch } from 'store';
import { dateTimeToIso } from 'utils/date';
import { useDebounce } from 'utils/helpers';
import { isInvalidFloatNumber } from 'utils/numbers';

export default function TrainSettings() {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const { getLabels, getInitialSpeed, getName, getStartTime } = useOsrdConfSelectors();
  const { updateLabels, updateInitialSpeed, updateName, updateStartTime } = useOsrdConfActions();

  const labels = useSelector(getLabels);
  const nameFromStore = useSelector(getName);
  const initialSpeedFromStore = useSelector(getInitialSpeed);
  const startTimeFromStore = useSelector(getStartTime);

  const [name, setName] = useState<string>(nameFromStore);
  const [startTime, setStartTime] = useState(startTimeFromStore.substring(0, 19));
  const [initialSpeed, setInitialSpeed] = useState<number | undefined>(initialSpeedFromStore);
  const dispatch = useAppDispatch();

  const debouncedName = useDebounce(name, 500);
  const debouncedInitialSpeed = useDebounce(initialSpeed!, 500);
  const debouncedStartTime = useDebounce(startTime, 500);

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
    const formatedStartTime = dateTimeToIso(debouncedStartTime);
    if (formatedStartTime) dispatch(updateStartTime(formatedStartTime));
  }, [debouncedStartTime]);

  useEffect(() => {
    dispatch(updateInitialSpeed(debouncedInitialSpeed));
  }, [debouncedInitialSpeed]);

  useEffect(() => {
    setName(nameFromStore);
    setInitialSpeed(initialSpeedFromStore);
    setStartTime(startTimeFromStore.substring(0, 19));
  }, [nameFromStore, initialSpeedFromStore, startTimeFromStore]);

  const isInvalidTrainScheduleName = isInvalidName(name);

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
          isInvalid={isInvalidTrainScheduleName}
          errorMsg={
            !name ? `${t('errorMessages.requiredField')}` : `${t('errorMessages.nameLengthLimit')}`
          }
          noMargin
        />
      </div>
      <div className="col-xl-4 col-lg-5 pr-2">
        <InputSNCF
          type="datetime-local"
          label={
            <>
              <MdOutlineAccessTime />
              {/* TODO TS2 : rename trainScheduleDepartureTime key to trainScheduleStartTime everywhere */}
              <small className="text-nowrap">{t('trainScheduleDepartureTime')}</small>
            </>
          }
          id="trainSchedule-startTime"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)}
          value={startTime}
          isInvalid={!startTime}
          errorMsg={t('errorMessages.mandatoryField')}
          noMargin
        />
      </div>
      <div className="col-xl-2 col-lg-3 pr-xl-2">
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
          min={0}
          noMargin
          unit="km/h"
          textRight
          isInvalid={isInvalidFloatNumber(initialSpeed as number, 1)}
          errorMsg={t('errorMessages.invalidInitialSpeed')}
        />
      </div>
      <div className="col-xl-4 col-lg-12 mt-xl-0 mt-lg-3">
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
