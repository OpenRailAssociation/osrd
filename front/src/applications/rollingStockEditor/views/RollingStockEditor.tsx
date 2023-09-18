import React, { useEffect, useRef, useState } from 'react';

import {
  RollingStockCard,
  SearchRollingStock,
} from 'modules/rollingStock/components/RollingStockSelector';
import { useDispatch } from 'react-redux';
import Loader from 'common/Loader';
import { useTranslation } from 'react-i18next';
import { LightRollingStock, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { isEmpty } from 'lodash';
import RollingStockEditorButtons from 'modules/rollingStock/components/rollingStockEditor/RollingStockEditorButtons';
import RollingStockEditorCard from 'modules/rollingStock/components/rollingStockEditor/RollingStockEditorCard';
import RollingStockEditorForm from 'modules/rollingStock/components/rollingStockEditor/RollingStockEditorForm';
import { STANDARD_COMFORT_LEVEL } from 'modules/rollingStock/consts';
import {
  updateComfortLvl,
  updateTractionMode,
  updateElectricalProfile,
  updatePowerRestriction,
} from 'reducers/rollingstockEditor';
import RollingStockEditorFormModal from 'modules/rollingStock/components/rollingStockEditor/RollingStockEditorFormModal';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';

type RollingStockEditorProps = {
  rollingStocks: LightRollingStock[];
};

export default function RollingStockEditor({ rollingStocks }: RollingStockEditorProps) {
  const { t } = useTranslation('rollingstock');
  const ref2scroll: React.RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
  const [filteredRollingStockList, setFilteredRollingStockList] = useState(rollingStocks);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const dispatch = useDispatch();
  const { openModal } = useModal();

  const [openedRollingStockCardId, setOpenedRollingStockCardId] = useState<number>();

  const { data: selectedRollingStock } = osrdEditoastApi.useGetRollingStockByIdQuery(
    {
      id: openedRollingStockCardId as number,
    },
    {
      skip: !openedRollingStockCardId,
    }
  );

  const resetRollingstockCurvesParams = () => {
    dispatch(updateComfortLvl(STANDARD_COMFORT_LEVEL));
    dispatch(updateTractionMode(''));
    dispatch(updateElectricalProfile(null));
    dispatch(updatePowerRestriction(null));
  };

  useEffect(() => setFilteredRollingStockList(rollingStocks), []);

  const listOfRollingStocks = (
    <div className="rollingstock-editor-list pr-1">
      {filteredRollingStockList.length > 0 &&
        filteredRollingStockList.map((data) => (
          <div key={data.id}>
            <div className="d-flex">
              <div
                role="button"
                tabIndex={-1}
                className="d-flex align-self-start rollingstock-elements w-100 rollingstock-editor-list-cards"
                onClick={() => {
                  setIsEditing(false);
                  setIsAdding(false);
                  resetRollingstockCurvesParams();
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
                    <RollingStockEditorCard
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
    if (isEmpty(filteredRollingStockList)) {
      if (isLoading) {
        return <Loader msg={t('waitingLoader')} />;
      }
      return <div className="rollingstock-empty mx-auto">{t('noResultFound')}</div>;
    }
    return listOfRollingStocks;
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
                  mainText={t('leaveEditionMode')}
                  request={() => {
                    setIsAdding(false);
                    setIsEditing(false);
                    resetRollingstockCurvesParams();
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
        />
        {displayList()}
      </div>
      {!openedRollingStockCardId && !isAdding && (
        <p className="rollingstock-editor-unselected pt-1 px-5">{t('chooseRollingStock')}</p>
      )}
    </div>
  );
}
