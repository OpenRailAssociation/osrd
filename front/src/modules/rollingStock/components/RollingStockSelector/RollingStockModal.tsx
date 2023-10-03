import React, { useState, useEffect, useContext, useMemo, MutableRefObject } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { useTranslation } from 'react-i18next';

import { LightRollingStock } from 'common/api/osrdEditoastApi';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import Loader from 'common/Loader';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import RollingStockCard from './RollingStockCard';
import SearchRollingStock from './SearchRollingStock';

interface RollingStockModal {
  ref2scroll: MutableRefObject<HTMLDivElement | null>;
}

function RollingStockModal({ ref2scroll }: RollingStockModal) {
  const dispatch = useDispatch();
  const rollingStockID = useSelector(getRollingStockID);
  const { t } = useTranslation(['translation', 'rollingstock']);
  const [isLoading, setIsLoading] = useState(true);
  const [openRollingStockCardId, setOpenRollingStockCardId] = useState(rollingStockID);
  const { closeModal } = useContext(ModalContext);

  const {
    data: { results: rollingStocks } = { results: [] },
    isSuccess,
    isError,
    error,
  } = enhancedEditoastApi.useGetLightRollingStockQuery({
    pageSize: 1000,
  });
  const [filteredRollingStockList, setFilteredRollingStockList] =
    useState<LightRollingStock[]>(rollingStocks);

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
        filteredRollingStockList.map((item: LightRollingStock) => (
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
    <ModalBodySNCF style={{ paddingBottom: 0 }}>
      <div className="rollingstock-search p-2">
        <div className="rollingstock-search-filters">
          <button type="button" className="close" aria-label="Close" onClick={closeModal}>
            <span aria-hidden="true">&times;</span>
          </button>
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
    </ModalBodySNCF>
  );
}

const MemoizedRollingStockModal = React.memo(RollingStockModal);
export default MemoizedRollingStockModal;
