import { ArrowSwitch } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { SubCategory } from 'common/api/osrdEditoastApi';

import RoundTripsModalCard from './RoundTripsModalCard';
import type { PairingItem, RoundTripsColumnPair } from './types';

type RoundTripsColumnProps = {
  setPairingItems: React.Dispatch<React.SetStateAction<PairingItem[]>>;
  pairingItems: RoundTripsColumnPair[];
  hideColumn: boolean;
  subCategories: SubCategory[];
};

const RoundTripsColumn = ({
  setPairingItems,
  pairingItems,
  hideColumn,
  subCategories,
}: RoundTripsColumnProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });

  const restoreItems = ([itemA, itemB]: [PairingItem, PairingItem]) => {
    setPairingItems((prevData) => [
      {
        ...itemA,
        status: 'todo',
      },
      {
        ...itemB,
        status: 'todo',
      },
      ...prevData.filter((item) => itemA.id !== item.id && itemB.id !== item.id),
    ]);
  };

  return (
    <section
      className={cx('round-trips-modal-column-wrapper round-trips-column', {
        'hide-column': hideColumn,
      })}
    >
      <div className="scroll-container">
        <div data-testid="round-trips-column" className="round-trips-modal-column">
          <h2 className="column-title">
            <ArrowSwitch />
            <span data-testid="round-trips-title">{t('roundTrips')}</span>
            <div data-testid="round-trips-item-count" className="item-count">
              {pairingItems.length}
            </div>
          </h2>
          <div className="column-wrapper">
            {pairingItems.length === 0 ? (
              <div className="round-trip-pair">
                <div className="card-placeholder" />
                <div className="separator" />
                <div className="card-placeholder" />
              </div>
            ) : (
              pairingItems.map(({ pair: [pairA, pairB], isValid }) => (
                <div
                  data-testid="round-trips-pair"
                  className="round-trip-pair"
                  key={`${pairA.id}-${pairB.id}`}
                >
                  <RoundTripsModalCard
                    pairingItem={pairA}
                    restoreItems={() => restoreItems([pairA, pairB])}
                    subCategories={subCategories}
                  />
                  <div
                    className={cx('separator', {
                      valid: isValid,
                      invalid: !isValid,
                    })}
                  />
                  <RoundTripsModalCard
                    pairingItem={pairB}
                    restoreItems={() => restoreItems([pairA, pairB])}
                    subCategories={subCategories}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoundTripsColumn;
