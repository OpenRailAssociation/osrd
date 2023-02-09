import React, { useEffect, useState, useRef, useContext } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { get } from 'common/requests';
import { setFailure } from 'reducers/main';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

export default function ModalPathJSONDetail() {
  const dispatch = useDispatch();
  const { pathfindingID } = useSelector((state) => state.osrdconf);
  const [pathJSONDetail, setPathJSONDetail] = useState(undefined);
  const textareaRef = useRef(null);
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const { closeModal } = useContext(ModalContext);

  const getPathJSON = async (zoom, params) => {
    try {
      const pathJSON = await get(`/pathfinding/${pathfindingID}/`, { params });
      setPathJSONDetail(pathJSON);
    } catch (e) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrievePath'),
          message: `${e.message} : ${e.response && e.response.data.detail}`,
        })
      );
      console.log('ERROR', e);
    }
  };

  const copyToClipboard = (e) => {
    textareaRef.current.select();
    document.execCommand('copy');
    // This is just personal preference.
    // I prefer to not show the whole text area selected.
    e.target.focus();
  };

  useEffect(() => {
    if (pathfindingID) {
      getPathJSON();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathfindingID]);

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
          Copy to clipboard
        </button>
      </ModalFooterSNCF>
    </>
  );
}
