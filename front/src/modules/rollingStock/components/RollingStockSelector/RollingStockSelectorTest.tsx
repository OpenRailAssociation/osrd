import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { useTranslation } from 'react-i18next';

import { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import Loader from 'common/Loader/Loader';
import RollingStockCard from 'modules/rollingStock/components/RollingStockCard/RollingStockCard';
import SearchRollingStock from './SearchRollingStock';

const RollingStockSelector = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation(['translation', 'rollingstock']);

  const rollingStockID = useSelector(getRollingStockID);
  const ref2scroll = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [openRollingStockCardId, setOpenRollingStockCardId] = useState(rollingStockID);

  const {
    data: { results: rollingStocks } = { results: [] },
    isSuccess,
    isError,
    error,
  } = enhancedEditoastApi.useGetLightRollingStockQuery({
    pageSize: 1000,
  });
  const [filteredRollingStockList, setFilteredRollingStockList] =
    useState<LightRollingStockWithLiveries[]>(rollingStocks);

  useEffect(() => {
    if (openRollingStockCardId !== undefined) {
      // Because of modal waiting for displaying, have to set a timeout to correctly scroll to ref
      // BUT finally, it's great, it creates a micro-interaction (smooth scroll) !
      setTimeout(() => {
        ref2scroll.current?.scrollIntoView({ behavior: 'smooth' });
      }, 1000);
    }
  }, [ref2scroll.current]);

  useEffect(() => {
    if (isError && error && 'status' in error) {
      dispatch(
        setFailure({
          name: t('rollingstock:errorMessages.unableToRetrieveRollingStock'),
          message:
            error.status === 404
              ? t('rollingstock:errorMessages.ressourcesNotFound')
              : t('rollingstock:errorMessages.unableToRetrieveRollingStockMessage'),
        })
      );
    }
  }, [isError]);

  const rollingStocksList = useMemo(
    () =>
      filteredRollingStockList.length > 0 ? (
        filteredRollingStockList.map((item) => (
          <RollingStockCard
            rollingStock={item}
            key={item.id}
            noCardSelected={openRollingStockCardId === undefined}
            isOpen={item.id === openRollingStockCardId}
            setOpenedRollingStockCardId={setOpenRollingStockCardId}
            ref2scroll={openRollingStockCardId === item.id ? ref2scroll : undefined}
          />
        ))
      ) : (
        <div className="rollingstock-empty">{t('rollingstock:noResultFound')}</div>
      ),
    [filteredRollingStockList, openRollingStockCardId, ref2scroll, openRollingStockCardId]
  );

  return (
    <div className="rollingstock-selector p-2">
      <div className="rollingstock-search-filters">
        <SearchRollingStock
          rollingStocks={rollingStocks}
          setFilteredRollingStockList={setFilteredRollingStockList}
          filteredRollingStockList={filteredRollingStockList}
          isSuccess={isSuccess}
          setIsLoading={setIsLoading}
        />
      </div>
      <div className="rollingstock-search-list">
        {isLoading ? <Loader msg={t('rollingstock:waitingLoader')} /> : rollingStocksList}
      </div>
    </div>
  );
};

export default RollingStockSelector;
