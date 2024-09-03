import React, { useState } from 'react';

import { XCircle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import type { Position } from 'geojson';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useSelector } from 'react-redux';

import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { useAppDispatch } from 'store';
import { formatUicToCi } from 'utils/strings';

import ViaStopDurationSelector from './ViaStopDurationSelector';

type DisplayViasV2Props = {
  shouldManageStopDuration?: boolean;
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

const ViasV2 = ({ zoomToFeaturePoint, shouldManageStopDuration }: DisplayViasV2Props) => {
  const { getViasV2 } = useOsrdConfSelectors();
  const dispatch = useAppDispatch();
  const vias = useSelector(getViasV2());
  const { moveVia, deleteViaV2 } = useOsrdConfActions();
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
                          {`${via.name || `KM ${via.positionOnPath && (Math.round(via.positionOnPath) / 1000000).toFixed(3)}`}`}
                        </small>
                        {'secondary_code' in via && via.secondary_code && (
                          <small data-testid="via-dropped-ch">{via.secondary_code}</small>
                        )}
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
                        onClick={() => dispatch(deleteViaV2(index))}
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

export default ViasV2;
