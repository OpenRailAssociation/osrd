import React, { useState, useEffect, ComponentType } from 'react';
import PropTypes from 'prop-types';
import { Dispatch } from 'redux';
import { Position } from 'geojson';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useSelector, useDispatch } from 'react-redux';
import { deleteVias, permuteVias, updateViaStopTime } from 'reducers/osrdconf';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import { getVias } from 'reducers/osrdconf/selectors';
import { OsrdConfState } from 'applications/operationalStudies/consts';


function InputStopTime(props: any) {
  const { index, osrdConfVias, dispatch } = props;
  const [stopTime, setStopTime] = useState(
    osrdConfVias[index].duration ? osrdConfVias[index].duration : 0
  );
  const [firstStart, setFirstStart] = useState(true);
  const debouncedStopTime = useDebounce(stopTime, 1000);

  useEffect(() => {
    if (!firstStart) {
      dispatch(updateViaStopTime(osrdConfVias, index, debouncedStopTime));
    } else {
      setFirstStart(false);
    }
  }, [debouncedStopTime]);

  return (
    <InputSNCF
      type="number"
      id={`osrd-config-stoptime-via-${index}`}
      onChange={(e: any) => setStopTime(e.target.value)}
      value={stopTime}
      unit="s"
      sm
      noMargin
    />
  );
}

export interface DisplayViasProps {
  dispatch?: Dispatch;
  osrdConfVias?: OsrdConfState['vias'];
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
}

export function withStdcmData<T extends DisplayViasProps>(Component: ComponentType<T>) {
  return (hocProps: DisplayViasProps) => {
    const osrdConfVias = useSelector(getVias);
    const dispatch = useDispatch();

    return <Component {...(hocProps as T)} dispatch={dispatch} osrdConfVias={osrdConfVias} />;
  };
}

export function withOSRDSimulationData<T extends DisplayViasProps>(Component: ComponentType<T>) {
  return (hocProps: DisplayViasProps) => {
    const osrdConfVias = useSelector(getVias);
    const dispatch = useDispatch();

    return <Component {...(hocProps as T)} dispatch={dispatch} osrdConfVias={osrdConfVias} />;
  };
}

export default function DisplayVias(props: DisplayViasProps) {
  const [indexSelected, setIndexSelected] = useState<number>(-1);
  const { zoomToFeaturePoint, dispatch = () => null, osrdConfVias = [] } = props;

  return (
    <DragDropContext
      onDragEnd={(e: any) =>
        dispatch(permuteVias(osrdConfVias, e.source.index, e.destination.index))
      }
    >
      <Droppable droppableId="droppableVias">
        {(provided: any) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {osrdConfVias.map((place, index) => (
              <Draggable
                key={`drag-key-${place.id}`}
                draggableId={`drag-vias-${index}`}
                index={index}
              >
                {(providedDraggable: any) => (
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
                        onClick={() =>
                          zoomToFeaturePoint(place.clickLngLat, place.id, place.source)
                        }
                        role="button"
                        tabIndex={0}
                      >
                        <small className="font-weight-bold text-muted mr-1">{index + 1}</small>
                        <small className="mr-1 text-nowrap">
                          {`${place.name || `KM ${Math.round(place.length) / 1000}`}`}
                        </small>
                      </div>
                      <div
                        className="osrd-config-stoptime"
                        role="button"
                        tabIndex={-1}
                        onClick={() => setIndexSelected(index)}
                      >
                        {index === indexSelected ? (
                          <InputStopTime index={index} />
                        ) : (
                          <>
                            {osrdConfVias[index].duration ? osrdConfVias[index].duration : 0}
                            <i className="ml-2 icons-pencil" />
                          </>
                        )}
                      </div>
                      <button
                        className="btn btn-sm btn-only-icon btn-white ml-auto"
                        type="button"
                        onClick={() => dispatch(deleteVias(index))}
                      >
                        <i className="icons-circle-delete" />
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
}

DisplayVias.propTypes = {
  zoomToFeaturePoint: PropTypes.func.isRequired,
};

InputStopTime.propTypes = {
  index: PropTypes.number.isRequired,
};
