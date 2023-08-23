import React, { ComponentType, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getRollingStockID, getRollingStockComfort } from 'reducers/osrdconf/selectors';
import { RollingStock, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useTranslation } from 'react-i18next';
import RollingStockSelector from './RollingStockSelector';
import RollingStock2Img from './RollingStock2Img';

const WithRollingStockSelector =
  <T extends object>(Component: ComponentType<T>) =>
  (hocProps: T) => {
    const { t } = useTranslation(['translation', 'rollingstock']);

    const [rollingStockSelected, setRollingStockSelected] = useState<RollingStock | undefined>(
      undefined
    );
    const rollingStockID = useSelector(getRollingStockID);
    const rollingStockComfort: string = useSelector(getRollingStockComfort);
    const comfort = t('rollingstock:comfort');
    const comfortType = t(`rollingstock:comfortTypes.${rollingStockComfort}`);
    const choice = t('rollingstock:rollingstockChoice');

    const [getRollingStockByID] = osrdEditoastApi.useLazyGetRollingStockByIdQuery();

    const getRollingStock = () => {
      if (rollingStockID) {
        getRollingStockByID({ id: rollingStockID })
          .then(({ data }) => setRollingStockSelected(data))
          .catch((err) => console.error(err));
      }
    };

    useEffect(() => {
      if (rollingStockID !== undefined) {
        getRollingStock();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rollingStockID]);

    const image = <RollingStock2Img rollingStock={rollingStockSelected as RollingStock} />;

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
