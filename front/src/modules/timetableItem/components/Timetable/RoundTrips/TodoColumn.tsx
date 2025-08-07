import { useTranslation } from 'react-i18next';

import type { SubCategory } from 'common/api/osrdEditoastApi';

import RoundTripsModalCard from './RoundTripsModalCard';
import type { PairingItem } from '../types';

type TodoColumnProps = {
  setPairingItems: React.Dispatch<React.SetStateAction<PairingItem[]>>;
  pairingItems: PairingItem[];
  subCategories: SubCategory[];
};

const TodoColumn = ({ setPairingItems, pairingItems, subCategories }: TodoColumnProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });

  const moveItemToOneWays = (itemToMove: PairingItem) => {
    setPairingItems((prevData) => [
      { ...itemToMove, status: 'oneWays' },
      ...prevData.filter((item) => itemToMove.id !== item.id),
    ]);
  };

  return (
    <section className="round-trips-modal-column">
      <h2 className="column-title">
        <span>{t('todo')}</span>
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
              moveItemToOneWays={moveItemToOneWays}
              subCategories={subCategories}
            />
          ))
        )}
      </div>
    </section>
  );
};

export default TodoColumn;
