import { ArrowRight, ArrowSwitch } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { PairingItem } from '../types';

type RoundTripsModalColumnProps =
  | {
      type: 'todo' | 'oneWays';
      pairingItems: PairingItem[];
    }
  | {
      type: 'roundTrips';
      pairingItems: { pair: [PairingItem, PairingItem]; isValid: boolean }[];
    };

const RoundTripsModalColumn = ({ type, pairingItems }: RoundTripsModalColumnProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });

  return (
    <section
      className={cx('round-trips-modal-column', {
        'round-trips-column': type === 'roundTrips',
      })}
    >
      <h2 className="column-title">
        {type === 'oneWays' && <ArrowRight />}
        {type === 'roundTrips' && <ArrowSwitch />}
        <span>{t(type)}</span>
        <div className="item-count">{pairingItems.length}</div>
      </h2>
      <div className="column-wrapper">
        {pairingItems.length === 0 && type !== 'roundTrips' && <div className="card-placeholder" />}
        {pairingItems.length === 0 && type === 'roundTrips' && (
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
