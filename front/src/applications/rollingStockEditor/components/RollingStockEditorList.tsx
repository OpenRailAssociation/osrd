import { useMemo, type RefObject } from 'react';

import { useTranslation } from 'react-i18next';

import type {
  LightRollingStockWithLiveries,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import type { Privilege } from 'common/authorization/types';
import { Loader } from 'common/Loaders';
import { RollingStockCard } from 'modules/rollingStock/components/RollingStockCard';

import type { PageMode } from '../RollingStockEditorView';
import RollingStockEditorButtons from './RollingStockEditorButtons';

type RollingStockEditorListProps = {
  isLoading: boolean;
  data: LightRollingStockWithLiveries[];
  pageMode: PageMode;
  setPageMode: React.Dispatch<React.SetStateAction<PageMode>>;
  resetFilters: () => void;
  ref2scroll: RefObject<HTMLInputElement | null>;
  selectedRollingStock?: RollingStockWithLiveries;
  userPrivilegesByRollingStockId: Record<number, Set<Privilege>>;
};

export const RollingStockEditorList = ({
  isLoading,
  data,
  pageMode,
  setPageMode,
  resetFilters,
  ref2scroll,
  selectedRollingStock,
  userPrivilegesByRollingStockId,
}: RollingStockEditorListProps) => {
  const { t } = useTranslation();

  const selectedRollingStockId = useMemo(() => {
    if ('rollingStockId' in pageMode) return pageMode.rollingStockId;
    return undefined;
  }, [pageMode]);

  return (
    <div className="rollingstock-editor-list pr-1" data-testid="rollingstock-editor-list">
      {isLoading && <Loader msg={t('rollingStock.waitingLoader')} />}
      {!isLoading && (
        <>
          {data.map((rs) => (
            <div key={rs.id}>
              <div className="rolling-stock-card-container">
                <RollingStockCard
                  isOnEditMode
                  rollingStock={rs}
                  noCardSelected={selectedRollingStockId === undefined}
                  isOpen={rs.id === selectedRollingStockId}
                  onClick={() => setPageMode({ type: 'view', rollingStockId: rs.id })}
                  ref2scroll={selectedRollingStockId === rs.id ? ref2scroll : undefined}
                />
                {rs.id === selectedRollingStockId && selectedRollingStock && (
                  <RollingStockEditorButtons
                    setPageMode={setPageMode}
                    isCondensed
                    rollingStock={selectedRollingStock}
                    resetFilters={resetFilters}
                    userPrivileges={userPrivilegesByRollingStockId[rs.id] || new Set()}
                  />
                )}
              </div>
            </div>
          ))}
          {data.length === 0 && (
            <div data-testid="rollingstock-empty-result" className="rollingstock-empty">
              {t('rollingStock.resultFound', { count: 0 })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
