import React, { useState, useEffect, useContext, useMemo, type MutableRefObject } from 'react';

import { useTranslation } from 'react-i18next';

import type { Comfort, LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Loader } from 'common/Loaders';
import SearchRollingStock from 'modules/rollingStock/components/RollingStockSelector/SearchRollingStock';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';

import { RollingStockCard } from '../RollingStockCard';

type RollingStockModal = {
  rollingStockId: number | undefined;
  ref2scroll: MutableRefObject<HTMLDivElement | null>;
  onSelectRollingStock: (rollingStock: LightRollingStockWithLiveries, comfort: Comfort) => void;
};

function RollingStockModal({
  rollingStockId,
  ref2scroll,
  onSelectRollingStock,
}: RollingStockModal) {
  const { t } = useTranslation();
  const [openRollingStockCardId, setOpenRollingStockCardId] = useState(rollingStockId);
  const { closeModal } = useContext(ModalContext);

  const { filteredRollingStockList, filters, searchRollingStock, toggleFilter, searchIsLoading } =
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
            onSelectRollingStock={onSelectRollingStock}
          />
        ))
      ) : (
        <div className="rollingstock-empty">{t('rollingStock.resultFound', { count: 0 })}</div>
      ),
    [filteredRollingStockList, openRollingStockCardId, ref2scroll, openRollingStockCardId]
  );

  return (
    <ModalBodySNCF style={{ paddingBottom: 0 }}>
      <div data-testid="rollingstock-selector-modal" className="rollingstock-selector p-2">
        <div className="rollingstock-search-filters">
          <button type="button" className="close" aria-label="Close" onClick={closeModal}>
            <span aria-hidden="true">&times;</span>
          </button>
          <SearchRollingStock
            filteredRollingStockList={filteredRollingStockList}
            filters={filters}
            searchRollingStock={searchRollingStock}
            toggleFilter={toggleFilter}
          />
        </div>
        <div className="rollingstock-search-list">
          {searchIsLoading ? <Loader msg={t('rollingStock.waitingLoader')} /> : rollingStocksList}
        </div>
      </div>
    </ModalBodySNCF>
  );
}

const MemoizedRollingStockModal = React.memo(RollingStockModal);
export default MemoizedRollingStockModal;
