import React from 'react';

import { useTranslation } from 'react-i18next';
import { BsLightningFill } from 'react-icons/bs';

import { formatToIsoDate } from 'utils/date';

import type { ConflictWithTrainNames } from '../types';

const ConflictCardV2 = ({
  conflict,
  onConflictClick,
}: {
  conflict: ConflictWithTrainNames;
  onConflictClick: (conflict: ConflictWithTrainNames) => void;
}) => {
  const { t } = useTranslation(['operationalStudies/scenario']);

  return (
    <div
      className="conflict-card"
      onClick={() => onConflictClick(conflict)}
      role="button"
      tabIndex={0}
    >
      <BsLightningFill color="red" />
      <div className="conflict-trains">
        {conflict.trainNames.map((trainName, idx) => (
          <div className="card-text" key={`train-${idx}-${trainName}`}>
            {trainName}
          </div>
        ))}
      </div>
      <div className="conflict-type">
        <p>{t(`${conflict.conflict_type}`)}</p>
      </div>
      <div className="conflict-times">
        <div className="start-time" title={formatToIsoDate(conflict.start_time, true)}>
          {formatToIsoDate(conflict.start_time, true)}
        </div>
        <div className="end-time" title={formatToIsoDate(conflict.end_time, true)}>
          {formatToIsoDate(conflict.end_time, true)}
        </div>
      </div>
    </div>
  );
};

export default ConflictCardV2;
