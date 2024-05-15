import React, { useState, useEffect, useContext, useMemo, type MutableRefObject } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Loader } from 'common/Loaders';
import { useOsrdConfSelectors } from 'common/osrdContext';
import RollingStockCard from 'modules/rollingStock/components/RollingStockCard/RollingStockCard';
import SearchRollingStock from 'modules/rollingStock/components/RollingStockSelector/SearchRollingStock';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';

interface RollingStockModal {
  ref2scroll: MutableRefObject<HTMLDivElement | null>;
}

function RollingStockModal({ ref2scroll }: RollingStockModal) {
  const { getRollingStockID } = useOsrdConfSelectors();
  const rollingStockID = useSelector(getRollingStockID);
  const { t } = useTranslation(['translation', 'rollingstock']);
  const [openRollingStockCardId, setOpenRollingStockCardId] = useState(rollingStockID);
  const { closeModal } = useContext(ModalContext);

  const { filteredRollingStockList, filters, searchMateriel, toggleFilter, searchIsLoading } =
    useFilterRollingStock();

  useEffect(() => {
    if (openRollingStockCardId !== undefined) {
      // Because of modal waiting for displaying, have to set a timeout to correctly scroll to ref
      // BUT finally, it's great, it creates a micro-interaction (smooth scroll) !
      setTimeout(() => {
        ref2scroll.current?.scrollIntoView({ behavior: 'smooth' });
      }, 1000);
    }
  }, [ref2scroll.current]);

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
    <ModalBodySNCF style={{ paddingBottom: 0 }}>
      <div className="rollingstock-selector p-2">
        <div className="rollingstock-search-filters">
          <button type="button" className="close" aria-label="Close" onClick={closeModal}>
            <span aria-hidden="true">&times;</span>
          </button>
          <SearchRollingStock
            filteredRollingStockList={filteredRollingStockList}
            filters={filters}
            searchMateriel={searchMateriel}
            toggleFilter={toggleFilter}
          />
        </div>
        <div className="rollingstock-search-list">
          {searchIsLoading ? <Loader msg={t('rollingstock:waitingLoader')} /> : rollingStocksList}
        </div>
      </div>
    </ModalBodySNCF>
  );
}

const MemoizedRollingStockModal = React.memo(RollingStockModal);
export default MemoizedRollingStockModal;
