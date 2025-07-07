import { ArrowRight, ArrowSwitch } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { PairingItem } from '../types';

type RoundTripsModalColumnProps = {
  columnType: 'todo' | 'oneWays' | 'roundTrips';
  pairingItems: PairingItem[];
};

const RoundTripsModalColumn = ({ columnType, pairingItems }: RoundTripsModalColumnProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });

  return (
    <section
      className={cx('round-trips-modal-column', {
        'round-trips-column': columnType === 'roundTrips',
      })}
    >
      <h2 className="column-title">
        {columnType === 'oneWays' && <ArrowRight />}
        {columnType === 'roundTrips' && <ArrowSwitch />}
        <span>{t(columnType)}</span>
        <div className="item-count">{pairingItems.length}</div>
      </h2>
      <div className="column-wrapper">
        {pairingItems.length === 0 && columnType !== 'roundTrips' && (
          <div className="card-placeholder" />
        )}
        {pairingItems.length === 0 && columnType === 'roundTrips' && (
          <>
            <div className="card-placeholder" />
            <div className="separator" />
            <div className="card-placeholder" />
          </>
        )}
      </div>
    </section>
  );
};

export default RoundTripsModalColumn;
