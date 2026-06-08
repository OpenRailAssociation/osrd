import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Upload } from '@osrd-project/ui-icons';
import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { LoaderFill } from 'common/Loaders';
import NavBar from 'common/NavBar';
import UploadFileModal from 'common/uploadFileModal';
import { SearchRollingStock } from 'modules/rollingStock/components/RollingStockSelector';
import useFilterRollingStock from 'modules/rollingStock/hooks/useFilterRollingStock';
import { setFailure, setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import {
  RollingStockEditorForm,
  RollingStockEditorFormModal,
  RollingStockInformationPanel,
} from './components';
import { RollingStockEditorList } from './components/RollingStockEditorList';

export type PageMode =
  | { type: 'idle' }
  | { type: 'create' }
  | { type: 'view'; rollingStockId: number }
  | { type: 'edit'; rollingStockId: number };

const RollingStockEditor = () => {
  const { t } = useTranslation();
  const ref2scroll = useRef<HTMLInputElement>(null);
  const { openModal, closeModal } = useModal();
  const dispatch = useAppDispatch();
  const [pageMode, setPageMode] = useState<PageMode>({ type: 'idle' });
  const selectedRollingStockId = useMemo(() => {
    if (pageMode.type === 'view' || pageMode.type === 'edit') return pageMode.rollingStockId;
    return undefined;
  }, [pageMode]);

  const [postRollingstock] = osrdEditoastApi.endpoints.postRollingStock.useMutation();

  const { data: selectedRollingStock, isFetching: isSelectedRollingStockLoading } =
    osrdEditoastApi.endpoints.getRollingStockByRollingStockId.useQuery(
      pageMode.type === 'view' || pageMode.type === 'edit'
        ? {
            rollingStockId: pageMode.rollingStockId,
          }
        : skipToken
    );

  const {
    filteredRollingStockList,
    filters,
    searchRollingStock,
    toggleFilter,
    selectCategoryFilter,
    searchIsLoading,
    resetFilters,
  } = useFilterRollingStock();

  // depending on the current key of ref2scroll, scroll to the selected rolling stock card when it is opened with scrollIntoView()
  // scrollBy() is used to ensure that the card will be found even if the list is too long
  useEffect(() => {
    if (selectedRollingStockId !== undefined) {
      setTimeout(() => {
        ref2scroll.current?.scrollIntoView({
          behavior: 'smooth',
        });
        window.scrollBy(0, -500);
      }, 1000);
    }
  }, [ref2scroll.current]);

  const importFile = useCallback(
    async (file: File) => {
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
            setPageMode({ type: 'view', rollingStockId: res.id });
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
    },
    [closeModal, dispatch, t]
  );

  const openUploadFileModal = useCallback(() => {
    openModal(<UploadFileModal handleSubmit={importFile} />);
  }, [openModal, importFile]);

  const openRollingStockEditorFormModal = useCallback(() => {
    openModal(
      <RollingStockEditorFormModal
        mainText={t('common.leaveEditionMode')}
        onSubmit={() => setPageMode({ type: 'idle' })}
        buttonText={t('common.confirm')}
      />
    );
  }, [openModal, setPageMode]);

  return (
    <>
      <NavBar appName={<>{t('applications.rolling-stocks-editor')}</>} />
      <div className="d-flex rollingstock-editor">
        {/*  Aside */}
        <div className="d-flex ml-4 flex-column rollingstock-editor-left-container">
          {/* Overlay to disable the list while editing */}
          {(pageMode.type === 'create' || pageMode.type === 'edit') && (
            <div
              className="rollingstock-editor-disablelist"
              role="button"
              tabIndex={0}
              onClick={openRollingStockEditorFormModal}
            >
              <span>{t('rollingStock.listDisabled')}</span>
            </div>
          )}

          <div className="d-flex items-center mb-4 w-100 rollingstock-editor-actions">
            <button
              type="button"
              className="btn btn-primary"
              data-testid="new-rollingstock-button"
              onClick={() => setPageMode({ type: 'create' })}
            >
              {t('rollingStock.addNewRollingStock')}
            </button>
            <button
              type="button"
              className="d-flex justify-content-start mb-2 py-1 px-2"
              aria-label={t('rollingStock.importRollingStock')}
              title={t('rollingStock.importRollingStock')}
              onClick={openUploadFileModal}
            >
              <Upload className="mr-2" />
              {t('rollingStock.importRollingStock')}
            </button>
          </div>

          <SearchRollingStock
            filteredRollingStockList={filteredRollingStockList}
            filters={filters}
            searchRollingStock={searchRollingStock}
            toggleFilter={toggleFilter}
            selectCategoryFilter={selectCategoryFilter}
            hasWhiteBackground
          />
          <RollingStockEditorList
            isLoading={searchIsLoading}
            pageMode={pageMode}
            setPageMode={setPageMode}
            resetFilters={resetFilters}
            data={filteredRollingStockList}
            selectedRollingStock={selectedRollingStock}
            ref2scroll={ref2scroll}
          />
        </div>

        {/* Main  */}
        <div className="d-flex flex-column pl-0 rollingstock-editor-form-container mb-3">
          {/* Create */}
          {pageMode.type === 'create' && <RollingStockEditorForm setPageMode={setPageMode} />}
          {/* Edit */}
          {pageMode.type === 'edit' && (
            <>
              {selectedRollingStock && (
                <RollingStockEditorForm
                  rollingStockData={selectedRollingStock}
                  setPageMode={setPageMode}
                />
              )}
              {isSelectedRollingStockLoading && <LoaderFill />}
            </>
          )}
          {/* View */}
          {pageMode.type === 'view' && (
            <>
              {isSelectedRollingStockLoading && <LoaderFill />}
              {selectedRollingStock && (
                <RollingStockInformationPanel
                  id={pageMode.rollingStockId}
                  rollingStock={selectedRollingStock}
                />
              )}
            </>
          )}
          {/* Empty placeholder */}
          {pageMode.type === 'idle' && (
            <p className="rollingstock-editor-unselected pt-1 px-5">
              {t('rollingStock.chooseRollingStock')}
            </p>
          )}
        </div>
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
