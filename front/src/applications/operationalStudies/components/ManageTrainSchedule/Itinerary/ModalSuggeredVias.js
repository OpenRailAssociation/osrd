import React, { useContext } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import { FaLongArrowAltUp, FaLongArrowAltDown, FaTrash, FaMinus } from 'react-icons/fa';

import { adjustPointOnTrack } from 'utils/pathfinding';

import { replaceVias } from 'reducers/osrdconf';
import { getMapTrackSources } from 'reducers/map/selectors';
import { getSuggeredVias, getVias } from 'reducers/osrdconf/selectors';

import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Spinner } from 'common/Loader';

function LoaderPathfindingInProgress() {
  return <Spinner className="loaderPathfindingInProgress" />;
}

export default function ModalSugerredVias(props) {
  const dispatch = useDispatch();
  const suggeredVias = useSelector(getSuggeredVias);
  const vias = useSelector(getVias);
  const mapTrackSources = useSelector(getMapTrackSources);

  const { inverseOD, removeAllVias, removeViaFromPath, pathfindingInProgress } = props;
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const nbVias = suggeredVias.length - 1;
  const selectedViasTracks = vias.map((via) => via.position);
  const { closeModal } = useContext(ModalContext);

  const convertPathfindingVias = (steps, idxToAdd) => {
    const newVias = steps.slice(1, -1).flatMap((step, idx) => {
      if (!step.suggestion || idxToAdd === idx) {
        return [adjustPointOnTrack(step, step, mapTrackSources, step.position)];
      }
      return [];
    });

    dispatch(replaceVias(newVias));
  };

  const formatVia = (via, idx, idxTrueVia) => (
    <div
      key={nextId()}
      className={`d-flex align-items-center p-1 ${via.suggestion && 'suggerred-via-clickable'}`}
    >
      {!via.suggestion && <small className="pr-2">{idxTrueVia}</small>}
      <i className={`${via.suggestion ? 'text-muted' : 'text-info'} icons-itinerary-bullet mr-2`} />
      {via.name || `KM ${Math.round(via.position) / 1000}`}
      {via.suggestion && !selectedViasTracks.includes(via.position) ? (
        <button
          className="btn btn-sm btn-only-icon ml-auto"
          type="button"
          onClick={() => convertPathfindingVias(suggeredVias, idx)}
        >
          <i className="icons-add" />
        </button>
      ) : (
        <button
          className="btn btn-sm btn-only-icon ml-auto bg-dark"
          type="button"
          onClick={() => removeViaFromPath(via)}
        >
          <FaMinus color="white" />
        </button>
      )}
    </div>
  );

  let idxTrueVia = 0;
  return (
    <>
      <ModalHeaderSNCF>
        <h1>{`${t('manageVias')} ${vias.length > 0 ? `(${vias.length})` : ''}`}</h1>
        <button className="btn btn-only-icon close" type="button" onClick={closeModal}>
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
            <button
              className="btn btn-danger btn-sm btn-block mb-1"
              type="button"
              onClick={removeAllVias}
            >
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
    </>
  );
}

ModalSugerredVias.propTypes = {
  inverseOD: PropTypes.func.isRequired,
  removeAllVias: PropTypes.func.isRequired,
  removeViaFromPath: PropTypes.func.isRequired,
  pathfindingInProgress: PropTypes.bool.isRequired,
};
