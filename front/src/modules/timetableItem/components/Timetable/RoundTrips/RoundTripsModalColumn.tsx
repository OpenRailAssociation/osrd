import { ArrowRight, ArrowSwitch } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import RoundTripsModalCard from './RoundTripsModalCard';
import type { PairingItem } from '../types';

type RoundTripsModalColumnProps = {
  setPairingItems: React.Dispatch<React.SetStateAction<PairingItem[]>>;
} & (
  | {
      type: 'todo' | 'oneWays';
      pairingItems: PairingItem[];
    }
  | {
      type: 'roundTrips';
      pairingItems: { pair: [PairingItem, PairingItem]; isValid: boolean }[];
    }
);

const RoundTripsModalColumn = ({
  setPairingItems,
  type,
  pairingItems,
}: RoundTripsModalColumnProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.roundTripsModal' });

  const restoreItems = (itemsToMove: [PairingItem, PairingItem | null]) => {
    const formattedItems: PairingItem[] = itemsToMove
      .filter((item) => item !== null)
      .map((item) => ({
        ...item,
        status: 'todo',
      }));

    setPairingItems((prevData) => [
      ...formattedItems,
      ...prevData.filter((item) => !formattedItems.some((itemToMove) => itemToMove.id === item.id)),
    ]);
  };

  const moveItemToOneWays = (itemToMove: PairingItem) => {
    setPairingItems((prevData) => [
      { ...itemToMove, status: 'oneWays' },
      ...prevData.filter((item) => itemToMove.id !== item.id),
    ]);
  };

  const { data: { results: subCategories } = { results: [] } } =
    osrdEditoastApi.endpoints.getSubCategory.useQuery({
      pageSize: 100,
    });

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
              <RoundTripsModalCard
                key={pairingItem.id}
                pairingItem={pairingItem}
                restoreItems={() => restoreItems([pairingItem, null])}
                moveItemToOneWays={moveItemToOneWays}
                subCategories={subCategories}
              />
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
            pairingItems.map(({ pair: [pairA, pairB], isValid }) => (
              <div className="round-trip-pair" key={`${pairA.id}-${pairB.id}`}>
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
          ))}
      </div>
    </section>
  );
};

export default RoundTripsModalColumn;
