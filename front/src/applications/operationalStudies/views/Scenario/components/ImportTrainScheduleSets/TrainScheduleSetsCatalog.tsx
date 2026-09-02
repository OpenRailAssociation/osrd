import { useMemo } from 'react';

import { TriangleRight, TriangleDown } from '@osrd-project/ui-icons';
import { sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { TrainScheduleSet } from 'common/api/osrdEditoastApi';
import Collapsable from 'common/Collapsable';

import TrainScheduleSetMenuItem from './TrainScheduleSetMenuItem';
import type { CartManagement, CatalogById, TrainScheduleSetById } from './types';

type TrainScheduleSetCatalogProps = CartManagement & {
  catalog: CatalogById;
  trainScheduleSets: TrainScheduleSetById;
  disabledTrainScheduleSets: Set<TrainScheduleSet['id']>;
};

const TrainScheduleSetsCatalog = ({
  catalog,
  trainScheduleSets,
  disabledTrainScheduleSets,
  cart,
  upsertToCart,
  removeFromCart,
}: TrainScheduleSetCatalogProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrainScheduleSet' });

  /**
   * List of catalog entries
   */
  const catalogEntries = useMemo(() => {
    const catalogData = Array.from(catalog.values()).map((catalogEntry) => {
      const trainScheduleSetsData = catalogEntry.trainScheduleSetIds.map((tssId) =>
        trainScheduleSets.get(tssId)!
      );
      return {
        ...catalogEntry,
        countSelected: cart.filter((cartItem) => {
          const tss = trainScheduleSets.get(cartItem.trainScheduleSetId);
          return tss?.catalog_entry_id === catalogEntry.id;
        }).length,
        trainScheduleSets: sortBy(trainScheduleSetsData, ['name']),
      };
    });
    return sortBy(catalogData, ['name']);
  }, [trainScheduleSets, catalog, cart]);

  return (
    <>
      {catalogEntries.map((entry) => (
        <Collapsable
          key={entry.id}
          className="catalog-entry"
          iconPosition="left"
          iconOpen={<TriangleDown className="collapse-icon" />}
          iconClose={<TriangleRight className="collapse-icon" />}
        >
          <div className="collapse-title">
            <span>{entry.name}</span>
            {entry.countSelected > 0 && (
              <span className="count">
                {t('trainScheduleSetsSelected', { count: entry.countSelected })}
              </span>
            )}
          </div>

          <>
            {entry.trainScheduleSets.map((ts) => (
              <TrainScheduleSetMenuItem
                key={ts.id}
                trainScheduleSet={ts}
                disabled={disabledTrainScheduleSets.has(ts.id)}
                cart={cart}
                upsertToCart={upsertToCart}
                removeFromCart={removeFromCart}
              />
            ))}
          </>
        </Collapsable>
      ))}
    </>
  );
};

export default TrainScheduleSetsCatalog;
