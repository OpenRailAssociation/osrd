import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import { get } from 'common/requests.ts';
import { setFailure } from 'reducers/main.ts';

const LoaderPathfindingInProgress = () => (
  <div className="loaderPathfindingInProgress">
    <div className="spinner-border" role="status">
      <span className="sr-only">Loading...</span>
    </div>
  </div>
);

export default function ModalPathJSONDetail(props) {
  const dispatch = useDispatch();
  const { pathfindingID } = useSelector((state) => state.osrdconf);
  const [pathJSONDetail, setPathJSONDetail] = useState(undefined);
  const { pathfindingInProgress } = props;
  const { t } = useTranslation('osrdconf');

  const getPathJSON = async (zoom, params) => {
    try {
      const pathJSON = await get(`/pathfinding/${pathfindingID}/`, params, {}, true);
      setPathJSONDetail(pathJSON);
      console.log(pathJSON);
    } catch (e) {
      dispatch(setFailure({
        name: t('errorMessages.unableToRetrievePath'),
        message: `${e.message} : ${e.response && e.response.data.detail}`,
      }));
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    getPathJSON();
  }, []);

  return (
    <ModalSNCF htmlID="modalPathJSONDetail">
      <ModalHeaderSNCF>
        <h1>{`PathFinding n°${pathfindingID}`}</h1>
        <button className="btn btn-only-icon close" type="button" data-dismiss="modal">
          <i className="icons-close" />
        </button>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="suggered-vias">
          {pathfindingInProgress && <LoaderPathfindingInProgress />}
          <code>
            Coucou
          </code>
        </div>
      </ModalBodySNCF>
    </ModalSNCF>
  );
}

ModalPathJSONDetail.propTypes = {
  pathfindingInProgress: PropTypes.bool.isRequired,
};
