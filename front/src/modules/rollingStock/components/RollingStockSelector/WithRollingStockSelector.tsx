import React, { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import RollingStockSelector from 'modules/rollingStock/components/RollingStockSelector/RollingStockSelector';

import { useOsrdConfSelectors } from 'common/osrdContext';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';

const WithRollingStockSelector =
  <T extends object>(Component: ComponentType<T>) =>
  (hocProps: T) => {
    const { t } = useTranslation(['translation', 'rollingstock']);

    const [rollingStockSelected, setRollingStockSelected] = useState<
      RollingStockWithLiveries | undefined
    >();

    const { getRollingStockID, getRollingStockComfort } = useOsrdConfSelectors();
    const rollingStockId = useSelector(getRollingStockID);
    const rollingStockComfort: string = useSelector(getRollingStockComfort);
    const comfort = t('rollingstock:comfort');
    const comfortType = t(`rollingstock:comfortTypes.${rollingStockComfort}`);
    const choice = t('rollingstock:rollingstockChoice');

    const [getRollingStockByID] = osrdEditoastApi.useLazyGetRollingStockByRollingStockIdQuery();

    const getRollingStock = () => {
      if (rollingStockId) {
        getRollingStockByID({ rollingStockId })
          .then(({ data }) => setRollingStockSelected(data))
          .catch((err) => console.error(err));
      }
    };

    useEffect(() => {
      if (rollingStockId !== undefined) {
        getRollingStock();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rollingStockId]);

    const image = rollingStockSelected && <RollingStock2Img rollingStock={rollingStockSelected} />;

    return (
      <Component
        {...(hocProps as T)}
        rollingStockSelected={rollingStockSelected}
        rollingStockComfort={rollingStockComfort}
        image={image}
        comfort={comfort}
        comfortType={comfortType}
        choice={choice}
      />
    );
  };

export default WithRollingStockSelector(RollingStockSelector);
