import React, { useState, useEffect, useContext, useMemo, MutableRefObject } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure } from 'reducers/main';
import { useTranslation } from 'react-i18next';
import { isEmpty } from 'lodash';

import { LightRollingStock } from 'common/api/osrdEditoastApi';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import { RootState } from 'reducers';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import Loader from 'common/Loader';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import RollingStockEmpty from './RollingStockEmpty';
import RollingStockCard from './RollingStockCard';
import SearchRollingStock from './SearchRollingStock';

interface RollingStockModal {
  ref2scroll: MutableRefObject<HTMLDivElement | null>;
}

function RollingStockModal({ ref2scroll }: RollingStockModal) {
  const dispatch = useDispatch();
  const darkmode = useSelector((state: RootState) => state.main.darkmode);
  const rollingStockID = useSelector(getRollingStockID);
  const { t } = useTranslation(['translation', 'rollingstock']);
  const [isLoading, setIsLoading] = useState(false);
  const [openRollingStockCardId, setOpenRollingStockCardId] = useState(rollingStockID);
  const { closeModal } = useContext(ModalContext);

  if (darkmode) {
    import('./RollingStockDarkMode.scss');
  }

  const {
    data: { results: rollingStocks } = { results: [] },
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

  const listOfRollingStocks = useMemo(
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
        <RollingStockEmpty />
      ),
    [filteredRollingStockList, openRollingStockCardId, ref2scroll, openRollingStockCardId]
  );

  function displayList() {
    if (isEmpty(filteredRollingStockList)) {
      if (isLoading) {
        return <Loader msg={t('rollingstock:waitingLoader')} />;
      }
      return <div className="rollingstock-empty">{t('rollingstock:noResultFound')}</div>;
    }
    return listOfRollingStocks;
  }

  return (
    <ModalBodySNCF>
      <div className="rollingstock-search p-2">
        <div className="rollingstock-search-filters">
          <button type="button" className="close" aria-label="Close" onClick={closeModal}>
            <span aria-hidden="true">&times;</span>
          </button>
          <SearchRollingStock
            rollingStocks={rollingStocks}
            rollingStockID={rollingStockID}
            setOpenedRollingStockCardId={setOpenRollingStockCardId}
            setFilteredRollingStockList={setFilteredRollingStockList}
            filteredRollingStockList={filteredRollingStockList}
            setIsLoading={setIsLoading}
          />
        </div>
        <div className="rollingstock-search-list">{displayList()}</div>
      </div>
    </ModalBodySNCF>
  );
}

const MemoizedRollingStockModal = React.memo(RollingStockModal);
export default MemoizedRollingStockModal;
