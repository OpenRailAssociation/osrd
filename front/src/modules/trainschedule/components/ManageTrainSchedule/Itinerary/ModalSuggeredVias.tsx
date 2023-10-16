import React, { useContext } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { FaLongArrowAltUp, FaLongArrowAltDown, FaTrash, FaMinus } from 'react-icons/fa';

import { replaceVias } from 'reducers/osrdconf';
import { getSuggeredVias, getVias } from 'reducers/osrdconf/selectors';

import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Spinner } from 'common/Loader';
import { ArrayElement } from 'utils/types';
import { Path } from 'common/api/osrdEditoastApi';

type Props = {
  inverseOD: () => void;
  removeAllVias: () => void;
  pathfindingInProgress?: boolean;
};

function LoaderPathfindingInProgress() {
  return <Spinner className="loaderPathfindingInProgress" />;
}

export default function ModalSugerredVias({
  inverseOD,
  removeAllVias,
  pathfindingInProgress,
}: Props) {
  const dispatch = useDispatch();
  const suggeredVias = useSelector(getSuggeredVias);
  const vias = useSelector(getVias);

  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const nbVias = suggeredVias ? suggeredVias.length - 1 : 0;
  const selectedViasTracks = vias.map((via) => via.id);
  const { closeModal } = useContext(ModalContext);

  const removeViaFromPath = (step: ArrayElement<Path['steps']>) => {
    dispatch(
      replaceVias(
        vias.filter(
          (via) =>
            via.location?.track_section !== step.location.track_section ||
            via.path_offset !== step.path_offset
        )
      )
    );
  };

  const convertPathfindingVias = (steps: Path['steps'], idxToAdd: number) => {
    if (steps) {
      const newVias = steps.slice(1, -1).flatMap((step, idx) => {
        if (!step.suggestion || idxToAdd === idx) {
          const viaCoordinates = step.geo?.coordinates;
          return [{ ...step, coordinates: viaCoordinates }];
        }
        return [];
      });
      dispatch(replaceVias(newVias));
    }
  };

  const formatVia = (via: ArrayElement<Path['steps']>, idx: number, idxTrueVia: number) => (
    <div
      key={`suggered-via-modal-${via.id}-${idx}`}
      className={`d-flex align-items-center p-1 ${via.suggestion && 'suggerred-via-clickable'}`}
    >
      {!via.suggestion && <small className="pr-2">{idxTrueVia}</small>}
      <i className={`${via.suggestion ? 'text-muted' : 'text-info'} icons-itinerary-bullet mr-2`} />
      {via.name || ''}
      <small className="ml-2">
        {via.path_offset && `KM ${Math.round(via.path_offset) / 1000}`}
      </small>
      {via.suggestion && !selectedViasTracks.includes(via.id) ? (
        <button
          className="btn btn-sm btn-only-icon ml-auto"
          type="button"
          onClick={() => convertPathfindingVias(suggeredVias, idx - 1)}
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
          {suggeredVias &&
            suggeredVias.map((via, idx) => {
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
