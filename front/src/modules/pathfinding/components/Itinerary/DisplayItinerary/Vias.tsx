import { useState } from 'react';

import { XCircle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import type { Position } from 'geojson';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { formatUicToCi } from 'utils/strings';

import ViaStopDurationSelector from './ViaStopDurationSelector';

type ViasProps = {
  shouldManageStopDuration?: boolean;
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
  isInvalid: (step: PathStep | null) => boolean;
};

const Vias = ({ zoomToFeaturePoint, shouldManageStopDuration, isInvalid }: ViasProps) => {
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const { getVias } = useOsrdConfSelectors();
  const dispatch = useAppDispatch();
  const vias = useSelector(getVias());
  const { moveVia, deleteVia } = useOsrdConfActions();
  const [focusedViaId, setFocusedViaId] = useState<string>();

  return (
    <DragDropContext
      onDragEnd={({ destination, source }) => {
        if (destination && source.index !== destination.index) {
          dispatch(moveVia(vias, source.index, destination.index));
        }
      }}
    >
      <Droppable droppableId="droppableVias">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {vias.map((via, index) => (
              <Draggable
                key={`drag-key-${via.id}-${via.positionOnPath}`}
                draggableId={`drag-vias-${via.id}`}
                index={index}
              >
                {(providedDraggable) => (
                  <div
                    data-testid="dropped-via-info"
                    ref={providedDraggable.innerRef}
                    {...providedDraggable.draggableProps}
                    {...providedDraggable.dragHandleProps}
                    className={cx('place via', {
                      'is-a-stop': via.arrival || via.stopFor,
                      'invalid-path-item': isInvalid(via),
                    })}
                  >
                    <div className="ring" />
                    <div className="pl-1 w-100 d-flex align-items-center">
                      <div
                        className="flex-grow-1"
                        onClick={() => zoomToFeaturePoint(via.coordinates, via.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <small className="font-weight-bold text-muted mr-1">{index + 1}</small>
                        <small data-testid="via-dropped-name" className="mr-1 text-nowrap">
                          {`${via.name || (via.positionOnPath && `KM ${(Math.round(via.positionOnPath) / 1000000).toFixed(3)}`) || t('unavailableDistance')}`}
                        </small>
                        {via.ch && <small data-testid="via-dropped-ch">{via.ch}</small>}
                        {'uic' in via && (
                          <small data-testid="via-dropped-uic" className="text-muted ml-3">
                            {formatUicToCi(via.uic)}
                          </small>
                        )}
                      </div>
                      {shouldManageStopDuration && (
                        <ViaStopDurationSelector
                          via={via}
                          focusedViaId={focusedViaId}
                          setFocusedViaId={setFocusedViaId}
                        />
                      )}
                      <button
                        data-testid="delete-via-button"
                        className="btn btn-sm btn-only-icon btn-white ml-auto"
                        type="button"
                        onClick={() => dispatch(deleteVia(index))}
                      >
                        <XCircle variant="fill" />
                        <span className="sr-only" aria-hidden="true">
                          Delete
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default Vias;
