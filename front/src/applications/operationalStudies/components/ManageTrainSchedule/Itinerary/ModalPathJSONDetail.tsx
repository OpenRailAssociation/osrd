import React, { useEffect, useContext } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { setFailure } from 'reducers/main';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { getPathfindingID } from 'reducers/osrdconf/selectors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { ApiError } from 'common/api/emptyApi';
import { SerializedError } from '@reduxjs/toolkit';

export default function ModalPathJSONDetail() {
  const dispatch = useDispatch();
  const pathfindingID = useSelector(getPathfindingID);
  const textareaId = 'text-area-id';
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const { closeModal } = useContext(ModalContext);

  const {
    data: path,
    isError,
    error,
  } = osrdEditoastApi.useGetPathfindingByIdQuery(
    { id: pathfindingID as number },
    {
      skip: !pathfindingID,
    }
  );

  useEffect(() => {
    if (isError && error) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrievePath'),
          message: `${(error as ApiError).data.message || (error as SerializedError).message}`,
        })
      );
    }
  }, [isError]);

  const copyToClipboard = () => {
    const textArea = document.getElementById(textareaId);
    if (textArea) {
      (textArea as HTMLTextAreaElement).select();
      document.execCommand('copy');
      // This is just personal preference.
      // I prefer to not show the whole text area selected.
    }
  };

  return (
    <>
      <ModalHeaderSNCF>
        <h1>{`PathFinding n°${pathfindingID}`}</h1>
        <button className="btn btn-only-icon close" type="button" onClick={closeModal}>
          <i className="icons-close" />
        </button>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="form-control-container" style={{ maxHeight: '50vh' }}>
          <textarea
            className="form-control stretchy"
            id={textareaId}
            value={JSON.stringify(path, null, 2)}
            style={{ maxHeight: '50vh' }}
          />
        </div>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <button className="btn btn-primary" type="button" onClick={copyToClipboard}>
          Copy to clipboard
        </button>
      </ModalFooterSNCF>
    </>
  );
}
