import { useRef } from 'react';

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

  useOutsideClick(modalRef, closePairingMode);

  return (
    <>
      <div className="round-trips-pairing-overlay" />
      <div ref={modalRef} className="round-trips-pairing-column">
        {suggestions.length > 0 && (
          <section>
            <h3 className="title">{t('suggestions')}</h3>
            {suggestions.map((item) => (
              <RoundTripsModalCard key={item.id} pairingItem={item} subCategories={subCategories} />
            ))}
          </section>
        )}
        {others.length > 0 && (
          <section>
            <h3 className="title">{t('others')}</h3>
            {others.map((item) => (
              <RoundTripsModalCard key={item.id} pairingItem={item} subCategories={subCategories} />
            ))}
          </section>
        )}
      </div>
    </>
  );
};

export default RoundTripsModalPairingColumn;
