import { ArrowRight } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { SubCategory } from 'common/api/osrdEditoastApi';

import RoundTripsModalCard from './RoundTripsModalCard';
import type { PairingItem } from './types';

type OneWaysColumnProps = {
  setPairingItems: React.Dispatch<React.SetStateAction<PairingItem[]>>;
  pairingItems: PairingItem[];
  hideColumn: boolean;
  subCategories: SubCategory[];
};

const OneWaysColumn = ({
  setPairingItems,
  pairingItems,
  hideColumn,
  subCategories,
}: OneWaysColumnProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });

  const restoreItems = (itemToMove: PairingItem) => {
    setPairingItems((prevData) => [
      { ...itemToMove, status: 'todo' },
      ...prevData.filter((item) => itemToMove.id !== item.id),
    ]);
  };

  return (
    <section
      className={cx('round-trips-modal-column-wrapper', {
        'hide-column': hideColumn,
      })}
    >
      <div className="scroll-container">
        <div data-testid="one-ways-column" className="round-trips-modal-column">
          <h2 className="column-title">
            <ArrowRight />
            <span data-testid="one-ways-title">{t('oneWays')}</span>
            <div data-testid="one-ways-item-count" className="item-count">
              {pairingItems.length}
            </div>
          </h2>
          <div className="column-wrapper">
            {pairingItems.length === 0 ? (
              <div className="card-placeholder" />
            ) : (
              pairingItems.map((pairingItem) => (
                <div className="round-trips-card-wrapper" key={pairingItem.id}>
                  <RoundTripsModalCard
                    pairingItem={pairingItem}
                    restoreItems={() => restoreItems(pairingItem)}
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

export default OneWaysColumn;
