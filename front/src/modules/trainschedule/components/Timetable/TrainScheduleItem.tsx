import React from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { Clock, Flame, Moon, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  TimetableItemId,
  TrainId,
  TrainScheduleId,
  TrainScheduleWithTrainId,
} from 'reducers/osrdconf/types';
import { updateTrainIdUsedForProjection, updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { addDurationToDate, Duration } from 'utils/duration';
import { castErrorToFailure } from 'utils/error';
import {
  formatEditoastIdToTrainScheduleId,
  extractEditoastIdFromTrainScheduleId,
} from 'utils/trainId';

import ArrivalTimeLoader from './ArrivalTimeLoader';
import { TIMETABLE_ITEM_DELTA, TRAIN_CATEGORY_CLASS } from './consts';
import TimetableItemActions from './TimetableItemActions';
import type { TrainScheduleWithDetails } from './types';
import { formatFullDate, formatTrainDuration, roundAndFormatToNearestMinute } from './utils';

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
}: TrainScheduleItemProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dispatch = useAppDispatch();

  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.useMutation();
  const [getTrainSchedule] = osrdEditoastApi.endpoints.getTrainScheduleById.useLazyQuery();
  const [deleteTrainSchedule] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();

  const changeSelectedTrainId = (trainId: TrainId) => {
    dispatch(updateSelectedTrainId(trainId));
  };

  const deleteTrain = async () => {
    if (isSelected) {
      // we need to set selectedTrainId to undefined, otherwise just after the delete,
      // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
      dispatch(updateSelectedTrainId(undefined));
    }

    deleteTrainSchedule({
      body: { ids: [extractEditoastIdFromTrainScheduleId(train.id)] },
    })
      .unwrap()
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
  };

  const isAfterMidnight = dayjs(train.arrivalTime).isAfter(train.startTime, 'day');

  return (
    <div
      data-testid="scenario-timetable-train"
      className={cx('scenario-timetable-train', {
        selected: isSelected,
        modified: isModified,
        'in-selection': isInSelection,
        invalid: train.invalidReason,
      })}
    >
      <div
        data-testid="scenario-timetable-train-button"
        role="button"
        tabIndex={0}
        onClick={() => changeSelectedTrainId(train.id)}
        className="w-full clickable-button"
      >
        <div
          className={cx('base-info', {
            warning: train.invalidReason || train.notHonoredReason,
            invalid: train.invalidReason,
            'not-honored': train.notHonoredReason,
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
                  className={cx(
                    'train-info',
                    `train-category-text-${TRAIN_CATEGORY_CLASS[train.category ?? 'None']}`
                  )}
                >
                  {projectionPathIsUsed && (
                    <div className="train-projected">
                      <Manchette iconColor="var(--white)" />
                    </div>
                  )}
                  <span className="train-name">{train.name}</span>
                </div>
              </div>
            </div>
            <div className="rolling-stock">
              {train.rollingStock && !train.invalidReason && (
                <RollingStock2Img rollingStock={train.rollingStock} />
              )}
            </div>
          </div>
          {!train.invalidReason ? (
            <div className="train-time">
              <div className="status-icon after-midnight">{isAfterMidnight && <Moon />}</div>
              <div
                className="scenario-timetable-train-times"
                title={formatFullDate(train.startTime)}
              >
                {roundAndFormatToNearestMinute(train.startTime)}
              </div>
              <div
                className={cx('status-icon', {
                  'not-honored-or-too-fast': train.notHonoredReason,
                })}
              >
                {train.notHonoredReason &&
                  (train.notHonoredReason === 'scheduleNotHonored' ? <Clock /> : <Flame />)}
              </div>
              <div
                data-testid="train-arrival-time"
                className="scenario-timetable-train-times"
                title={train.arrivalTime ? formatFullDate(train.arrivalTime) : undefined}
              >
                {train.arrivalTime ? (
                  roundAndFormatToNearestMinute(train.arrivalTime)
                ) : (
                  <ArrivalTimeLoader />
                )}
              </div>
              <div
                className={cx('status-dot', {
                  'not-honored-or-too-fast':
                    train.notHonoredReason === 'scheduleNotHonored' ||
                    train.notHonoredReason === 'trainTooFast',
                })}
              />
            </div>
          ) : (
            <div className="invalid-reason" title={t(`timetable.invalid.${train.invalidReason}`)}>
              <span>{t(`timetable.invalid.${train.invalidReason}`)}</span>
            </div>
          )}
        </div>

        {train.isValid && (
          <div className="more-info">
            <div className="more-info-left">
              {/* TODO : add a category span in https://github.com/OpenRailAssociation/osrd/issues/11542 */}
              <span className="more-info-item">
                {t('timetable.stopsCount', { count: train.stopsCount })}
              </span>
              <span className="more-info-item">{train.pathLength}</span>
              <span className="more-info-item m-0" data-testid="allowance-energy-consumed">
                {train.mechanicalEnergyConsumed}&nbsp;kWh
              </span>
            </div>
            <div className="duration-time">
              <span data-testid="train-duration">{formatTrainDuration(train.duration!)}</span>
            </div>
          </div>
        )}
      </div>
      <TimetableItemActions
        selectPathProjection={selectPathProjection}
        duplicateTimetableItem={duplicateTrain}
        editTimetableItem={() => selectTrainToEdit(train)}
        deleteTimetableItem={deleteTrain}
        isTimetableItemValid={!train.invalidReason}
      />
    </div>
  );
};

export default React.memo(TrainScheduleItem);
