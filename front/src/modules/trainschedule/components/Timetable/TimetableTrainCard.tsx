import React from 'react';

import { Checkbox } from '@osrd-project/ui-core';
import { Duplicate, Pencil, Trash, Clock, Flame, Moon, Manchette } from '@osrd-project/ui-icons';
import cx from 'classnames';
import dayjs from 'dayjs';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';
import { GiPathDistance } from 'react-icons/gi';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TrainScheduleBase, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import trainNameWithNum from 'modules/trainschedule/components/ManageTrainSchedule/helpers/trainNameHelper';
import { setFailure, setSuccess } from 'reducers/main';
import type { OperationalStudiesConfSliceActions } from 'reducers/osrdconf/operationalStudiesConf';
import { updateTrainIdUsedForProjection, updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { formatToIsoDate, isoDateToMs } from 'utils/date';
import { castErrorToFailure } from 'utils/error';

import type { TrainScheduleWithDetails } from './types';

type TimetableTrainCardProps = {
  isInSelection: boolean;
  train: TrainScheduleWithDetails;
  isSelected: boolean;
  isModified?: boolean;
  handleSelectTrain: (trainId: number) => void;
  setDisplayTrainScheduleManagement: (arg0: string) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
  setTrainIdToEdit: (trainIdToEdit?: number) => void;
  removeTrains: (trainIds: number[]) => void;
  projectionPathIsUsed: boolean;
  dtoImport: () => void;
};

const formatFullDate = (d: Date) => dayjs(d).format('D/MM/YYYY HH:mm:ss');
const formatDateHours = (d: Date) => dayjs(d).format('HH:mm');

const TimetableTrainCard = ({
  isInSelection,
  train,
  isSelected,
  isModified,
  setDisplayTrainScheduleManagement,
  handleSelectTrain,
  upsertTrainSchedules,
  setTrainIdToEdit,
  removeTrains,
  projectionPathIsUsed,
  dtoImport,
}: TimetableTrainCardProps) => {
  const { t } = useTranslation(['operationalStudies/scenario']);
  const dispatch = useAppDispatch();
  const { selectTrainToEdit } = useOsrdConfActions() as OperationalStudiesConfSliceActions;

  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedule.useMutation();
  const [getTrainSchedule] = osrdEditoastApi.endpoints.postTrainSchedule.useLazyQuery();
  const [deleteTrainSchedule] = osrdEditoastApi.endpoints.deleteTrainSchedule.useMutation();

  const changeSelectedTrainId = (trainId: number) => {
    dispatch(updateSelectedTrainId(trainId));
  };

  const editTrainSchedule = () => {
    dispatch(selectTrainToEdit(train));
    setTrainIdToEdit(train.id);
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.edit);
  };

  const deleteTrain = async () => {
    if (isSelected) {
      // we need to set selectedTrainId to undefined, otherwise just after the delete,
      // some unvalid rtk calls are dispatched (see rollingstock request in SimulationResults)
      dispatch(updateSelectedTrainId(undefined));
    }

    deleteTrainSchedule({ body: { ids: [train.id] } })
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

    const trainsResults = await getTrainSchedule({ body: { ids: [train.id] } })
      .unwrap()
      .catch((e) => {
        dispatch(setFailure(castErrorToFailure(e)));
      });

    if (trainsResults) {
      const trainDetail = trainsResults[0];
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
        upsertTrainSchedules([trainScheduleResult]);
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
                <div className="rolling-stock-img">
                  <RollingStock2Img rollingStock={train.rollingStock} />
                </div>
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
                  className="scenario-timetable-train-departure"
                  title={formatFullDate(train.startTime)}
                >
                  {formatDateHours(train.startTime)}
                </div>
              )}
              <div className="status-icon not-honored-or-too-fast">
                {train.notHonoredReason &&
                  (train.notHonoredReason === 'scheduleNotHonored' ? <Clock /> : <Flame />)}
              </div>
              {train.arrivalTime && (
                <div
                  data-testid="train-arrival-time"
                  className="scenario-timetable-train-arrival"
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
                {dayjs.duration(train.duration).format('HH[h]mm')}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="action-buttons">
        <button
          type="button"
          aria-label={t('timetable.choosePath')}
          title={t('timetable.choosePath')}
          onClick={selectPathProjection}
        >
          <GiPathDistance />
        </button>
        <button
          type="button"
          aria-label={t('timetable.duplicate')}
          title={t('timetable.duplicate')}
          onClick={duplicateTrain}
        >
          <Duplicate />
        </button>
        <button
          type="button"
          aria-label={t('timetable.update')}
          title={t('timetable.update')}
          onClick={editTrainSchedule}
          data-testid="edit-train"
        >
          <Pencil />
        </button>
        <button
          type="button"
          aria-label={t('timetable.delete')}
          title={t('timetable.delete')}
          onClick={deleteTrain}
        >
          <Trash />
        </button>
      </div>
    </div>
  );
};

export default React.memo(TimetableTrainCard);
