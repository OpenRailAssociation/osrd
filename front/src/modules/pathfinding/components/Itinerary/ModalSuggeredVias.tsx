import React, { useMemo } from 'react';

import { Dash, Plus, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { uniqBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { PathResponse, PathWaypoint } from 'common/api/osrdEditoastApi';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { Spinner } from 'common/Loaders';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { useAppDispatch } from 'store';
import { formatUicToCi } from 'utils/strings';
import type { ArrayElement } from 'utils/types';

type ModalSugerredViasProps = {
  removeAllVias: () => void;
  pathfindingInProgress?: boolean;
};

function LoaderPathfindingInProgress() {
  return <Spinner className="loaderPathfindingInProgress" />;
}

export default function ModalSugerredVias({
  removeAllVias,
  pathfindingInProgress,
}: ModalSugerredViasProps) {
  const { replaceVias } = useOsrdConfActions();
  const { getSuggeredVias, getVias } = useOsrdConfSelectors();
  const dispatch = useAppDispatch();
  const vias = useSelector(getVias);
  const suggeredVias = useSelector(getSuggeredVias) as PathWaypoint[];
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');

  const selectedViasTracks = vias.map((via) => via.id);

  const uniqueSuggeredVias = useMemo(() => uniqBy(suggeredVias, (op) => op.id), [suggeredVias]);
  const nbVias = uniqueSuggeredVias ? uniqueSuggeredVias.length - 1 : 0;

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
            aria-label={t('addVia')}
            title={t('addVia')}
            onClick={() => convertPathfindingVias(uniqueSuggeredVias, idx - 1)}
          >
            <Plus />
          </button>
        ) : (
          <button
            className="btn btn-sm btn-only-icon"
            type="button"
            aria-label={t('removeVia')}
            title={t('removeVia')}
            onClick={() => removeViaFromPath(via)}
          >
            <Dash />
          </button>
        )}
      </div>
    </div>
  );

  let idxTrueVia = 0;
  return (
    <div className="manage-vias-modal">
      <ModalHeaderSNCF withCloseButton>
        <h1>{`${t('manageVias')} ${vias.length > 0 ? `(${vias.length})` : ''}`}</h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="suggested-vias">
          {pathfindingInProgress && <LoaderPathfindingInProgress />}
          {uniqueSuggeredVias &&
            uniqueSuggeredVias.map((via, idx) => {
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
            <Trash />
            <span className="ml-2">{t('deleteVias')}</span>
          </button>
        </div>
      </ModalFooterSNCF>
    </div>
  );
}
