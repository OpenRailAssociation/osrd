import React, { ComponentType, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getRollingStockID, getRollingStockComfort } from 'reducers/osrdconf/selectors';
import { RollingStockWithLiveries, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useTranslation } from 'react-i18next';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import RollingStockSelector from './RollingStockSelector';

const WithRollingStockSelector =
  <T extends object>(Component: ComponentType<T>) =>
  (hocProps: T) => {
    const { t } = useTranslation(['translation', 'rollingstock']);

    const [rollingStockSelected, setRollingStockSelected] = useState<
      RollingStockWithLiveries | undefined
    >(undefined);
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
