import { ArrowRight, ArrowSwitch, KebabHorizontal, Services, Square } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { TRAIN_CATEGORY_CLASS } from '../consts';
import type { PairingItem } from '../types';

type RoundTripsModalCardProps = {
  pairingItem: PairingItem;
};

const RoundTripsModalCard = ({
  pairingItem: {
    name,
    category,
    interval,
    status,
    stops,
    startTime,
    origin,
    arrivalTime,
    destination,
  },
}: RoundTripsModalCardProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });

  const getStatusIcon = (itemStatus: 'todo' | 'oneWays' | 'roundTrip') => {
    if (itemStatus === 'todo') {
      return <Square />;
    }
    if (itemStatus === 'oneWays') {
      return <ArrowRight />;
    }
    return <ArrowSwitch />;
  };

  return (
    <div className="round-trips-card">
      <div className="round-trips-card-header">
        <h3
          className={cx('name', `train-category-text-${TRAIN_CATEGORY_CLASS[category ?? 'None']}`)}
        >
          {name}
        </h3>
        <div className="interval" title={t('cadence')}>
          {interval ? `${interval.total('minute')}\u2019` : '\u2013'}
        </div>
        <div className="status">{getStatusIcon(status)}</div>
        <div className="card-menu">
          <KebabHorizontal />
        </div>
      </div>
      <div className="round-trips-card-body">
        <div className="stops">
          <span className={cx({ 'no-stops': stops.length === 0 })}>{stops.length}</span>
          <Services className="stops-icon" />
        </div>
        <div className="od-infos">
          <div className="extremity">
            <div className="times">{startTime.getMinutes().toString().padStart(2, '0')}</div>
            <div className="location">{origin}</div>
          </div>
          <div className="extremity">
            <div className="times">{arrivalTime.getMinutes().toString().padStart(2, '0')}</div>
            <div className="location">{destination}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundTripsModalCard;
