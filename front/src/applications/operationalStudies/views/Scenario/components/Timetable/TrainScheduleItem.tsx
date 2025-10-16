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
import { deleteTrainSchedules } from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import type { TrainScheduleWithDetails } from 'modules/timetableItem/types';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  TimetableItemId,
  TrainId,
  TrainScheduleId,
  TrainScheduleWithTrainId,
} from 'reducers/osrdconf/types';
import {
  updateTrainIdUsedForProjection,
  updateSelectedTrainId,
  updateProjectionType,
} from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
import { addDurationToDate, Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import {
  formatEditoastIdToTrainScheduleId,
  extractEditoastIdFromTrainScheduleId,
} from 'utils/trainId';

import ArrivalTimeLoader from './ArrivalTimeLoader';
import { TIMETABLE_ITEM_DELTA } from './consts';
import TimetableItemActions from './TimetableItemActions';
import {
  formatTrainDuration,
  getTrainCategoryClassName,
  isValidPathfinding,
  roundAndFormatToNearestMinute,
} from './utils';

type TrainScheduleItemProps = {
  isInSelection: boolean;
  train: TrainScheduleWithDetails;
  isSelected: boolean;
  isModified?: boolean;
  handleSelectTrain: (trainId: TrainScheduleId) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleWithTrainId[]) => void;
  removeTrains: (trainIds: TimetableItemId[]) => void;
  projectionPathIsUsed: boolean;
  selectTrainToEdit: (train: TrainScheduleWithDetails) => void;
  subCategories: SubCategory[];
};

const TrainScheduleItem = ({
  isInSelection,
  train,
  isSelected,
  isModified,
  handleSelectTrain,
  upsertTrainSchedules,
  removeTrains,
  projectionPathIsUsed,
  selectTrainToEdit,
  subCategories,
}: TrainScheduleItemProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dateTimeLocale = useDateTimeLocale();
  const dispatch = useAppDispatch();

  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.useMutation();
  const [getTrainSchedule] = osrdEditoastApi.endpoints.getTrainScheduleById.useLazyQuery();

  const { summary } = train;

  const changeSelectedTrainId = (trainId: TrainId) => {
    dispatch(updateSelectedTrainId(trainId));
  };

  const deleteTrain = async () => {
    deleteTrainSchedules(dispatch, [train.id])
      .then(() => {
        removeTrains([train.id]);
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
    // Static for now, will be dynamic when UI will be ready
    const trainName = `${train.name} (${t('timetable.copy')})`;

    const editoastTrainId = extractEditoastIdFromTrainScheduleId(train.id);
    const trainDetail = await getTrainSchedule({
      id: editoastTrainId,
    })
      .unwrap()
      .catch((e) => {
        dispatch(setFailure(castErrorToFailure(e)));
      });

    if (trainDetail) {
      const startTime = addDurationToDate(
        new Date(trainDetail.start_time),
        new Duration({ minutes: TIMETABLE_ITEM_DELTA })
      );

      const newTrain: TrainSchedule = {
        ...omit(trainDetail, ['id', 'timetable_id']),
        start_time: startTime.toISOString(),
        train_name: trainName,
      };

      try {
        const [trainScheduleResponse] = await postTrainSchedule({
          id: trainDetail.timetable_id,
          body: [newTrain],
        }).unwrap();
        const formattedTrainScheduleResponse: TrainScheduleWithTrainId = {
          ...trainScheduleResponse,
          id: formatEditoastIdToTrainScheduleId(trainScheduleResponse.id),
        };
        upsertTrainSchedules([formattedTrainScheduleResponse]);
        dispatch(
          setSuccess({
            title: t('timetable.trainAdded'),
            text: `${trainName}`,
          })
        );
      } catch (e) {
        dispatch(setFailure(castErrorToFailure(e)));
      }
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
    >
      <div
        data-testid="scenario-timetable-train-schedule-button"
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
                <Checkbox
                  label=""
                  className="mr-2"
                  checked={isInSelection}
                  onChange={() => handleSelectTrain(train.id)}
                  small
                />
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
                  <span className="train-name">{train.name}</span>
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
                {roundAndFormatToNearestMinute(train.startTime)}
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
                {arrivalTime ? roundAndFormatToNearestMinute(arrivalTime) : <ArrivalTimeLoader />}
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
            <div className="more-info-left">
              <span className="more-info-item">
                {t('timetable.stopsCount', { count: train.stopsCount })}
              </span>
              <span className="more-info-item">{summary.pathLength}</span>
              <span className="more-info-item m-0" data-testid="allowance-energy-consumed">
                {summary.mechanicalEnergyConsumed}&nbsp;kWh
              </span>
            </div>
            <div className="duration-time">
              <span data-testid="train-duration">{formatTrainDuration(summary.duration)}</span>
            </div>
          </div>
        )}
      </div>
      <TimetableItemActions
        selectPathProjection={selectPathProjection}
        duplicateTimetableItem={duplicateTrain}
        editTimetableItem={() => selectTrainToEdit(train)}
        deleteTimetableItem={deleteTrain}
        canBeUsedForProjection={isValidPathfinding(summary)}
      />
    </div>
  );
};

export default React.memo(TrainScheduleItem);
