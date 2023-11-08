import React, { useEffect, useRef, useState } from 'react';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useTranslation } from 'react-i18next';
import { Loader } from 'common/Loaders/Loader';
import { RollingStockCard } from 'modules/rollingStock/components/RollingStockCard';
import RollingStockEditorButtons from 'modules/rollingStock/components/RollingStockEditor/RollingStockEditorButtons';
import RollingStockEditorForm from 'modules/rollingStock/components/RollingStockEditor';
import RollingStockEditorFormModal from 'modules/rollingStock/components/RollingStockEditor/RollingStockEditorFormModal';
import RollingStockInformationPanel from 'modules/rollingStock/components/RollingStockEditor/RollingStockInformationPanel';
import { SearchRollingStock } from 'modules/rollingStock/components/RollingStockSelector';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';

type RollingStockEditorProps = {
  rollingStocks: LightRollingStockWithLiveries[];
};

export default function RollingStockEditor({ rollingStocks }: RollingStockEditorProps) {
  const { t } = useTranslation('rollingstock');
  const ref2scroll: React.RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
  const [filteredRollingStockList, setFilteredRollingStockList] = useState(rollingStocks);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const { openModal } = useModal();

  const [openedRollingStockCardId, setOpenedRollingStockCardId] = useState<number>();

  const { data: selectedRollingStock } =
    osrdEditoastApi.endpoints.getRollingStockByRollingStockId.useQuery(
      {
        rollingStockId: openedRollingStockCardId as number,
      },
      {
        skip: !openedRollingStockCardId,
      }
    );

  useEffect(() => setFilteredRollingStockList(rollingStocks), []);

  const rollingStocksList = (
    <div className="rollingstock-editor-list pr-1" data-testid="rollingstock-editor-list">
      {filteredRollingStockList.map((data) => (
        <div key={data.id}>
          <div className="d-flex">
            <div
              role="button"
              tabIndex={-1}
              className="d-flex align-self-start rollingstock-elements w-100 rollingstock-editor-list-cards"
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
                ref2scroll={openedRollingStockCardId === data.id ? ref2scroll : undefined}
              />
            </div>
            {data.id === openedRollingStockCardId && selectedRollingStock && (
              <div className="align-self-start">
                <RollingStockEditorButtons
                  setOpenedRollingStockCardId={setOpenedRollingStockCardId}
                  isCondensed
                  rollingStock={selectedRollingStock}
                  setIsEditing={setIsEditing}
                  setIsDuplicating={setIsDuplicating}
                  isRollingStockLocked={selectedRollingStock.locked as boolean}
                />
              </div>
            )}
          </div>
          {openedRollingStockCardId === data.id && (
            <div className="d-flex flex-column pl-0 rollingstock-editor-form-container mb-3">
              {(selectedRollingStock || isEditing) &&
                ((selectedRollingStock && !isEditing && (
                  <RollingStockInformationPanel
                    id={openedRollingStockCardId}
                    isEditing={isEditing}
                    rollingStock={selectedRollingStock}
                  />
                )) ||
                  (isEditing && (
                    <RollingStockEditorForm
                      rollingStockData={selectedRollingStock}
                      setAddOrEditState={setIsEditing}
                    />
                  )))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  function displayList() {
    if (isLoading) {
      return <Loader msg={t('waitingLoader')} />;
    }
    if (filteredRollingStockList.length === 0) {
      return <div className="rollingstock-empty">{t('rollingstock:noResultFound')}</div>;
    }
    return rollingStocksList;
  }

  // depending on the current key of ref2scroll, scroll to the selected rolling stock card when it is opened with scrollIntoView()
  // scrollBy() is used to ensure that the card will be found even if the list is too long
  useEffect(() => {
    if (openedRollingStockCardId !== undefined) {
      setTimeout(() => {
        ref2scroll.current?.scrollIntoView({
          behavior: 'smooth',
        });
        window.scrollBy(0, -500);
      }, 1000);
    }
  }, [ref2scroll.current]);

  return (
    <div className="d-flex rollingstock-editor">
      <div className="d-flex ml-4 flex-column rollingstock-editor-left-container">
        {(isEditing || isAdding) && (
          <div
            className="rollingstock-editor-disablelist"
            role="button"
            tabIndex={0}
            onClick={() => {
              openModal(
                <RollingStockEditorFormModal
                  mainText={t('translation:common.leaveEditionMode')}
                  request={() => {
                    setIsAdding(false);
                    setIsEditing(false);
                  }}
                  buttonText={t('translation:common.confirm')}
                />
              );
            }}
          >
            <span>{t('listDisabled')}</span>
          </div>
        )}
        <div className="d-flex justify-content-center w-100">
          <button
            type="button"
            className="btn btn-primary mb-4"
            data-testid="new-rollingstock-button"
            onClick={() => {
              setIsAdding(true);
              setOpenedRollingStockCardId(undefined);
            }}
          >
            {t('addNewRollingStock')}
          </button>
        </div>
        {isAdding && (
          <div className="d-flex flex-column pl-0 rollingstock-editor-form-container mb-3">
            <RollingStockEditorForm
              isAdding={isAdding}
              setAddOrEditState={setIsAdding}
              setOpenedRollingStockCardId={setOpenedRollingStockCardId}
            />
          </div>
        )}
        <SearchRollingStock
          rollingStocks={rollingStocks}
          setFilteredRollingStockList={setFilteredRollingStockList}
          filteredRollingStockList={filteredRollingStockList}
          setIsLoading={setIsLoading}
          mustResetFilters={isDuplicating}
          setMustResetFilters={setIsDuplicating}
          hasWhiteBackground
        />
        {displayList()}
      </div>
      {!openedRollingStockCardId && !isAdding && (
        <p className="rollingstock-editor-unselected pt-1 px-5">{t('chooseRollingStock')}</p>
      )}
    </div>
  );
}
