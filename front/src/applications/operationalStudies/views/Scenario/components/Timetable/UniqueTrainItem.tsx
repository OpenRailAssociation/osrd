import React from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { Clock, Flame, Moon, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { SubCategory, TrainSchedule } from 'common/api/osrdEditoastApi';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import isMainCategory from 'modules/rollingStock/helpers/category';
import { deletePacedTrains } from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import { setFailure, setSuccess } from 'reducers/main';
import type { TimetableItem, TimetableItemId, TrainId } from 'reducers/osrdconf/types';
import {
  updateHoveredTrainId,
  updateTrainIdUsedForProjection,
  updateSelectedTrainId,
  updateProjectionType,
} from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { timeToLocaleStringRounded, useDateTimeLocale } from 'utils/date';
import { addDurationToDate, Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import { extractEditoastIdFromPacedTrainId, formatEditoastIdToPacedTrainId } from 'utils/trainId';

import ArrivalTimeLoader from './ArrivalTimeLoader';
import { TIMETABLE_ITEM_DELTA } from './consts';
import TimetableItemActions from './TimetableItemActions';
import { formatTrainDuration, getTrainCategoryClassName } from './utils';

type UniqueTrainItemProps = {
  isInSelection: boolean;
  train: TimetableItemWithDetails;
  isSelected: boolean;
  isModified?: boolean;
  handleSelectTrain: (trainId: TimetableItemId) => void;
  upsertUniqueTrains: (uniqueTrains: TimetableItem[]) => void;
  removeTrains: (trainIds: TimetableItemId[]) => void;
  projectionPathIsUsed: boolean;
  selectTrainToEdit: (train: TimetableItemWithDetails) => void;
  setSelectedTimetableItemIds: React.Dispatch<React.SetStateAction<TimetableItemId[]>>;
  subCategories: SubCategory[];
  isSelectMode: boolean;
  moveTimetableItem: () => void;
  showMovebutton: boolean;
};

const UniqueTrainItem = ({
  isInSelection,
  train,
  isSelected,
  isModified,
  handleSelectTrain,
  upsertUniqueTrains,
  removeTrains,
  projectionPathIsUsed,
  selectTrainToEdit,
  setSelectedTimetableItemIds,
  subCategories,
  isSelectMode,
  moveTimetableItem,
  showMovebutton,
}: UniqueTrainItemProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dateTimeLocale = useDateTimeLocale();
  const dispatch = useAppDispatch();

  const [postPacedTrain] =
    osrdEditoastApi.endpoints.postTrainScheduleSetsByIdTrainSchedules.useMutation();
  const [getTrainSchedule] = osrdEditoastApi.endpoints.getTrainSchedulesById.useLazyQuery();

  const { summary } = train;

  const changeSelectedTrainId = (trainId: TrainId) => {
    dispatch(updateSelectedTrainId(trainId));
  };

  const deleteTrain = async () => {
    deletePacedTrains(dispatch, [train.id])
      .then(() => {
        removeTrains([train.id]);
        setSelectedTimetableItemIds((prev) => prev.filter((id) => id !== train.id));
        dispatch(
          setSuccess({
            title: t('timetable.trainDeleted', { name: train.name }),
            text: '',
          })
        );
      })
      .catch((e) => {
        dispatch(setFailure(castErrorToFailure(e)));
        if (isSelected) {
          dispatch(updateSelectedTrainId(train.id));
        }
      });
  };

  const duplicateTrain = async () => {
    const trainName = `${train.name} (${t('timetable.copy')})`;

    try {
      const editoastTrainId = extractEditoastIdFromPacedTrainId(train.id);
      const trainDetail = await getTrainSchedule({
        id: editoastTrainId,
      }).unwrap();

      const startTime = addDurationToDate(
        new Date(trainDetail.start_time),
        new Duration({ minutes: TIMETABLE_ITEM_DELTA })
      );

      const newUniqueTrainPayload: TrainSchedule = {
        ...omit(trainDetail, ['id', 'train_schedule_set_id']),
        start_time: startTime.toISOString(),
        train_name: trainName,
      };

      const [newUniqueTrain] = await postPacedTrain({
        id: trainDetail.train_schedule_set_id,
        body: [newUniqueTrainPayload],
      }).unwrap();

      const formattedUniqueTrain: TimetableItem = {
        ...newUniqueTrain,
        id: formatEditoastIdToPacedTrainId(newUniqueTrain.id),
      };
      upsertUniqueTrains([formattedUniqueTrain]);
      dispatch(
        setSuccess({
          title: t('timetable.trainAdded'),
          text: `${trainName}`,
        })
      );
    } catch (e) {
      dispatch(setFailure(castErrorToFailure(e)));
    }
  };

  const selectPathProjection = async () => {
    dispatch(updateTrainIdUsedForProjection(train.id));
    if (!summary?.isValid) dispatch(updateProjectionType('operationalPointProjection'));
  };

  const arrivalTime = summary?.isValid
    ? addDurationToDate(train.startTime, summary.duration)
    : undefined;
  const isAfterMidnight = arrivalTime
    ? dayjs(arrivalTime).isAfter(train.startTime, 'day')
    : undefined;

  const { category } = train;

  const currentSubCategory =
    category && !isMainCategory(category)
      ? subCategories.find((option) => option.code === category.sub_category_code)
      : undefined;

  return (
    <div
      data-testid="scenario-timetable-item"
      data-train-id={train.id}
      className={cx('scenario-timetable-train', {
        selected: isSelected,
        modified: isModified,
        'in-selection': isInSelection,
        invalid: summary && !summary.isValid,
      })}
      onMouseEnter={() => dispatch(updateHoveredTrainId(train.id))}
      onMouseLeave={() => dispatch(updateHoveredTrainId(undefined))}
    >
      <div
        data-testid="scenario-timetable-unique-train-button"
        role="button"
        tabIndex={0}
        onClick={() => changeSelectedTrainId(train.id)}
        className="w-full clickable-button"
      >
        <div
          className={cx('base-info', {
            invalid: summary && !summary.isValid,
            warning: summary && (!summary.isValid || !!summary.notHonoredReason),
            'not-honored': summary?.isValid && !!summary.notHonoredReason,
          })}
        >
          <div className="title-img">
            <div className="checkbox-title">
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
              <div onClick={(e) => e.stopPropagation()}>
                {isSelectMode && (
                  <Checkbox
                    label=""
                    className="mr-2"
                    checked={isInSelection}
                    onChange={() => handleSelectTrain(train.id)}
                    small
                  />
                )}
              </div>
              <div title={train.name} className="checkbox-label">
                <div
                  className={cx('train-info', getTrainCategoryClassName(category, 'text'))}
                  style={{ color: currentSubCategory?.color }}
                >
                  {projectionPathIsUsed && (
                    <div className="train-projected">
                      <Manchette iconColor="var(--white100)" />
                    </div>
                  )}
                  <span data-testid="train-name" className="train-name">
                    {train.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="rolling-stock">
              {summary?.isValid && train.rollingStock && (
                <RollingStock2Img rollingStock={train.rollingStock} />
              )}
            </div>
          </div>
          {(!summary || summary.isValid) && (
            <div className="train-time">
              <div className="status-icon after-midnight">{isAfterMidnight && <Moon />}</div>
              <div
                className="scenario-timetable-train-times"
                title={train.startTime.toLocaleString(dateTimeLocale)}
              >
                {timeToLocaleStringRounded(train.startTime, dateTimeLocale)}
              </div>
              <div
                className={cx('status-icon', {
                  'not-honored-or-too-fast': summary?.isValid && summary.notHonoredReason,
                })}
              >
                {summary?.isValid &&
                  summary.notHonoredReason &&
                  (summary.notHonoredReason === 'scheduleNotHonored' ? <Clock /> : <Flame />)}
              </div>
              <div
                data-testid="timetable-item-arrival-time"
                className="scenario-timetable-train-times"
                title={arrivalTime ? arrivalTime.toLocaleString(dateTimeLocale) : undefined}
              >
                {arrivalTime ? (
                  timeToLocaleStringRounded(arrivalTime, dateTimeLocale)
                ) : (
                  <ArrivalTimeLoader />
                )}
              </div>
              <div
                className={cx('status-dot', {
                  'not-honored-or-too-fast':
                    summary?.isValid &&
                    (summary.notHonoredReason === 'scheduleNotHonored' ||
                      summary.notHonoredReason === 'trainTooFast'),
                })}
              />
            </div>
          )}
          {summary && !summary.isValid && (
            <div
              data-testid="invalid-reason"
              className="invalid-reason"
              title={t(`timetable.invalid.${summary.invalidReason}`)}
            >
              <span>{t(`timetable.invalid.${summary.invalidReason}`)}</span>
            </div>
          )}
        </div>

        {summary?.isValid && (
          <div className="more-info">
            <div data-testid="unique-train-more-info" className="more-info-left">
              <span data-testid="unique-train-stop-count" className="more-info-item">
                {t('timetable.stopsCount', { count: train.stopsCount })}
              </span>
              <span data-testid="unique-train-path-length" className="more-info-item">
                {summary.pathLength}
              </span>
              <span
                className="more-info-item m-0"
                data-testid="unique-train-allowance-energy-consumed"
              >
                {summary.mechanicalEnergyConsumed}&nbsp;kWh
              </span>
            </div>
            <div data-testid="unique-train-duration-time" className="duration-time">
              <span data-testid="train-duration">{formatTrainDuration(summary.duration)}</span>
            </div>
          </div>
        )}
      </div>
      <TimetableItemActions
        selectPathProjection={selectPathProjection}
        moveTimetableItem={moveTimetableItem}
        duplicateTimetableItem={duplicateTrain}
        editTimetableItem={() => selectTrainToEdit(train)}
        deleteTimetableItem={deleteTrain}
        showMovebutton={showMovebutton}
      />
    </div>
  );
};

export default React.memo(UniqueTrainItem);
