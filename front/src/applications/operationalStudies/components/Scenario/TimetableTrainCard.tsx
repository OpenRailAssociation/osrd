import React from 'react';
import { FaTrash, FaPencilAlt } from 'react-icons/fa';
import { sec2time } from 'utils/timeManipulation';

type Props = {
  train: {
    id: number;
    name: string;
    departure: number;
    arrival: number;
    labels: Array<1>;
    speed_limit_composition: string;
  };
  selectedTrain: number;
  selectedProjection: number;
  idx: number;
};

export default function TimetableTrainCard({
  train,
  selectedTrain,
  selectedProjection,
  idx,
}: Props) {
  if (!selectedProjection) console.log('');

  return (
    <div className={`scenario-timetable-train ${selectedTrain === idx ? 'selected' : ''}`}>
      <div className="scenario-timetable-train-container">
        <div className="scenario-timetable-train-header">
          <div className="scenario-timetable-train-name">
            <div className="scenario-timetable-train-idx">{idx + 1}</div>
            {train.name}
          </div>
          <div className="scenario-timetable-train-departure">{sec2time(train.departure)}</div>
          <div className="scenario-timetable-train-arrival">{sec2time(train.arrival)}</div>
        </div>
        <div className="scenario-timetable-train-body">
          <div className="scenario-timetable-train-duration">{train.speed_limit_composition}</div>
          <div className="scenario-timetable-train-duration">
            {sec2time(train.arrival - train.departure)}
          </div>
        </div>
        <div className="scenario-timetable-train-tags">
          {train.labels.map((tag) => (
            <div className="scenario-timetable-train-tags-tag">{tag}</div>
          ))}
        </div>
      </div>
      <div className="scenario-timetable-train-buttons">
        <button className="scenario-timetable-train-buttons-update" type="button">
          <FaPencilAlt />
        </button>
        <button className="scenario-timetable-train-buttons-delete" type="button">
          <FaTrash />
        </button>
      </div>
    </div>
  );
}
