import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTrash, FaPencilAlt } from 'react-icons/fa';
import { GiPathDistance } from 'react-icons/gi';
import { MdContentCopy } from 'react-icons/md';
import { sec2time } from 'utils/timeManipulation';
import nextId from 'react-id-generator';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import cx from 'classnames';

import { ScheduledTrain } from 'reducers/osrdsimulation/types';

type Props = {
  train: ScheduledTrain;
  isSelected: boolean;
  projectionPathIsUsed: boolean;
  idx: number;
  changeSelectedTrain: (idx: number) => void;
  deleteTrain: (train: ScheduledTrain) => void;
  selectPathProjection: (train: ScheduledTrain) => void;
  duplicateTrain: (train: ScheduledTrain) => void;
  setDisplayTrainScheduleManagement: (arg0: string) => void;
  setTrainScheduleIDToModify: (arg0: number | undefined) => void;
};

export default function TimetableTrainCard({
  train,
  isSelected,
  projectionPathIsUsed,
  idx,
  changeSelectedTrain,
  deleteTrain,
  selectPathProjection,
  duplicateTrain,
  setDisplayTrainScheduleManagement,
  setTrainScheduleIDToModify,
}: Props) {
  const [getTrainSchedule] = osrdMiddlewareApi.endpoints.getTrainScheduleById.useLazyQuery({});
  const [getRollingStock, { data: rollingStock }] =
    osrdMiddlewareApi.endpoints.getLightRollingStockById.useLazyQuery({});
  const [getRollingStockLivery, { data: rollingStockLivery }] =
    osrdMiddlewareApi.endpoints.getRollingStockByIdLivery.useLazyQuery({});
  const { t } = useTranslation(['operationalStudies/scenario']);

  const editTrainSchedule = () => {
    setTrainScheduleIDToModify(train.id);
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.edit);
  };

  useEffect(() => {
    if (train.id) {
      getTrainSchedule({ id: train.id })
        .unwrap()
        .then((trainSchedule) => {
          if (trainSchedule.rolling_stock)
            getRollingStock({ id: trainSchedule.rolling_stock })
              .unwrap()
              .then((rollingStockData) => {
                if (
                  rollingStockData.id &&
                  rollingStockData.liveries &&
                  rollingStockData.liveries[0].id
                ) {
                  getRollingStockLivery({
                    id: rollingStockData.id,
                    liveryId: rollingStockData.liveries[0].id,
                  });
                }
              });
        });
    }
  }, [train.id]);

  return (
    <div className={`scenario-timetable-train ${isSelected ? 'selected' : ''}`}>
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
            {projectionPathIsUsed && (
              <span className="mx-1">
                <GiPathDistance />
              </span>
            )}
            {rollingStockLivery && (
              <img src={URL.createObjectURL(rollingStockLivery)} alt="rollingstock livery" />
            )}
          </div>
          <div className="scenario-timetable-train-departure">{sec2time(train.departure)}</div>
          <div className="scenario-timetable-train-arrival">{sec2time(train.arrival)}</div>
        </div>
        <div className="scenario-timetable-train-body">
          <div className="scenario-timetable-train-duration">{train.speed_limit_tags}</div>
          <div className="scenario-timetable-train-duration">
            {sec2time(train.arrival - train.departure)}
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
  );
}
