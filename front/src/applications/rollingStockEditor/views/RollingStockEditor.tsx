import React, { useRef, useState } from 'react';

import RollingStockCard from 'common/RollingStockSelector/RollingStockCard';
import { useSelector } from 'react-redux';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import Loader from 'common/Loader';
import { useTranslation } from 'react-i18next';
import { LightRollingStock } from 'common/api/osrdEditoastApi';
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

  const selectedRollingStock = rollingStocks.find((rs) => rs.id === openedRollingStockCardId);

  return (
    <div className="d-flex pt-5 mt-5">
      <div className="d-flex ml-4 flex-column" style={{ width: '37%' }}>
        {rollingStocks.length > 0 ? (
          rollingStocks.map((data) => (
            <div className="d-flex rollingstock-editor-list" key={data.id}>
              <div
                role="button"
                tabIndex={0}
                className="align-self-start rollingstock-elements"
                onClick={() => setIsEditing(false)}
                style={{ width: '92%' }}
              >
                <RollingStockCard
                  isOnEditMode
                  data={data}
                  key={data.id}
                  noCardSelected={openedRollingStockCardId === undefined}
                  isOpen={data.id === openedRollingStockCardId}
                  setOpenedRollingStockCardId={setOpenedRollingStockCardId}
                  ref2scroll={rollingStockID === data.id ? ref2scroll : undefined}
                />
              </div>
              {data.id === openedRollingStockCardId && (
                <div className="align-self-start">
                  <RollingStockEditorButtons isCondensed setIsEditing={setIsEditing} />
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
            data={selectedRollingStock}
            setIsEditing={setIsEditing}
          />
        ) : (
          <p className="align-self-center">{t('selectRollingStock')}</p>
        )}
      </div>
    </div>
  );
}
