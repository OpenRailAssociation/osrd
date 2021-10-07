import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { MdContentCopy, MdDelete } from 'react-icons/md';
import { get, post, deleteRequest } from 'common/requests';
import {
  updateContextMenu, updateSimulation, updateSelectedTrain, updateMustRedraw,
} from 'reducers/osrdsimulation';
import { setSuccess, setFailure } from 'reducers/main.ts';
import { timeShiftTrain } from 'applications/osrd/components/Helpers/ChartHelpers';

const TRAINSCHEDULE_URI = '/train_schedule/';

export default function ContextMenu() {
  const { contextMenu, selectedTrain, simulation } = useSelector((state) => state.osrdsimulation);
  const { t } = useTranslation(['translation', 'simulation']);
  const dispatch = useDispatch();
  const [goUpdate, setGoUpdate] = useState(false);

  const deleteTrain = () => {
    setGoUpdate(true);
    const trains = Array.from(simulation.trains);
    trains.splice(selectedTrain, 1);
    d3.select(`#spaceTime-${selectedTrain}`).remove();
    if (!trains[selectedTrain]) {
      dispatch(updateSelectedTrain(selectedTrain - 1));
    }
    dispatch(updateSimulation({ ...simulation, trains }));
    dispatch(updateContextMenu(undefined));
    dispatch(setSuccess({
      title: t('simulation:trainDeleted'),
      text: `Train ID ${contextMenu.id}`,
    }));

    try {
      deleteRequest(`${TRAINSCHEDULE_URI}${contextMenu.id}/`);
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
    }
  };

  const duplicateTrain = async () => {
    const trains = Array.from(simulation.trains);
    const newTrain = { ...timeShiftTrain(trains[selectedTrain], 300), name: `${trains[selectedTrain].name} (${t('simulation:copy')})` };
    try {
      const trainDetail = await get(`${TRAINSCHEDULE_URI}${trains[selectedTrain].id}/`);
      try {
        const params = {
          departure_time: newTrain.stops[0].time,
          initial_speed: trainDetail.initial_speed,
          labels: trainDetail.labels,
          path: trainDetail.path,
          rolling_stock: trainDetail.rolling_stock,
          timetable: trainDetail.timetable,
          train_name: newTrain.name,
        };
        setGoUpdate(true);
        newTrain.id = await post(TRAINSCHEDULE_URI, params);
        trains.splice(selectedTrain + 1, 0, newTrain);
        dispatch(updateSelectedTrain(selectedTrain + 1));
        dispatch(updateSimulation({ ...simulation, trains }));
        dispatch(updateContextMenu(undefined));
        dispatch(setSuccess({
          title: t('simulation:trainDuplicated'),
          text: `Train ID ${newTrain.id}`,
        }));
      } catch (e) {
        console.log('ERROR', e);
        dispatch(setFailure({
          name: e.name,
          message: e.message,
        }));
      }
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
    }
  };

  useEffect(() => {
    if (goUpdate) {
      dispatch(updateMustRedraw(true));
      setGoUpdate(false);
    }
  }, [simulation.trains]);

  const closeContextMenu = () => {
    dispatch(updateContextMenu(undefined));
  };

  return contextMenu ? (
    <div
      className="get-context-menu dropdown show dropright"
      style={{
        position: 'absolute',
        top: contextMenu.yPos - 20,
        left: contextMenu.xPos + 10,
      }}
    >
      <div className="dropdown-menu show">
        <ul>
          <li className="dropdown-item">
            <button type="button" className="btn btn-link d-flex align-items-center" onClick={duplicateTrain}>
              <MdContentCopy />
              <span className="ml-1">{t('simulation:duplicate')}</span>
            </button>
          </li>
          <li className="dropdown-item">
            <button type="button" className="btn btn-link d-flex align-items-center" onClick={deleteTrain}>
              <MdDelete />
              <span className="ml-1">{t('simulation:delete')}</span>
            </button>
          </li>
        </ul>
        <div className="dropdown-divider" />
        <ul>
          <li className="dropdown-item">
            <button type="button" className="btn btn-link d-flex align-items-center" onClick={closeContextMenu}>
              {t('translation:common.cancel')}
            </button>
          </li>
        </ul>
      </div>
    </div>
  ) : null;
}
