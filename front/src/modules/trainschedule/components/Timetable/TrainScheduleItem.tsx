import React from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { Clock, Flame, Moon, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import trainNameWithNum from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainNameHelper';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  TimetableItemId,
  TrainId,
  TrainScheduleId,
  TrainScheduleResultWithTrainId,
} from 'reducers/osrdconf/types';
import { updateTrainIdUsedForProjection, updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { formatToIsoDate, isoDateToMs } from 'utils/date';
import { castErrorToFailure } from 'utils/error';
import {
  formatEditoastTrainIdToTrainScheduleId,
  formatTrainScheduleIdToEditoastTrainId,
} from 'utils/trainId';

import TimetableItemActions from './TimetableItemActions';
import type { TrainScheduleWithDetails } from './types';

type TrainScheduleItemProps = {
  isInSelection: boolean;
  train: TrainScheduleWithDetails;
  isSelected: boolean;
  isModified?: boolean;
  handleSelectTrain: (trainId: TrainScheduleId) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResultWithTrainId[]) => void;
  removeTrains: (trainIds: TimetableItemId[]) => void;
  projectionPathIsUsed: boolean;
  dtoImport: () => void;
  selectTrainToEdit: (train: TrainScheduleWithDetails) => void;
};

const formatFullDate = (d: Date) => dayjs(d).format('D/MM/YYYY HH:mm:ss');
const formatDateHours = (d: Date) => dayjs(d).format('HH:mm');

const TrainScheduleItem = ({
  isInSelection,
  train,
  isSelected,
  isModified,
  handleSelectTrain,
  upsertTrainSchedules,
  removeTrains,
  projectionPathIsUsed,
  dtoImport,
  selectTrainToEdit,
}: TrainScheduleItemProps) => {
  const { t } = useTranslation(['operationalStudies/scenario']);
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

    // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
    deleteTrainSchedule({
      body: { ids: [formatTrainScheduleIdToEditoastTrainId(train.id)] },
    })
      .unwrap()
      .then(() => {
        removeTrains([train.id]);
        dtoImport();
        dispatch(
          setSuccess({
            title: t('timetable.trainDeleted', { name: train.trainName }),
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
    const trainName = `${train.trainName} (${t('timetable.copy')})`;
    const trainDelta = 5;
    const trainCount = 1;
    const actualTrainCount = 1;

    // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
    const editoastTrainId = formatTrainScheduleIdToEditoastTrainId(train.id);
    const trainDetail = await getTrainSchedule({
      id: editoastTrainId,
    })
      .unwrap()
      .catch((e) => {
        dispatch(setFailure(castErrorToFailure(e)));
      });

    if (trainDetail) {
      const formattedStartTimeMs = isoDateToMs(trainDetail.start_time);
      const newStartTimeString = formatToIsoDate(formattedStartTimeMs + 1000 * 60 * trainDelta);
      const newTrain: TrainScheduleBase = {
        ...omit(trainDetail, ['id', 'timetable_id']),
        start_time: newStartTimeString,
        train_name: trainNameWithNum(trainName, actualTrainCount, trainCount),
      };

      try {
        const [trainScheduleResult] = await postTrainSchedule({
          id: trainDetail.timetable_id,
          body: [newTrain],
        }).unwrap();
        const formattedTrainScheduleResult: TrainScheduleResultWithTrainId = {
          ...trainScheduleResult,
          id: formatEditoastTrainIdToTrainScheduleId(trainScheduleResult.id),
        };
        upsertTrainSchedules([formattedTrainScheduleResult]);
        dtoImport();
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
    // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
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
        <div className="base-info">
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
              <div title={train.trainName} className="checkbox-label">
                <div className="train-info">
                  {projectionPathIsUsed && (
                    <div className="train-projected">
                      <Manchette iconColor="var(--white100)" />
                    </div>
                  )}
                  <span className="train-name">{train.trainName}</span>
                </div>
              </div>
            </div>
            <div className="rolling-stock">
              {train.rollingStock && !train.invalidReason && (
                <RollingStock2Img rollingStock={train.rollingStock} />
              )}
              {train.invalidReason && (
                <div className="flex items-center">
                  <span>{t(`timetable.invalid.${train.invalidReason}`)}</span>
                  <div className="status-invalid" />
                </div>
              )}
            </div>
          </div>
          {!train.invalidReason && (
            <div className="train-time">
              <div className="status-icon after-midnight">{isAfterMidnight && <Moon />}</div>
              {train.isValid && (
                <div
                  className="scenario-timetable-train-times"
                  title={formatFullDate(train.startTime)}
                >
                  {formatDateHours(train.startTime)}
                </div>
              )}
              <div
                className={cx('status-icon', {
                  'not-honored-or-too-fast': train.notHonoredReason,
                })}
              >
                {train.notHonoredReason &&
                  (train.notHonoredReason === 'scheduleNotHonored' ? <Clock /> : <Flame />)}
              </div>
              {train.arrivalTime && (
                <div
                  data-testid="train-arrival-time"
                  className="scenario-timetable-train-times"
                  title={formatFullDate(train.arrivalTime)}
                >
                  {formatDateHours(train.arrivalTime)}
                </div>
              )}
              <div
                className={cx('status-dot', {
                  'not-honored-or-too-fast':
                    train.notHonoredReason === 'scheduleNotHonored' ||
                    train.notHonoredReason === 'trainTooFast',
                })}
              />
            </div>
          )}
        </div>

        {train.isValid && (
          <div className="more-info">
            <div className="more-info-left">
              <span className="more-info-item">
                {t('timetable.stopsCount', { count: train.stopsCount })}
              </span>
              <span className="more-info-item">{train.pathLength}</span>
              <span className="more-info-item m-0" data-testid="allowance-energy-consumed">
                {train.mechanicalEnergyConsumed}&nbsp;kWh
              </span>
            </div>
            <div className="duration-time">
              <span data-testid="train-duration">
                {dayjs.duration(train.duration!.ms).format('HH[h]mm')}
              </span>
            </div>
          </div>
        )}
      </div>
      <TimetableItemActions
        selectPathProjection={selectPathProjection}
        duplicateTimetableItem={duplicateTrain}
        editTimetableItem={() => selectTrainToEdit(train)}
        deleteTimetableItem={deleteTrain}
      />
    </div>
  );
};

export default React.memo(TrainScheduleItem);
