import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { get } from 'common/requests';
import { setFailure } from 'reducers/main';

function LoaderPathfindingInProgress() {
  return (
    <div className="loaderPathfindingInProgress">
      <div className="spinner-border" role="status">
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

export default function ModalPathJSONDetail(props) {
  const dispatch = useDispatch();
  const { pathfindingID } = useSelector((state) => state.osrdconf);
  const [pathJSONDetail, setPathJSONDetail] = useState(undefined);
  const textareaRef = useRef(null);
  const { pathfindingInProgress } = props;
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');

  const getPathJSON = async (zoom, params) => {
    try {
      const pathJSON = await get(`/pathfinding/${pathfindingID}/`, params, {}, true);
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
  }, [pathfindingID]);

  return (
    <ModalSNCF htmlID="modalPathJSONDetail" size="xl">
      <ModalHeaderSNCF>
        <h1>{`PathFinding n°${pathfindingID}`}</h1>
        <button className="btn btn-only-icon close" type="button" data-dismiss="modal">
          <i className="icons-close" />
        </button>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        {pathfindingInProgress && <LoaderPathfindingInProgress />}
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
    </ModalSNCF>
  );
}

ModalPathJSONDetail.propTypes = {
  pathfindingInProgress: PropTypes.bool.isRequired,
};
