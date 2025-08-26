import { useEffect, useRef, useState } from 'react';

import { Upload } from '@osrd-project/ui-icons';
import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Loader } from 'common/Loaders/Loader';
import NavBar from 'common/NavBar';
import UploadFileModal from 'common/uploadFileModal';
import { RollingStockCard } from 'modules/rollingStock/components/RollingStockCard';
import { SearchRollingStock } from 'modules/rollingStock/components/RollingStockSelector';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import { setFailure, setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import {
  RollingStockEditorForm,
  RollingStockEditorButtons,
  RollingStockEditorFormModal,
  RollingStockInformationPanel,
} from './components';

const RollingStockEditor = () => {
  const { t } = useTranslation();
  const ref2scroll = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { openModal, closeModal } = useModal();
  const dispatch = useAppDispatch();

  const [openedRollingStockCardId, setOpenedRollingStockCardId] = useState<number>();
  const [postRollingstock] = osrdEditoastApi.endpoints.postRollingStock.useMutation();

  const { data: selectedRollingStock } =
    osrdEditoastApi.endpoints.getRollingStockByRollingStockId.useQuery(
      openedRollingStockCardId
        ? {
            rollingStockId: openedRollingStockCardId,
          }
        : skipToken
    );

  const {
    filteredRollingStockList,
    filters,
    searchRollingStock,
    toggleFilter,
    searchIsLoading,
    resetFilters,
  } = useFilterRollingStock();

  const rollingStocksList = (
    <div className="rollingstock-editor-list pr-1" data-testid="rollingstock-editor-list">
      {filteredRollingStockList.map((data) => (
        <div key={data.id}>
          <div className="rolling-stock-card-container">
            <div
              role="button"
              tabIndex={-1}
              className="d-flex align-self-start rollingstock-elements w-100 rollingstock-editor-list-cards"
              aria-label={t('rollingStock.selectRollingStock')}
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
              <RollingStockEditorButtons
                setOpenedRollingStockCardId={setOpenedRollingStockCardId}
                isCondensed
                rollingStock={selectedRollingStock}
                setIsEditing={setIsEditing}
                resetFilters={resetFilters}
                isRollingStockLocked={selectedRollingStock.locked}
              />
            )}
          </div>
          {openedRollingStockCardId === data.id && (
            <div className="d-flex flex-column pl-0 rollingstock-editor-form-container mb-3">
              {selectedRollingStock &&
                (isEditing ? (
                  <RollingStockEditorForm
                    rollingStockData={selectedRollingStock}
                    setAddOrEditState={setIsEditing}
                  />
                ) : (
                  <RollingStockInformationPanel
                    id={openedRollingStockCardId}
                    isEditing={isEditing}
                    rollingStock={selectedRollingStock}
                  />
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  function displayList() {
    if (searchIsLoading) {
      return <Loader msg={t('rollingStock.waitingLoader')} />;
    }
    if (filteredRollingStockList.length === 0) {
      return (
        <div data-testid="rollingstock-empty-result" className="rollingstock-empty">
          {t('rollingStock.resultFound', { count: 0 })}
        </div>
      );
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

  const importFile = async (file: File) => {
    closeModal();
    const failure = (error: unknown) => {
      dispatch(
        setFailure(
          castErrorToFailure(error, {
            name: t('rollingStock.messages.failure'),
          })
        )
      );
    };
    try {
      const fileContent = await file.text();
      const data = JSON.parse(fileContent);
      postRollingstock({
        locked: false,
        rollingStockForm: data,
      })
        .unwrap()
        .then((res) => {
          if (setOpenedRollingStockCardId) setOpenedRollingStockCardId(res.id);
          dispatch(
            setSuccess({
              title: t('rollingStock.messages.success'),
              text: t('rollingStock.messages.rollingStockAdded'),
            })
          );
        })
        .catch((error) => {
          console.error('Error posting rolling stock:', error);
          failure(error);
        });
    } catch (error) {
      console.error('Error reading file:', error);
      failure(error);
    }
  };

  return (
    <>
      <NavBar appName={<>{t('rollingStockEditor')}</>} />
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
                    mainText={t('common.leaveEditionMode')}
                    request={() => {
                      setIsAdding(false);
                      setIsEditing(false);
                    }}
                    buttonText={t('common.confirm')}
                  />
                );
              }}
            >
              <span>{t('rollingStock.listDisabled')}</span>
            </div>
          )}
          <div className="d-flex items-center mb-4 w-100 rollingstock-editor-actions">
            <button
              type="button"
              className="btn btn-primary"
              data-testid="new-rollingstock-button"
              onClick={() => {
                setIsAdding(true);
                setOpenedRollingStockCardId(undefined);
              }}
            >
              {t('rollingStock.addNewRollingStock')}
            </button>
            <button
              type="button"
              className="d-flex justify-content-start mb-2 py-1 px-2"
              aria-label={t('rollingStock.importRollingStock')}
              title={t('rollingStock.importRollingStock')}
              onClick={() => {
                openModal(<UploadFileModal handleSubmit={importFile} />);
              }}
            >
              <Upload className="mr-2" />
              {t('rollingStock.importRollingStock')}
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
            filteredRollingStockList={filteredRollingStockList}
            filters={filters}
            searchRollingStock={searchRollingStock}
            toggleFilter={toggleFilter}
            hasWhiteBackground
          />
          {displayList()}
        </div>
        {!openedRollingStockCardId && !isAdding && (
          <p className="rollingstock-editor-unselected pt-1 px-5">
            {t('rollingStock.chooseRollingStock')}
          </p>
        )}
      </div>
    </>
  );
};

const RollingStockEditorWrapper = () => (
  <ModalProvider>
    <RollingStockEditor />
  </ModalProvider>
);

export default RollingStockEditorWrapper;
