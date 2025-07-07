import { ArrowRight, ArrowSwitch } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { PairingItem } from '../types';
import RoundTripsModalCard from './RoundTripsModalCard';

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
        {type !== 'roundTrips' &&
          (pairingItems.length === 0 ? (
            <div className="card-placeholder" />
          ) : (
            pairingItems.map((pairingItem) => (
              <RoundTripsModalCard key={pairingItem.id} pairingItem={pairingItem} />
            ))
          ))}
        {type === 'roundTrips' &&
          (pairingItems.length === 0 ? (
            <div className="round-trip-pair">
              <div className="card-placeholder" />
              <div className="separator" />
              <div className="card-placeholder" />
            </div>
          ) : (
            pairingItems.map(({ pair, isValid }) => (
              <div className="round-trip-pair" key={`${pair[0].id}-${pair[1].id}`}>
                <RoundTripsModalCard pairingItem={pair[0]} />
                <div
                  className={cx('separator', {
                    valid: isValid,
                    invalid: !isValid,
                  })}
                />
                <RoundTripsModalCard pairingItem={pair[1]} />
              </div>
            ))
          ))}
      </div>
    </section>
  );
};

export default RoundTripsModalColumn;
