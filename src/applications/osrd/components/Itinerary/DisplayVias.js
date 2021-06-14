import React from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useSelector } from 'react-redux';
import {
  updateViaTime,
  updateViaStopTime,
  permuteVias,
  deleteVias,
} from 'applications/osrd/components/Itinerary/helpers';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

export default function DisplayVias(props) {
  const osrdconf = useSelector((state) => state.osrdconf);
  const { zoomToFeature } = props;

  return (
    <DragDropContext onDragEnd={(e) => permuteVias(e.source.index, e.destination.index)}>
      <Droppable droppableId="droppableVias">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            {osrdconf.vias.map((place, index) => (
              <Draggable key={nextId()} draggableId={`drag-vias-${index}`} index={index}>
                {(providedDraggable) => (
                  <div
                    ref={providedDraggable.innerRef}
                    {...providedDraggable.draggableProps}
                    {...providedDraggable.dragHandleProps}
                    className="d-flex align-items-center w-100 osrd-config-place osrd-config-place-via"
                  >
                    <i className="text-info icons-itinerary-bullet mr-2" />
                    <div className="pl-1 hover w-100 d-flex align-items-center">
                      <div
                        className="flex-grow-1"
                        onClick={() => zoomToFeature(
                          place.boundingBox,
                          place.id,
                          place.source,
                        )}
                        role="button"
                        tabIndex={0}
                      >
                        <small className="font-weight-bold text-muted mr-1">{index + 1}</small>
                        <small className="mr-1 text-nowrap">{`${place.id} ${place.nomVoie}`}</small>
                        <div className="small text-nowrap ml-3">{`${place.pkSncfDe} • ${place.pkSncfFi}`}</div>
                      </div>
                      <div className="mx-2 osrd-config-time">
                        <InputSNCF
                          type="time"
                          id={`osrd-config-time-via-${nextId()}`}
                          onChange={(e) => updateViaTime(index, e.target.value)}
                          value={
                            osrdconf.vias[index] !== undefined
                              ? osrdconf.vias[index].time : ''
                          }
                          seconds
                          sm
                          noMargin
                        />
                      </div>
                      <div className="osrd-config-stoptime">
                        <InputSNCF
                          type="number"
                          id={`osrd-config-stoptime-via-${nextId()}`}
                          onChange={
                            (e) => updateViaStopTime(index, e.target.value)
                          }
                          value={
                            osrdconf.vias[index] !== undefined
                            && osrdconf.vias[index].stoptime !== undefined
                              ? Number(osrdconf.vias[index].stoptime) : '0'
                          }
                          sm
                          noMargin
                        />
                      </div>
                      <button
                        className="btn btn-sm btn-only-icon btn-white ml-auto"
                        type="button"
                        onClick={() => deleteVias(index)}
                      >
                        <i className="icons-circle-delete" />
                        <span className="sr-only" aria-hidden="true">Delete</span>
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
}

DisplayVias.propTypes = {
  zoomToFeature: PropTypes.func.isRequired,
};
