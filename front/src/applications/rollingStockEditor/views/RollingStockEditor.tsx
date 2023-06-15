import React, { useRef, useState } from 'react';

import RollingStockCard from 'common/RollingStockSelector/RollingStockCard';
import { useSelector } from 'react-redux';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import Loader from 'common/Loader';
import { useTranslation } from 'react-i18next';
import { LightRollingStock } from 'common/api/osrdEditoastApi';
import RollingStockEditorButtons from '../components/RollingStockEditorButtons';
import RollingStockEditorCard from '../components/RollingStockEditorCard';
import RollingStockEditorForm from '../components/RollingStockEditorForm';

type RollingStockEditorProps = {
  rollingStocks: LightRollingStock[];
};

export default function RollingStockEditor({ rollingStocks }: RollingStockEditorProps) {
  const { t } = useTranslation('rollingStockEditor');
  const ref2scroll: React.RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
  const rollingStockID = useSelector(getRollingStockID);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const [openedRollingStockCardId, setOpenedRollingStockCardId] = useState<number>();

  const selectedRollingStock = rollingStocks.find((rs) => rs.id === openedRollingStockCardId);

  return (
    <div className="d-flex pt-5 mt-5">
      <div className="d-flex ml-4 flex-column rollingstock-editor-left-container">
        <div className="d-flex justify-content-center w-100">
          <button
            type="button"
            className="btn btn-primary mb-4"
            onClick={() => {
              setIsAdding(true);
              setIsEditing(true);
              setOpenedRollingStockCardId(0);
            }}
          >
            {t('addNewRollingStock')}
          </button>
        </div>
        {isAdding && (
          <div className="d-flex flex-column pl-0 rollingstock-editor-form-container mb-3">
            <RollingStockEditorForm
              isAdding={isAdding}
              setIsEditing={setIsEditing}
              setIsAdding={setIsAdding}
            />
          </div>
        )}
        {rollingStocks.length > 0 ? (
          rollingStocks.map((data) => (
            <div className="rollingstock-editor-list" key={data.id}>
              <div className="d-flex">
                <div
                  role="button"
                  tabIndex={-1}
                  className="d-flex align-self-start rollingstock-elements w-100"
                  onClick={() => {
                    setIsEditing(false);
                    setIsAdding(false);
                  }}
                >
                  <RollingStockCard
                    isOnEditMode
                    rollingStock={data}
                    noCardSelected={openedRollingStockCardId === undefined}
                    isOpen={data.id === openedRollingStockCardId}
                    setOpenedRollingStockCardId={setOpenedRollingStockCardId}
                    ref2scroll={rollingStockID === data.id ? ref2scroll : undefined}
                  />
                </div>
                {data.id === openedRollingStockCardId && (
                  <div className="align-self-start">
                    <RollingStockEditorButtons
                      isCondensed
                      rollingStock={data}
                      setIsEditing={setIsEditing}
                      isRollingStockLocked={data.locked as boolean}
                    />
                  </div>
                )}
              </div>
              {openedRollingStockCardId === data.id && (
                <div className="d-flex flex-column pl-0 rollingstock-editor-form-container mb-3">
                  {(selectedRollingStock || isEditing) &&
                    ((selectedRollingStock && !isEditing && (
                      <RollingStockEditorCard
                        isEditing={isEditing}
                        data={selectedRollingStock}
                        setIsEditing={setIsEditing}
                      />
                    )) ||
                      (isEditing && (
                        <RollingStockEditorForm
                          rollingStockData={selectedRollingStock}
                          setIsEditing={setIsEditing}
                          setIsAdding={setIsAdding}
                        />
                      )))}
                </div>
              )}
            </div>
          ))
        ) : (
          <Loader msg={t('rollingstock:waitingLoader')} />
        )}
      </div>
      {!selectedRollingStock && (
        <p className="rollingstock-editor-unselected px-5">{t('selectRollingStock')}</p>
      )}
    </div>
  );
}
