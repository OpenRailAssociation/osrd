import { useEffect, useState } from 'react';

import { Ruby } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { AiOutlineTags } from 'react-icons/ai';
import { MdOutlineAccessTime, MdOutlineDriveFileRenameOutline } from 'react-icons/md';
import { SlSpeedometer } from 'react-icons/sl';
import { useSelector } from 'react-redux';

import { isInvalidName } from 'applications/operationalStudies/utils';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import { isMainCategory } from 'modules/rollingStock/helpers/utils';
import useCategoryOptions, {
  type CategoryOption,
} from 'modules/rollingStock/hooks/useCategoryOptions';
import {
  updateLabels,
  updateName,
  updateStartTime,
  updateInitialSpeed,
  updateCategory,
} from 'reducers/osrdconf/operationalStudiesConf';
import {
  getLabels,
  getName,
  getInitialSpeed,
  getStartTime,
  getCategory,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';
import { parseLocalDateTime, formatLocalDateTime } from 'utils/date';
import { isInvalidFloatNumber } from 'utils/numbers';
import { SMALL_INPUT_MAX_LENGTH } from 'utils/strings';

const TrainSettings = () => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
  const { t: tRollingStock } = useTranslation();
  const dispatch = useAppDispatch();
  const categoryOptions = useCategoryOptions();

  const labels = useSelector(getLabels);
  const name = useSelector(getName);
  const initialSpeed = useSelector(getInitialSpeed);
  const startTime = useSelector(getStartTime);
  const categoryFromStore = useSelector(getCategory);

  const [trainCategory, setTrainCategory] = useState<CategoryOption>();

  const removeTag = (idx: number) => {
    const newTags = [...labels];
    newTags.splice(idx, 1);
    dispatch(updateLabels(newTags));
  };

  const addTag = (tag: string) => {
    dispatch(updateLabels([...labels, tag]));
  };

  const handleStartTimeChange = (value: string) => {
    const newStartTime = parseLocalDateTime(value);
    if (newStartTime) {
      dispatch(updateStartTime(newStartTime));
    }
  };

  useEffect(() => {
    dispatch(
      updateCategory(
        trainCategory?.id
          ? {
              main_category: trainCategory.id,
            }
          : null
      )
    );
  }, [trainCategory]);

  useEffect(() => {
    if (categoryFromStore) {
      setTrainCategory({
        id: isMainCategory(categoryFromStore) ? categoryFromStore.main_category : undefined,
        label: tRollingStock(`rollingStock.categoriesOptions.${categoryFromStore}`),
      });
    }
  }, [categoryFromStore, tRollingStock]);

  const isInvalidTimetableItemName = isInvalidName(name);

  return (
    <div className="row no-gutters">
      <div className="col-xl-2 col-lg-4 pr-2">
        <InputSNCF
          type="text"
          label={
            <>
              <MdOutlineDriveFileRenameOutline />
              <span className="text-nowrap">{t('timetableItemName')}</span>
            </>
          }
          id="timetable-item-name"
          onChange={(e) => dispatch(updateName(e.target.value))}
          value={name}
          isInvalid={isInvalidTimetableItemName}
          errorMsg={!name ? t('errorMessages.requiredField') : t('errorMessages.nameLengthLimit')}
          noMargin
          inputProps={{
            maxLength: SMALL_INPUT_MAX_LENGTH,
          }}
        />
      </div>
      <div className="col-xl-3 col-lg-5 pr-2">
        <InputSNCF
          type="datetime-local"
          label={
            <>
              <MdOutlineAccessTime />
              {/* TODO TS2 : rename timetableItemDepartureTime key to timetableItemStartTime everywhere */}
              <small className="text-nowrap">{t('timetableItemDepartureTime')}</small>
            </>
          }
          id="start-time"
          onChange={(e) => {
            handleStartTimeChange(e.target.value);
          }}
          value={formatLocalDateTime(startTime)}
          isInvalid={!startTime}
          errorMsg={t('errorMessages.mandatoryField')}
          noMargin
        />
      </div>
      <div className="col-xl-3 col-lg-3 pr-xl-2">
        <SelectSNCF
          id="category-selector"
          name="category-selector"
          label={
            <>
              <Ruby />
              <small className="text-nowrap">{t('category')}</small>
            </>
          }
          onChange={setTrainCategory}
          value={trainCategory ?? { label: tRollingStock('rollingStock.categoriesOptions.choose') }}
          options={categoryOptions}
        />
      </div>
      <div className="col-xl-2 col-lg-3 pr-xl-2">
        <InputSNCF
          type="number"
          label={
            <>
              <SlSpeedometer />
              <small className="text-nowrap">{t('timetableItemInitialSpeed')}</small>
            </>
          }
          id="initial-speed"
          onChange={(e) => dispatch(updateInitialSpeed(+e.target.value))}
          value={initialSpeed}
          min={0}
          noMargin
          unit="km/h"
          textRight
          isInvalid={isInvalidFloatNumber(initialSpeed!, 1)}
          errorMsg={t('errorMessages.invalidInitialSpeed')}
        />
      </div>
      <div className="col-xl-2 col-lg-12 mt-xl-0 mt-lg-3">
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
};

export default TrainSettings;
