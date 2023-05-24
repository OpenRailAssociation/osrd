import React, { useEffect, useState, useRef, useContext } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { setFailure } from 'reducers/main';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { getPathfindingID } from 'reducers/osrdconf/selectors';

export default function ModalPathJSONDetail() {
  const dispatch = useDispatch();
  const pathfindingID = useSelector(getPathfindingID);
  const [pathJSONDetail, setPathJSONDetail] = useState<object>({ undefined });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { closeModal } = useContext(ModalContext);
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');

  const pathJSON = osrdMiddlewareApi.useGetPathfindingByIdQuery({
    id: pathfindingID as number,
  });

  async function getPathJSON() {
    try {
      await pathJSON;
      setPathJSONDetail(pathJSON);
    } catch (e: unknown) {
      const err = e as Error;
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrievePath'),
          message: `${err.message}`,
        })
      );
    }
  }

  const copyToClipboard = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (textareaRef.current) {
      textareaRef.current.select();
      document.execCommand('copy');
      // This is just personal preference.
      // I prefer to not show the whole text area selected.
      e.currentTarget.focus();
    }
  };

  useEffect(() => {
    if (pathfindingID) {
      getPathJSON();
    }
  }, [pathfindingID, pathJSON]);

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
            ref={textareaRef}
            value={JSON.stringify(pathJSONDetail, null, 2)}
            style={{ maxHeight: '50vh' }}
          />
        </div>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <button className="btn btn-primary" type="button" onClick={copyToClipboard}>
          {t('copy')}
        </button>
      </ModalFooterSNCF>
    </>
  );
}
