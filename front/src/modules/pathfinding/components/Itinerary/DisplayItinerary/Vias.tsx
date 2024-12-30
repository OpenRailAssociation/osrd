import { XCircle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import type { Position } from 'geojson';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useManageTrainScheduleContext } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import { isPathStepInvalid } from 'modules/pathfinding/utils';
import { getPathSteps, getVias } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { moveElement, removeElementAtIndex } from 'utils/array';
import { formatUicToCi } from 'utils/strings';

type ViasProps = {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

const Vias = ({ zoomToFeaturePoint }: ViasProps) => {
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const vias = useSelector(getVias());
  const pathSteps = useSelector(getPathSteps);
  const { launchPathfinding } = useManageTrainScheduleContext();

  return (
    <DragDropContext
      onDragEnd={({ destination, source }) => {
        if (destination && source.index !== destination.index) {
          const from = source.index + 1;
          const to = destination.index + 1;
          const newPathSteps = moveElement(pathSteps, from, to);
          launchPathfinding(newPathSteps);
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
                      'invalid-path-item': isPathStepInvalid(via),
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
                        {'secondary_code' in via && via.secondary_code && (
                          <small data-testid="via-dropped-ch">{via.secondary_code}</small>
                        )}
                        {'uic' in via && (
                          <small data-testid="via-dropped-uic" className="text-muted ml-3">
                            {formatUicToCi(via.uic)}
                          </small>
                        )}
                      </div>
                      <button
                        data-testid="delete-via-button"
                        className="btn btn-sm btn-only-icon btn-white ml-auto"
                        type="button"
                        onClick={() => {
                          const newPathSteps = removeElementAtIndex(pathSteps, index + 1);
                          launchPathfinding(newPathSteps);
                        }}
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
