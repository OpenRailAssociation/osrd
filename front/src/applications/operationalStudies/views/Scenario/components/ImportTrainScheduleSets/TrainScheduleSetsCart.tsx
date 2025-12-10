import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import TrainScheduleSetCartItem from './TrainScheduleSetCartItem';
import type { CartManagement, CatalogById, TrainScheduleSetById } from './types';

type TrainScheduleSetCartProps = CartManagement & {
  catalog: CatalogById;
  trainScheduleSets: TrainScheduleSetById;
};

const TrainScheduleSetsCart = ({
  catalog,
  trainScheduleSets,
  cart,
  upsertToCart,
  removeFromCart,
}: TrainScheduleSetCartProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrainScheduleSet' });

  /**
   * List of TrainSchedule sets in the cart
   */
  const trainScheduleSetsInCart = useMemo(
    () =>
      cart.map((cartItem) => {
        const trainScheduleSet = trainScheduleSets.get(cartItem.trainScheduleSetId)!;
        const catalogEntry = catalog.get(trainScheduleSet.catalog_entry_id!)!;
        return { trainScheduleSet, catalogEntry, importType: cartItem.importType };
      }),
    [cart, catalog, trainScheduleSets, cart]
  );

  return (
    <>
      {trainScheduleSetsInCart.length === 0 && <p className="cart-empty">{t('cartEmpty')}</p>}
      {trainScheduleSetsInCart.map((cartItem) => (
        <TrainScheduleSetCartItem
          key={cartItem.trainScheduleSet.id}
          {...cartItem}
          cart={cart}
          upsertToCart={upsertToCart}
          removeFromCart={removeFromCart}
        />
      ))}
    </>
  );
};

export default TrainScheduleSetsCart;
