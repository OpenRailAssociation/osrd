import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import type { Action } from '@reduxjs/toolkit';
import cx from 'classnames';
import { Position } from 'geojson';
import { formatUicToCi } from 'utils/strings';

import { useDebounce } from 'utils/helpers';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';

type InputStopTimeProps = {
  index: number;
  setIndexSelected: (selectedIndex?: number) => void;
  dispatchAndRun: (action: Action) => void;
};

function InputStopTime({ index, setIndexSelected, dispatchAndRun }: InputStopTimeProps) {
  const { getVias } = useOsrdConfSelectors();
  const { updateViaStopTime } = useOsrdConfActions();
  const vias = useSelector(getVias);
  const [stopTime, setStopTime] = useState(vias[index].duration || 0);
  const [firstStart, setFirstStart] = useState(true);
  const debouncedStopTime = useDebounce(stopTime, 1000);

  useEffect(() => {
    if (!firstStart) {
      dispatchAndRun(updateViaStopTime(vias, index, debouncedStopTime));
      setIndexSelected(undefined);
    } else {
      setFirstStart(false);
    }
  }, [debouncedStopTime]);

  return (
    <InputSNCF
      type="number"
      id={`osrd-config-stoptime-via-${index}`}
      onChange={(e) => setStopTime(Number(e.target.value))}
      value={stopTime}
      unit="s"
      focus
      selectAllOnFocus
      sm
      noMargin
      textRight
    />
  );
}

type DisplayViasProps = {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

export default function DisplayVias({ zoomToFeaturePoint }: DisplayViasProps) {
  const { getConf, getVias } = useOsrdConfSelectors();
  const osrdconf = useSelector(getConf);
  const dispatch = useDispatch();
  const vias = useSelector(getVias);
  const [indexSelected, setIndexSelected] = useState<number | undefined>(undefined);
  const { permuteVias, updateViaStopTime, deleteVias } = useOsrdConfActions();

  const dispatchAndRun = (action: Action) => {
    dispatch(action);
  };

  return (
    <DragDropContext
      onDragEnd={(e) =>
        e.destination &&
        dispatchAndRun(permuteVias(osrdconf.vias, e.source.index, e.destination.index))
      }
    >
      <Droppable droppableId="droppableVias">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {osrdconf.vias.map((place, index) => (
              <Draggable
                key={`drag-key-${place.id}-${place.path_offset}`}
                draggableId={`drag-vias-${index}`}
                index={index}
              >
                {(providedDraggable) => (
                  <div
                    ref={providedDraggable.innerRef}
                    {...providedDraggable.draggableProps}
                    {...providedDraggable.dragHandleProps}
                    className={cx('place via', osrdconf.vias[index].duration !== 0 && 'is-a-stop')}
                  >
                    <div className="ring" />
                    <div className="pl-1 w-100 d-flex align-items-center">
                      <div
                        className="flex-grow-1"
                        onClick={() => zoomToFeaturePoint(place.coordinates, place.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <small className="font-weight-bold text-muted mr-1">{index + 1}</small>
                        <small className="mr-1 text-nowrap">
                          {`${
                            place.name ||
                            `KM ${place.position && Math.round(place.position) / 1000}`
                          }`}
                        </small>
                        <small className="">{place.ch}</small>
                        {place.uic && (
                          <small className="text-muted ml-3">{formatUicToCi(place.uic)}</small>
                        )}
                      </div>
                      {index !== indexSelected && (
                        <div className="default-durations-button mr-1">
                          <button
                            type="button"
                            onClick={() => dispatchAndRun(updateViaStopTime(vias, index, 30))}
                          >
                            30s
                          </button>
                          <button
                            type="button"
                            onClick={() => dispatchAndRun(updateViaStopTime(vias, index, 60))}
                          >
                            1min
                          </button>
                          <button
                            type="button"
                            onClick={() => dispatchAndRun(updateViaStopTime(vias, index, 120))}
                          >
                            2min
                          </button>
                        </div>
                      )}
                      <div role="button" tabIndex={-1} onClick={() => setIndexSelected(index)}>
                        {index === indexSelected ? (
                          <InputStopTime
                            index={index}
                            dispatchAndRun={dispatchAndRun}
                            setIndexSelected={setIndexSelected}
                          />
                        ) : (
                          <div className="stoptime">
                            {osrdconf.vias[index].duration ? osrdconf.vias[index].duration : 0}s
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-sm btn-only-icon btn-white ml-auto"
                        type="button"
                        onClick={() => dispatchAndRun(deleteVias(index))}
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
