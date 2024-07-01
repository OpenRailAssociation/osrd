import React, { useCallback } from 'react';

import { Dash, Plus, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { isVia } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import { useAppDispatch } from 'store';
import { formatUicToCi } from 'utils/strings';

type ModalSuggestedViasProps = {
  suggestedVias: SuggestedOP[];
};

const ModalSuggestedVias = ({ suggestedVias }: ModalSuggestedViasProps) => {
  const { updatePathSteps, upsertViaFromSuggestedOP, clearViasV2 } = useOsrdConfActions();
  const { getViasV2, getDestinationV2, getPathSteps } = useOsrdConfSelectors();
  const dispatch = useAppDispatch();
  const vias = useSelector(getViasV2());
  const destination = useSelector(getDestinationV2);
  const pathSteps = useSelector(getPathSteps);
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');

  const isOriginOrDestination = useCallback(
    (op: SuggestedOP) =>
      op.positionOnPath === 0 || op.positionOnPath === destination?.positionOnPath,
    [destination]
  );

  const removeViaFromPath = (op: SuggestedOP) => {
    const updatedPathSteps = [...pathSteps];
    dispatch(
      updatePathSteps(
        compact(updatedPathSteps).filter(
          (step) =>
            ('uic' in step && step.uic !== op.uic) || ('track' in step && step.track !== op.track)
        )
      )
    );
  };

  const formatOP = (op: SuggestedOP, idx: number, idxTrueVia: number) => {
    const isInVias = isVia(vias, op);
    return (
      <div
        key={`suggested-via-modal-${op.opId}-${idx}`}
        className={cx('d-flex align-items-center p-1', { 'suggested-via-clickable': !isInVias })}
        title={op.name}
      >
        {isInVias && <small className="pr-2">{idxTrueVia}</small>}
        <i className={`${!isInVias ? 'text-muted' : 'text-info'} icons-itinerary-bullet mr-2`} />
        <span className={cx('mr-1', 'suggested-via-name', { 'reduced-text': isInVias })}>
          {op.name || ''}
        </span>
        {op.ch && <span className="suggested-via-ch">{op.ch}</span>}
        {op.uic && <small className="suggested-via-uic text-muted">{formatUicToCi(op.uic)}</small>}
        <div className="ml-auto">
          {op.positionOnPath && (
            <small className="mr-2">{`KM ${(Math.round(op.positionOnPath) / 1000000).toFixed(3)}`}</small>
          )}
          {!isInVias ? (
            <button
              className="btn btn-sm btn-only-icon"
              type="button"
              aria-label={t('addVia')}
              title={t('addVia')}
              onClick={() => dispatch(upsertViaFromSuggestedOP(op))}
            >
              <Plus />
            </button>
          ) : (
            <button
              className="btn btn-sm btn-only-icon"
              type="button"
              aria-label={t('removeVia')}
              title={t('removeVia')}
              onClick={() => removeViaFromPath(op)}
            >
              <Dash />
            </button>
          )}
        </div>
      </div>
    );
  };

  let idxTrueVia = 0;
  return (
    <div className="manage-vias-modal">
      <ModalHeaderSNCF withCloseButton>
        <h1>
          {t('manageVias')}
          {vias.length > 0 && ` (${vias.length})`}
        </h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="suggested-vias">
          {suggestedVias.map((via, idx) => {
            if (!isOriginOrDestination(via)) {
              // If name is undefined, we know the op/via has been added by clicking on map
              if (isVia(vias, via)) idxTrueVia += 1;
              return formatOP(via, idx, idxTrueVia);
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
            onClick={() => dispatch(clearViasV2())}
          >
            <Trash />
            <span className="ml-2">{t('deleteVias')}</span>
          </button>
        </div>
      </ModalFooterSNCF>
    </div>
  );
};

export default ModalSuggestedVias;
