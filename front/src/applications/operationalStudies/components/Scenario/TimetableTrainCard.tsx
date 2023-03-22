import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaTrash, FaPencilAlt } from 'react-icons/fa';
import { GiPathDistance } from 'react-icons/gi';
import { MdContentCopy } from 'react-icons/md';
import { sec2time } from 'utils/timeManipulation';
import nextId from 'react-id-generator';

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
}: Props) {
  const { t } = useTranslation(['operationalStudies/scenario']);

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
            <div className="scenario-timetable-train-idx">{idx + 1}</div>
            {projectionPathIsUsed && (
              <span className="mr-1">
                <GiPathDistance />
              </span>
            )}
            {train.name}
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
          className="scenario-timetable-train-buttons-update d-none"
          type="button"
          title={t('timetable.update')}
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
