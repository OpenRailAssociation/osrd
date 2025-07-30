import { useRef, useState } from 'react';

import { Input } from '@osrd-project/ui-core';
import { Filter } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { SubCategory } from 'common/api/osrdEditoastApi';
import useOutsideClick from 'utils/hooks/useOutsideClick';

import RoundTripsModalCard from './RoundTripsModalCard';
import type { PairingItem } from '../types';

type RoundTripsModalPairingColumnProps = {
  closePairingMode: () => void;
  suggestions: PairingItem[];
  others: PairingItem[];
  subCategories: SubCategory[];
};

const RoundTripsModalPairingColumn = ({
  closePairingMode,
  suggestions,
  others,
  subCategories,
}: RoundTripsModalPairingColumnProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.roundTripsModal',
  });

  const modalRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState('');

  useOutsideClick(modalRef, closePairingMode);

  return (
    <>
      <div className="round-trips-pairing-overlay" />
      <div ref={modalRef} className="round-trips-pairing-column">
        <Input
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
              .map((item) => (
                <RoundTripsModalCard
                  key={item.id}
                  pairingItem={item}
                  subCategories={subCategories}
                />
              ))}
          </section>
        )}
        {others.length > 0 && (
          <section>
            <h3 className="title">{t('others')}</h3>
            {others
              .filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()))
              .map((item) => (
                <RoundTripsModalCard
                  key={item.id}
                  pairingItem={item}
                  subCategories={subCategories}
                />
              ))}
          </section>
        )}
      </div>
    </>
  );
};

export default RoundTripsModalPairingColumn;
