import React, { useContext } from 'react';
import { getSuggeredVias, getVias } from 'reducers/osrdconf/selectors';
import { replaceVias } from 'reducers/osrdconf';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { GoDash, GoPlus, GoTrash } from 'react-icons/go';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Spinner } from 'common/Loader/Loader';
import type { ArrayElement } from 'utils/types';
import type { PathResponse, PathWaypoint } from 'common/api/osrdEditoastApi';
import { formatUicToCi } from 'utils/strings';
import cx from 'classnames';

type Props = {
  removeAllVias: () => void;
  pathfindingInProgress?: boolean;
};

function LoaderPathfindingInProgress() {
  return <Spinner className="loaderPathfindingInProgress" />;
}

export default function ModalSugerredVias({ removeAllVias, pathfindingInProgress }: Props) {
  const dispatch = useDispatch();
  const suggeredVias = useSelector(getSuggeredVias) as PathWaypoint[];
  const vias = useSelector(getVias);

  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const nbVias = suggeredVias ? suggeredVias.length - 1 : 0;
  const selectedViasTracks = vias.map((via) => via.id);
  const { closeModal } = useContext(ModalContext);

  const removeViaFromPath = (step: ArrayElement<PathResponse['steps']>) => {
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

  const convertPathfindingVias = (steps: PathResponse['steps'], idxToAdd: number) => {
    if (steps) {
      const newVias = steps.slice(1, -1).flatMap((step, idx) => {
        if (!step.suggestion || idxToAdd === idx) {
          const viaCoordinates = step.geo?.coordinates;
          return [
            {
              ...step,
              coordinates: viaCoordinates,
              id: step.id || undefined,
              name: step.name || undefined,
            },
          ];
        }
        return [];
      });
      dispatch(replaceVias(newVias));
    }
  };

  const formatVia = (via: ArrayElement<PathResponse['steps']>, idx: number, idxTrueVia: number) => (
    <div
      key={`suggested-via-modal-${via.id}-${idx}`}
      className={cx('d-flex align-items-center p-1', via.suggestion && 'suggested-via-clickable')}
      title={via.name!}
    >
      {!via.suggestion && <small className="pr-2">{idxTrueVia}</small>}
      <i className={`${via.suggestion ? 'text-muted' : 'text-info'} icons-itinerary-bullet mr-2`} />
      <span className="suggested-via-name">{via.name || ''}</span>&nbsp;
      <span>{via.ch}</span>
      {via.uic && <small className="text-muted ml-3">{formatUicToCi(via.uic)}</small>}
      <div className="ml-auto">
        {via.path_offset && (
          <small className="mr-2">{`KM ${Math.round(via.path_offset) / 1000}`}</small>
        )}
        {via.suggestion && via.id && !selectedViasTracks.includes(via.id) ? (
          <button
            className="btn btn-sm btn-only-icon"
            type="button"
            onClick={() => convertPathfindingVias(suggeredVias, idx - 1)}
          >
            <GoPlus />
          </button>
        ) : (
          <button
            className="btn btn-sm btn-only-icon bg-dark"
            type="button"
            onClick={() => removeViaFromPath(via)}
          >
            <GoDash color="white" />
          </button>
        )}
      </div>
    </div>
  );

  let idxTrueVia = 0;
  return (
    <div className="manage-vias-modal">
      <ModalHeaderSNCF>
        <h1>{`${t('manageVias')} ${vias.length > 0 ? `(${vias.length})` : ''}`}</h1>
        <button className="btn btn-only-icon close" type="button" onClick={closeModal}>
          <i className="icons-close" />
        </button>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="suggested-vias">
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
        <div className="w-100 mt-2 mb-n2">
          <button
            className="btn btn-danger btn-sm btn-block mb-1"
            type="button"
            onClick={removeAllVias}
          >
            <GoTrash />
            <span className="ml-2">{t('deleteVias')}</span>
          </button>
        </div>
      </ModalFooterSNCF>
    </div>
  );
}
