import React, { useRef, useState } from 'react';

import RollingStockCard from 'common/RollingStockSelector/RollingStockCard';
import { useSelector } from 'react-redux';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import Loader from 'common/Loader';
import { useTranslation } from 'react-i18next';
import { LightRollingStock, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import RollingStockEditorButtons from '../components/RollingStockEditorButtons';
import RollingStockEditorCard from '../components/RollingStockEditorCard';

type RollingStockEditorProps = {
  rollingStocks: LightRollingStock[];
};

export default function RollingStockEditor({ rollingStocks }: RollingStockEditorProps) {
  const { t } = useTranslation('rollingStockEditor');
  const ref2scroll: React.RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
  const rollingStockID = useSelector(getRollingStockID);
  const [isEditing, setIsEditing] = useState(false);

  const [openedRollingStockCardId, setOpenedRollingStockCardId] = useState<number>();

  const { data: selectedRollingStock } = osrdEditoastApi.useGetRollingStockByIdQuery(
    {
      id: openedRollingStockCardId as number,
    },
    {
      skip: !openedRollingStockCardId,
    }
  );

  return (
    <div className="d-flex pt-5 mt-5">
      <div className="d-flex ml-4 flex-column" style={{ width: '37%' }}>
        {rollingStocks.length > 0 ? (
          rollingStocks.map((rollingStock) => (
            <div className="d-flex rollingstock-editor-list" key={rollingStock.id}>
              <div
                role="button"
                tabIndex={0}
                className="align-self-start rollingstock-elements"
                onClick={() => setIsEditing(false)}
                style={{ width: '92%' }}
              >
                <RollingStockCard
                  isOnEditMode
                  rollingStock={rollingStock}
                  key={rollingStock.id}
                  noCardSelected={openedRollingStockCardId === undefined}
                  isOpen={rollingStock.id === openedRollingStockCardId}
                  setOpenedRollingStockCardId={setOpenedRollingStockCardId}
                  ref2scroll={rollingStockID === rollingStock.id ? ref2scroll : undefined}
                />
              </div>
              {rollingStock.id === openedRollingStockCardId && (
                <div className="align-self-start">
                  <RollingStockEditorButtons
                    isCondensed
                    setIsEditing={setIsEditing}
                    isRollingStockLocked={rollingStock.locked ?? false}
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <Loader msg={t('rollingstock:waitingLoader')} />
        )}
      </div>
      <div className="d-flex flex-column pl-0 rollingstock-editor-form-container">
        {selectedRollingStock ? (
          <RollingStockEditorCard
            isEditing={isEditing}
            rollingStock={selectedRollingStock}
            setIsEditing={setIsEditing}
          />
        ) : (
          <p className="align-self-center">{t('selectRollingStock')}</p>
        )}
      </div>
    </div>
  );
}
