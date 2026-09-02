import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { TrainSchedulePart } from 'common/api/osrdEditoastApi';
import { msSinceMidnightToTime } from 'utils/date';

type SolutionSegmentCardProps = {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  part: TrainSchedulePart;
  trainName?: string;
  fromOperationalPointName?: string;
  toOperationalPointName?: string;
};

const SolutionSegmentCard = ({
  index,
  isFirst,
  isLast,
  part,
  trainName,
  fromOperationalPointName,
  toOperationalPointName,
}: SolutionSegmentCardProps) => {
  const { t } = useTranslation('search-journey');

  return (
    <div className="solution-segment-card">
      <div className="solution-segment-card__left">
        <span className="solution-segment-card__index">{index}</span>
        <div className="solution-segment-card__endpoints">
          <span className="solution-segment-card__endpoint">
            <span>{msSinceMidnightToTime(part.from.time_ms)}</span>
            <span className={cx({ 'font-weight-bold': isFirst })}>
              {fromOperationalPointName ?? part.from.op_id}
            </span>
          </span>
          <span className="solution-segment-card__endpoint">
            <span>{msSinceMidnightToTime(part.to.time_ms)}</span>
            <span className={cx({ 'font-weight-bold': isLast })}>
              {toOperationalPointName ?? part.to.op_id}
            </span>
          </span>
        </div>
      </div>
      <div className="solution-segment-card__right">
        <span className="solution-segment-card__train-name">
          {t('results.trainPathPrefix')}
          {trainName ?? '...'}
        </span>
      </div>
    </div>
  );
};

export default SolutionSegmentCard;
