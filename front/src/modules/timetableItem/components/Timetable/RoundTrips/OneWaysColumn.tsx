import { ArrowRight } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { SubCategory } from 'common/api/osrdEditoastApi';

import RoundTripsModalCard from './RoundTripsModalCard';
import type { PairingItem } from '../types';

type OneWaysColumnProps = {
  setPairingItems: React.Dispatch<React.SetStateAction<PairingItem[]>>;
  pairingItems: PairingItem[];
  subCategories: SubCategory[];
};

const OneWaysColumn = ({ setPairingItems, pairingItems, subCategories }: OneWaysColumnProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });

  const restoreItems = (itemToMove: PairingItem) => {
    setPairingItems((prevData) => [
      { ...itemToMove, status: 'todo' },
      ...prevData.filter((item) => itemToMove.id !== item.id),
    ]);
  };

  return (
    <section className="round-trips-modal-column">
      <h2 className="column-title">
        <ArrowRight />
        <span>{t('oneWays')}</span>
        <div className="item-count">{pairingItems.length}</div>
      </h2>
      <div className="column-wrapper">
        {pairingItems.length === 0 ? (
          <div className="card-placeholder" />
        ) : (
          pairingItems.map((pairingItem) => (
            <RoundTripsModalCard
              key={pairingItem.id}
              pairingItem={pairingItem}
              restoreItems={() => restoreItems(pairingItem)}
              subCategories={subCategories}
            />
          ))
        )}
      </div>
    </section>
  );
};

export default OneWaysColumn;
