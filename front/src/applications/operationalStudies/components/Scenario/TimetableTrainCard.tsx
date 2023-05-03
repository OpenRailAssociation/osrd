import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTrash, FaPencilAlt } from 'react-icons/fa';
import { GiPathDistance } from 'react-icons/gi';
import { MdAvTimer, MdContentCopy } from 'react-icons/md';
import { durationInSeconds, sec2time } from 'utils/timeManipulation';
import nextId from 'react-id-generator';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import cx from 'classnames';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import { ScheduledTrain } from 'reducers/osrdsimulation/types';
import RollingStock2Img from 'common/RollingStockSelector/RollingStock2Img';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import { useDispatch } from 'react-redux';
import { jouleToKwh } from 'utils/physics';

type Props = {
  train: ScheduledTrain;
  intervalPosition?: number;
  isSelected: boolean;
  isModified?: boolean;
  projectionPathIsUsed: boolean;
  idx: number;
  changeSelectedTrain: (idx: number) => void;
  deleteTrain: (train: ScheduledTrain) => void;
  selectPathProjection: (train: ScheduledTrain) => void;
  duplicateTrain: (train: ScheduledTrain) => void;
  setDisplayTrainScheduleManagement: (arg0: string) => void;
};

function TimetableTrainCard({
  train,
  intervalPosition,
  isSelected,
  isModified,
  projectionPathIsUsed,
  idx,
  changeSelectedTrain,
  deleteTrain,
  selectPathProjection,
  duplicateTrain,
  setDisplayTrainScheduleManagement,
}: Props) {
  const [getTrainSchedule] = osrdMiddlewareApi.endpoints.getTrainScheduleById.useLazyQuery({});
  const [getRollingStock, { data: rollingStock }] =
    osrdEditoastApi.endpoints.getLightRollingStockById.useLazyQuery({});
  const { t } = useTranslation(['operationalStudies/scenario']);
  const dispatch = useDispatch();

  const editTrainSchedule = () => {
    dispatch(updateTrainScheduleIDsToModify([train.id]));
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.edit);
  };

  useEffect(() => {
    if (train.id) {
      getTrainSchedule({ id: train.id })
        .unwrap()
        .then((trainSchedule) => {
          if (trainSchedule.rolling_stock) getRollingStock({ id: trainSchedule.rolling_stock });
        });
    }
  }, [train.id]);

  return (
    <div className="scenario-timetable-train-with-right-bar">
      <div
        className={cx(
          'scenario-timetable-train with-colored-border',
          isSelected && 'selected',
          isModified && 'modified',
          `colored-border-${intervalPosition}`
        )}
      >
        <div
          className="scenario-timetable-train-container"
          role="button"
          tabIndex={0}
          onClick={() => changeSelectedTrain(idx)}
        >
          <div className="scenario-timetable-train-header">
            <div className="scenario-timetable-train-name">
              <div
                className={cx('scenario-timetable-train-idx', projectionPathIsUsed && 'projected')}
              >
                {idx + 1}
              </div>
              {train.name}
              {rollingStock && (
                <span className="img-container">
                  <RollingStock2Img rollingStock={rollingStock} />
                </span>
              )}
            </div>
            <div className="scenario-timetable-train-times">
              <div className="scenario-timetable-train-departure">{sec2time(train.departure)}</div>
              <div className="scenario-timetable-train-arrival">{sec2time(train.arrival)}</div>
            </div>
          </div>
          <div className="scenario-timetable-train-body">
            <span className="flex-grow-1">{train.speed_limit_tags}</span>

            {train.mechanicalEnergyConsumed?.eco && (
              <small className="mx-xl-2 mr-lg-1 text-orange font-weight-bold">
                ECO {jouleToKwh(train.mechanicalEnergyConsumed.eco, true)}&nbsp;kWh
              </small>
            )}
            {train.mechanicalEnergyConsumed?.base && (
              <span className="mr-xl-3 mr-lg-2">
                {jouleToKwh(train.mechanicalEnergyConsumed.base, true)}
                <span className="small ml-1">kWh</span>
              </span>
            )}
            <div className="text-nowrap">
              <MdAvTimer />
              <span className="ml-1">
                {sec2time(durationInSeconds(train.departure, train.arrival))}
              </span>
            </div>
          </div>
          <div className="scenario-timetable-train-tags">
            {train.labels.map((tag) => (
              <div className="scenario-timetable-train-tags-tag" key={nextId()}>
                {tag}
              </div>
            ))}
          </div>
        </div>

        <div className="scenario-timetable-train-buttons">
          <button
            className="scenario-timetable-train-buttons-selectprojection"
            type="button"
            title={t('timetable.choosePath')}
            onClick={() => selectPathProjection(train)}
          >
            <GiPathDistance />
          </button>
          <button
            className="scenario-timetable-train-buttons-duplicate"
            type="button"
            title={t('timetable.duplicate')}
            onClick={() => duplicateTrain(train)}
          >
            <MdContentCopy />
          </button>
          <button
            className="scenario-timetable-train-buttons-update"
            type="button"
            title={t('timetable.update')}
            onClick={editTrainSchedule}
          >
            <FaPencilAlt />
          </button>
          <button
            className="scenario-timetable-train-buttons-delete"
            type="button"
            onClick={() => deleteTrain(train)}
            title={t('timetable.delete')}
          >
            <FaTrash />
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TimetableTrainCard);
