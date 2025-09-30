import { useRef, useState } from 'react';

import { Input } from '@osrd-project/ui-core';
import { Filter } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { SubCategory } from 'common/api/osrdEditoastApi';
import type { TimetableItemId } from 'reducers/osrdconf/types';
import useOutsideClick from 'utils/hooks/useOutsideClick';

import RoundTripsModalCard from './RoundTripsModalCard';
import type { PairDataToolTip, PairingItem } from './types';

type RoundTripsModalPairingColumnProps = {
  closePairingMode: () => void;
  suggestions: PairingItem[];
  others: PairingItem[];
  pairItems: (candidate: PairingItem) => void;
  pairingItemsById: Map<TimetableItemId, PairingItem>;

  subCategories: SubCategory[];
};

const RoundTripsModalPairingColumn = ({
  closePairingMode,
  suggestions,
  others,
  pairItems,
  pairingItemsById,
  subCategories,
}: RoundTripsModalPairingColumnProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.roundTripsModal',
  });

  const modalRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState('');

  useOutsideClick(modalRef, closePairingMode);

  const getPairData = (itemA: PairingItem): PairDataToolTip | undefined => {
    if (itemA.status !== 'roundTrips') return;

    const itemB = pairingItemsById.get(itemA.pairedItemId);
    if (!itemB) throw new Error('item in roundtrips column must have a paired item');
    return {
      name: itemB.name,
      origin: itemB.origin,
      startTime: itemB.startTime,
      destination: itemB.destination,
      requestedArrivalTime: itemB.requestedArrivalTime,
    };
  };

  return (
    <>
      <div className="round-trips-pairing-overlay" />
      <div
        ref={modalRef}
        data-testid="round-trips-pairing-column"
        className="round-trips-pairing-column"
      >
        <Input
          testIdPrefix="pairing-card-filter"
          id="candidates-filter"
          small
          narrow
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          withIcons={[
            {
              icon: <Filter size="sm" />,
              action: () => {},
              className: 'filter-input-icon',
            },
          ]}
        />
        {suggestions.length > 0 && (
          <section>
            <h3 className="title">{t('suggestions')}</h3>
            {suggestions
              .filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()))
              .map((item, index) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={index + 1}
                  onClick={() => pairItems(item)}
                >
                  <RoundTripsModalCard
                    pairingItem={item}
                    isCandidate
                    subCategories={subCategories}
                    pairData={getPairData(item)}
                  />
                </div>
              ))}
          </section>
        )}
        {others.length > 0 && (
          <section>
            <h3 className="title">{t('others')}</h3>
            {others
              .filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()))
              .map((item, index) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={suggestions.length + index}
                  onClick={() => pairItems(item)}
                >
                  <RoundTripsModalCard
                    pairingItem={item}
                    isCandidate
                    subCategories={subCategories}
                    pairData={getPairData(item)}
                  />
                </div>
              ))}
          </section>
        )}
      </div>
    </>
  );
};

export default RoundTripsModalPairingColumn;
