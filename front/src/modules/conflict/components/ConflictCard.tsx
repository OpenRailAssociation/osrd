import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { extractHHMMSS } from 'utils/date';

import type { ConflictWithTrainNames } from '../types';

const ConflictCard = ({
  conflict,
  onConflictClick,
}: {
  conflict: ConflictWithTrainNames;
  onConflictClick: (conflict: ConflictWithTrainNames) => void;
}) => {
  const { t } = useTranslation(['operationalStudies/scenario']);
  const start_time = extractHHMMSS(conflict.start_time);
  const end_time = extractHHMMSS(conflict.end_time);
  const start_date = dayjs(conflict.start_time).format('DD/MM/YYYY');

  return (
    <div
      className="conflict-card"
      onClick={() => onConflictClick(conflict)}
      role="button"
      tabIndex={0}
    >
      <div className="trains-info">
        <p className="conflict-type">{t(`${conflict.conflict_type}`)}</p>
        <div className="start-and-end-time">
          <div className="start-time" title={start_time}>
            {start_time}
          </div>
          <div className="end-time" title={end_time}>
            {end_time}
          </div>
        </div>
        <div className="departure-date" title={start_date}>
          {start_date}
        </div>
      </div>
      <div className="trains-name">
        {conflict.trainNames.map((trainName, idx) => (
          <div className="train-name-card" key={`train-${idx}-${trainName}`} title={trainName}>
            {trainName}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConflictCard;
