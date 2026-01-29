import { useCallback, useState } from 'react';

import { Button, Dialog } from '@osrd-project/ui-core';
import { Blocked } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { TrainScheduleSet } from 'common/api/osrdEditoastApi';
import { LoaderFill } from 'common/Loaders';
import { getErrorMessage } from 'utils/error';

import TrainScheduleSetCart from './TrainScheduleSetsCart';
import TrainScheduleSetCatalog from './TrainScheduleSetsCatalog';
import type { CartManagement, TrainScheduleSetImportType } from './types';
import useLoadCatalog from './useLoadCatalog';

type TrainScheduleSetCatalogDialogueProps = {
  onCancel: () => void;
  onSubmit: (
    data: Array<{ type: TrainScheduleSetImportType; trainScheduleSet: TrainScheduleSet }>
  ) => void;
};

const TrainScheduleSetCatalogDialog = ({
  onCancel,
  onSubmit,
}: TrainScheduleSetCatalogDialogueProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrainScheduleSet' });
  const { loading, error, data, trainScheduleSetsAlreadyImported } = useLoadCatalog();
  const [cart, setCart] = useState<CartManagement['cart']>([]);

  /**
   * Add or update a TSS to cart.
   */
  const upsertToCart: CartManagement['upsertToCart'] = useCallback(
    (trainScheduleSetId, importType) => {
      setCart((prev) => {
        const index = prev.findIndex((e) => e.trainScheduleSetId === trainScheduleSetId);
        if (index >= 0) {
          const result = [...prev];
          result[index] = { trainScheduleSetId, importType };
          return result;
        } else return [...prev, { trainScheduleSetId, importType }];
      });
    },
    [setCart]
  );

  /**
   * Remove a TSS from cart.
   */
  const removeFromCart: CartManagement['removeFromCart'] = useCallback(
    (trainScheduleSetId) =>
      setCart((prev) => prev.filter((e) => e.trainScheduleSetId !== trainScheduleSetId)),
    [setCart]
  );

  const submit = useCallback(() => {
    onSubmit(
      cart.map(({ trainScheduleSetId, importType }) => {
        const trainScheduleSet = data?.trainScheduleSets.get(trainScheduleSetId);
        if (!trainScheduleSet)
          throw new Error(`Can't find trainSheculeSet ${trainScheduleSetId} in catalog`);
        return {
          type: importType,
          trainScheduleSet,
        };
      })
    );
  }, [cart, onSubmit, data?.trainScheduleSets]);

  return (
    <Dialog
      fullscreen
      className={cx('import-trainscheduleset', error && 'with-error')}
      header={<h5>{t('title')}</h5>}
      footer={
        <>
          <div className="error">
            {error && (
              <>
                <Blocked variant="fill" size="lg" />
                <span>{getErrorMessage(error)}</span>
              </>
            )}
          </div>
          <div className="buttons">
            <Button variant="Cancel" label={t('cancel')} onClick={onCancel} />
            <Button isDisabled={loading} label={t('import')} onClick={submit} />
          </div>
        </>
      }
    >
      <aside className="catalog">
        {data && (
          <TrainScheduleSetCatalog
            catalog={data.catalog}
            trainScheduleSets={data.trainScheduleSets}
            disabledTrainScheduleSets={trainScheduleSetsAlreadyImported}
            cart={cart}
            upsertToCart={upsertToCart}
            removeFromCart={removeFromCart}
          />
        )}
      </aside>
      <div className="cart">
        <div className="cart-wrapper">
          {data && (
            <TrainScheduleSetCart
              catalog={data.catalog}
              trainScheduleSets={data.trainScheduleSets}
              cart={cart}
              upsertToCart={upsertToCart}
              removeFromCart={removeFromCart}
            />
          )}
        </div>
      </div>
      {loading && <LoaderFill />}
    </Dialog>
  );
};

export default TrainScheduleSetCatalogDialog;
