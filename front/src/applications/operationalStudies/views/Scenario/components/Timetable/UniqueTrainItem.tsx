import React from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { Clock, Flame, Moon, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';

import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import {
  osrdEditoastApi,
  type SubCategory,
  type TrainSchedule,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import { SkeletonLoader } from 'common/Loaders';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { findSubCategory } from 'modules/rollingStock/helpers/category';
import {
  createTrainSchedules,
  deleteTrainSchedules,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { setFailure, setSuccess } from 'reducers/main';
import type { TrainId } from 'reducers/osrdconf/types';
import {
  updateHoveredTrainId,
  updateTrainIdUsedForProjection,
  updateSelectedTrain,
  updateProjectionType,
} from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { timeToLocaleStringRounded, useDateTimeLocale } from 'utils/date';
import { addDurationToDate, Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import { TRAIN_SCHEDULE_DELTA } from './consts';
import TrainScheduleActions from './TrainScheduleActions';
import { formatTrainDuration, getTrainCategoryClassName } from './utils';

type UniqueTrainItemProps = {
  isInSelection: boolean;
  train: TrainScheduleWithDetails;
  isSelected: boolean;
  isModified?: boolean;
  handleSelectTrain: (trainId: number) => void;
  projectionPathIsUsed: boolean;
  selectTrainToEdit: (train: TrainScheduleWithDetails) => void;
  setSelectedTrainScheduleIds: React.Dispatch<React.SetStateAction<number[]>>;
  subCategories: SubCategory[];
  isSelectMode: boolean;
  moveTrainSchedule: () => void;
  showMovebutton: boolean;
};

const UniqueTrainItem = ({
  isInSelection,
  train,
  isSelected,
  isModified,
  handleSelectTrain,
  projectionPathIsUsed,
  selectTrainToEdit,
  setSelectedTrainScheduleIds,
  subCategories,
  isSelectMode,
  moveTrainSchedule,
  showMovebutton,
}: UniqueTrainItemProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dateTimeLocale = useDateTimeLocale();
  const dispatch = useAppDispatch();

  const { removeTrainSchedules, upsertTrainSchedules } = useTimetableContext();

  const [getTrainSchedule] = osrdEditoastApi.endpoints.getTrainSchedulesById.useLazyQuery();

  const { summary } = train;

  const formattedTrainId = formatEditoastIdToTrainScheduleId(train.id);

  const toggleUniqueTrainSelection = (trainId: TrainId) => {
    dispatch(updateSelectedTrain(isSelected ? undefined : { id: trainId, by: 'timetable' }));
  };

  const deleteTrain = async () => {
    deleteTrainSchedules(dispatch, [train.id])
      .then(() => {
        removeTrainSchedules([train.id]);
        setSelectedTrainScheduleIds((prev) => prev.filter((id) => id !== train.id));
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
          dispatch(updateSelectedTrain({ id: formattedTrainId, by: 'timetable' }));
        }
      });
  };

  const duplicateTrain = async () => {
    const trainName = `${train.name} (${t('timetable.copy')})`;

    try {
      const trainDetail = await getTrainSchedule({
        id: train.id,
      }).unwrap();

      const startTime = addDurationToDate(
        new Date(trainDetail.start_time),
        new Duration({ minutes: TRAIN_SCHEDULE_DELTA })
      );

      const newUniqueTrainPayload: TrainSchedule = {
        ...omit(trainDetail, ['id', 'train_schedule_set_id']),
        start_time: startTime.getTime(),
        train_name: trainName,
      };

      const newUniqueTrain: TrainScheduleResponse = (
        await createTrainSchedules(dispatch, trainDetail.train_schedule_set_id, [
          newUniqueTrainPayload,
        ])
      )[0];
      dispatch(
        updateSelectedTrain({
          id: formatEditoastIdToTrainScheduleId(newUniqueTrain.id),
          by: 'timetable',
        })
      );
      upsertTrainSchedules([newUniqueTrain]);
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
    dispatch(updateTrainIdUsedForProjection(formattedTrainId));
    if (!summary?.isValid) dispatch(updateProjectionType('operationalPointProjection'));
  };

  // An hourly timetable cannot contain unique trains (see formatTrainScheduleWithDetails).
  if (train.startTime instanceof Duration) {
    throw new Error('A unique train cannot have a Duration start time');
  }
  const trainStartTime = train.startTime;

  const arrivalTime = summary?.isValid
    ? addDurationToDate(trainStartTime, summary.duration)
    : undefined;
  const isAfterMidnight = arrivalTime
    ? dayjs(arrivalTime).isAfter(trainStartTime, 'day')
    : undefined;

  const { category } = train;

  const currentSubCategory = findSubCategory(subCategories, category);

  return (
    <div
      data-testid="scenario-train-schedule"
      data-train-id={train.id}
      className={cx('scenario-timetable-train', {
        selected: isSelected,
        modified: isModified,
        'in-selection': isInSelection,
        invalid: summary && !summary.isValid,
      })}
      onMouseEnter={() => dispatch(updateHoveredTrainId(formattedTrainId))}
      onMouseLeave={() => dispatch(updateHoveredTrainId(undefined))}
    >
      <div
        data-testid="scenario-timetable-unique-train-button"
        role="button"
        tabIndex={0}
        onClick={() => toggleUniqueTrainSelection(formattedTrainId)}
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
              <div
                title={train.name}
                className={cx('checkbox-label', { 'with-checkbox': isSelectMode })}
              >
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
                title={trainStartTime.toLocaleString(dateTimeLocale)}
              >
                {timeToLocaleStringRounded(trainStartTime, dateTimeLocale)}
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
                data-testid="train-schedule-arrival-time"
                className="scenario-timetable-train-times"
                title={arrivalTime ? arrivalTime.toLocaleString(dateTimeLocale) : undefined}
              >
                {arrivalTime ? (
                  timeToLocaleStringRounded(arrivalTime, dateTimeLocale)
                ) : (
                  <SkeletonLoader
                    className="arrival-time-loader"
                    data-testid="arrival-time-loader"
                  />
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
      <TrainScheduleActions
        selectPathProjection={selectPathProjection}
        moveTrainSchedule={moveTrainSchedule}
        duplicateTrainSchedule={duplicateTrain}
        editTrainSchedule={() => selectTrainToEdit(train)}
        deleteTrainSchedule={deleteTrain}
        showMovebutton={showMovebutton}
      />
    </div>
  );
};

export default React.memo(UniqueTrainItem);
