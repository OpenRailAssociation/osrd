import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTrash, FaPencilAlt } from 'react-icons/fa';
import { GiPathDistance } from 'react-icons/gi';
import { MdAvTimer, MdContentCopy } from 'react-icons/md';
import invalidInfra from 'assets/pictures/components/missing_tracks.svg';
import invalidRollingStock from 'assets/pictures/components/missing_train.svg';
import { durationInSeconds, sec2time } from 'utils/timeManipulation';
import nextId from 'react-id-generator';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import cx from 'classnames';
import { InvalidTrainValues, osrdEditoastApi } from 'common/api/osrdEditoastApi';

import { ScheduledTrain } from 'reducers/osrdsimulation/types';
import { RollingStock2Img } from 'modules/rollingStock/components/RollingStockSelector';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import { useDispatch } from 'react-redux';
import { jouleToKwh, mToKmOneDecimal } from 'utils/physics';

const invalidTrainValues: {
  [key in InvalidTrainValues]: InvalidTrainValues;
} = {
  NewerInfra: 'NewerInfra',
  NewerRollingStock: 'NewerRollingStock',
};

type Props = {
  isSelectable: boolean;
  isInSelection: boolean;
  train: ScheduledTrain;
  intervalPosition?: number;
  isSelected: boolean;
  isModified?: boolean;
  projectionPathIsUsed: boolean;
  idx: number;
  changeSelectedTrainId: (trainId: number) => void;
  toggleTrainSelection: (trainId: number) => void;
  deleteTrain: (train: ScheduledTrain) => void;
  selectPathProjection: (train: ScheduledTrain) => void;
  duplicateTrain: (train: ScheduledTrain) => void;
  setDisplayTrainScheduleManagement: (arg0: string) => void;
};

function TimetableTrainCard({
  isSelectable,
  isInSelection,
  train,
  intervalPosition,
  isSelected,
  isModified,
  projectionPathIsUsed,
  idx,
  changeSelectedTrainId,
  deleteTrain,
  selectPathProjection,
  duplicateTrain,
  setDisplayTrainScheduleManagement,
  toggleTrainSelection,
}: Props) {
  const [getTrainSchedule] = osrdEditoastApi.endpoints.getTrainScheduleById.useLazyQuery({});
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
          if (trainSchedule.rolling_stock_id)
            getRollingStock({ id: trainSchedule.rolling_stock_id });
        });
    }
  }, [train.rolling_stock_id]);

  return (
    <div className="scenario-timetable-train-with-right-bar">
      <div
        className={cx(
          'scenario-timetable-train with-colored-border',
          isSelected && 'selected',
          isModified && 'modified',
          train.invalid_reasons && train.invalid_reasons.length > 0 && 'invalid',
          isInSelection && 'in-selection',
          `colored-border-${intervalPosition}`
        )}
      >
        {isSelectable && (
          <input
            type="checkbox"
            className="mr-2"
            checked={isInSelection}
            onChange={() => toggleTrainSelection(train.id)}
          />
        )}
        <div
          className="scenario-timetable-train-container"
          role="button"
          tabIndex={0}
          onClick={() => changeSelectedTrainId(train.id)}
        >
          <div className="scenario-timetable-train-header">
            <div className="scenario-timetable-train-name">
              <div
                className={cx('scenario-timetable-train-idx', projectionPathIsUsed && 'projected')}
              >
                {idx + 1}
              </div>
              {train.invalid_reasons && train.invalid_reasons.includes('NewerInfra') && (
                <div
                  className="mr-1 scenario-timetable-train-invalid-icons"
                  title={invalidTrainValues.NewerInfra}
                >
                  <img src={invalidInfra} alt="Invalid infra logo" />
                </div>
              )}
              {train.invalid_reasons && train.invalid_reasons.includes('NewerRollingStock') && (
                <div
                  className="mr-1 scenario-timetable-train-invalid-icons"
                  title={invalidTrainValues.NewerRollingStock}
                >
                  <img src={invalidRollingStock} alt="Invalid rollingstock logo" />
                </div>
              )}
              {train.train_name}
              {rollingStock && (
                <span className="img-container">
                  <RollingStock2Img rollingStock={rollingStock} />
                </span>
              )}
            </div>
            <div className="scenario-timetable-train-times">
              <div className="scenario-timetable-train-departure">
                {sec2time(train.departure_time)}
              </div>
              <div className="scenario-timetable-train-arrival">{sec2time(train.arrival_time)}</div>
            </div>
          </div>
          <div className="scenario-timetable-train-body">
            <span className="flex-grow-1">{train.speed_limit_tags}</span>
            {train.stops_count !== undefined && train.stops_count > 0 && (
              <span className="mr-3">
                {t('timetable.stopsCount', { count: train.stops_count })}
              </span>
            )}
            {train.mechanical_energy_consumed?.eco && (
              <small
                className="mx-xl-2 mr-lg-1 text-orange font-weight-bold"
                data-testid="allowance-energy-consumed"
              >
                ECO {+jouleToKwh(train.mechanical_energy_consumed.eco, true)}&nbsp;kWh
              </small>
            )}
            {train.mechanical_energy_consumed?.base && (
              <span className="mr-xl-3 mr-lg-2" data-testid="average-energy-consumed">
                {jouleToKwh(train.mechanical_energy_consumed.base, true)}
                <span className="small ml-1">kWh</span>
              </span>
            )}
            {train.path_length && (
              <span className="mr-xl-3 mr-lg-2">{mToKmOneDecimal(train.path_length)}km</span>
            )}
            <div className="text-nowrap text-right">
              <MdAvTimer />
              <span className="ml-1" data-testid="train-duration">
                {sec2time(durationInSeconds(train.departure_time, train.arrival_time))}
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
          {train.invalid_reasons && train.invalid_reasons.length === 0 && (
            <>
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
            </>
          )}
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
