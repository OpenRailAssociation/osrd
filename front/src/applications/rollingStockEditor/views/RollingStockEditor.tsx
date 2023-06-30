import React, { useRef, useState } from 'react';

import RollingStockCard from 'common/RollingStockSelector/RollingStockCard';
import { useSelector } from 'react-redux';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import Loader from 'common/Loader';
import { useTranslation } from 'react-i18next';
import { LightRollingStock } from 'common/api/osrdEditoastApi';
import SearchRollingStock from 'common/RollingStockSelector/SearchRollingStock';
import { isEmpty } from 'lodash';
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
  const [filteredRollingStockList, setFilteredRollingStockList] =
    useState<LightRollingStock[]>(rollingStocks);
  const [isLoading, setIsLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const [openedRollingStockCardId, setOpenedRollingStockCardId] = useState<number>();

  const selectedRollingStock = rollingStocks.find((rs) => rs.id === openedRollingStockCardId);

  const listOfRollingStocks = (
    <div className="rollingstock-editor-list pr-1">
      {filteredRollingStockList.length > 0 &&
        filteredRollingStockList.map((data) => (
          <div key={data.id}>
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
        ))}
    </div>
  );

  function displayList() {
    if (isEmpty(filteredRollingStockList)) {
      if (isLoading) {
        return <Loader msg={t('waitingLoader')} />;
      }
      return <div className="rollingstock-empty mx-auto">{t('noResultFound')}</div>;
    }
    return listOfRollingStocks;
  }

  return (
    <div className="d-flex rollingstock-editor">
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
        <SearchRollingStock
          rollingStocks={rollingStocks}
          rollingStockID={openedRollingStockCardId}
          setOpenedRollingStockCardId={setOpenedRollingStockCardId}
          setFilteredRollingStockList={setFilteredRollingStockList}
          filteredRollingStockList={filteredRollingStockList}
          setIsLoading={setIsLoading}
        />
        {displayList()}
        {isAdding && (
          <div className="d-flex flex-column pl-0 rollingstock-editor-form-container mb-3">
            <RollingStockEditorForm
              isAdding={isAdding}
              setIsEditing={setIsEditing}
              setIsAdding={setIsAdding}
            />
          </div>
        )}
      </div>
      {!selectedRollingStock && (
        <p className="rollingstock-editor-unselected px-5">{t('selectRollingStock')}</p>
      )}
    </div>
  );
}
