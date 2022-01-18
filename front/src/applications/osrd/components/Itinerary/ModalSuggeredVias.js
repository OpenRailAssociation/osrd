import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { FaLongArrowAltUp, FaLongArrowAltDown, FaTrash } from 'react-icons/fa';

const LoaderPathfindingInProgress = () => (
  <div className="loaderPathfindingInProgress">
    <div className="spinner-border" role="status">
      <span className="sr-only">Loading...</span>
    </div>
  </div>
);

export default function ModalSugerredVias(props) {
  const { suggeredVias } = useSelector((state) => state.osrdconf);
  const {
    convertPathfindingVias, inverseOD, removeAllVias, pathfindingInProgress,
  } = props;
  const dispatch = useDispatch();
  const { t } = useTranslation('osrdconf');
  const nbVias = suggeredVias.length - 1;

  const formatVia = (via, idx, idxTrueVia) => (
    <div className={`d-flex align-items-center p-1 ${via.suggestion && 'suggerred-via-clickable'}`}>
      {!via.suggestion && <small className="pr-2">{idxTrueVia}</small>}
      <i className={`${via.suggestion ? 'text-muted' : 'text-info'} icons-itinerary-bullet mr-2`} />
      {via.name || `KM ${Math.round(via.position) / 1000}`}
      {via.suggestion && (
        <button
          className="btn btn-sm btn-only-icon ml-auto"
          type="button"
          onClick={() => convertPathfindingVias(suggeredVias, dispatch, idx)}
        >
          <i className="icons-add" />
        </button>
      )}
    </div>
  );

  let idxTrueVia = 0;
  return (
    <ModalSNCF htmlID="suggeredViasModal">
      <ModalHeaderSNCF>
        <h1>{t('manageVias')}</h1>
        <button className="btn btn-only-icon close" type="button" data-dismiss="modal">
          <i className="icons-close" />
        </button>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="suggered-vias">
          {pathfindingInProgress && <LoaderPathfindingInProgress />}
          {suggeredVias.map((via, idx) => {
            if (idx !== 0 && idx !== nbVias) {
              if (!via.suggestion) idxTrueVia += 1;
              return formatVia(via, idx, idxTrueVia);
            }
            return null;
          })}
        </div>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="row">
          <div className="col-12">
            <button className="btn btn-danger btn-sm btn-block mb-1" type="button" onClick={removeAllVias}>
              <FaTrash />
              <span className="ml-2">{t('deleteVias')}</span>
            </button>
          </div>
          <div className="col-12">
            <button className="btn btn-warning btn-sm btn-block" type="button" onClick={inverseOD}>
              <FaLongArrowAltUp />
              <FaLongArrowAltDown />
              <span className="ml-2">{t('inverseOD')}</span>
            </button>
          </div>
        </div>
      </ModalFooterSNCF>
    </ModalSNCF>
  );
}

ModalSugerredVias.propTypes = {
  convertPathfindingVias: PropTypes.func.isRequired,
  inverseOD: PropTypes.func.isRequired,
  removeAllVias: PropTypes.func.isRequired,
  pathfindingInProgress: PropTypes.bool.isRequired,
};
