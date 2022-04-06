import * as d3 from 'd3';

import { MdContentCopy, MdDelete } from 'react-icons/md';
import React, { useEffect, useState } from 'react';
import { deleteRequest, get, post } from 'common/requests';
import { persistentUndoSimulation, persistentUpdateSimulation } from 'reducers/osrdsimulation/simulation';
import { setFailure, setSuccess } from 'reducers/main.ts';
import {
  updateAllowancesSettings,
  updateContextMenu,
  updateMustRedraw,
  updateSelectedProjection,
  updateSelectedTrain,
  updateSimulation,
} from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { GiPathDistance } from 'react-icons/gi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import PropTypes from 'prop-types';
import trainNameWithNum from 'applications/osrd/components/AddTrainSchedule/trainNameHelper';
import { useTranslation } from 'react-i18next';

const TRAINSCHEDULE_URI = '/train_schedule/';

export default function ContextMenu(props) {
  const { getTimetable } = props;
  const {
    contextMenu, allowancesSettings, selectedTrain,
  } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const { t } = useTranslation(['translation', 'simulation', 'osrdconf', 'allowances']);
  const dispatch = useDispatch();
  const [goUpdate, setGoUpdate] = useState(false);
  const [trainName, setTrainName] = useState(simulation.trains[selectedTrain]?.name);
  const [trainCount, setTrainCount] = useState(1);
  const [trainStep, setTrainStep] = useState(2);
  const [trainDelta, setTrainDelta] = useState(20);

  const choosePath = async () => {
    const train = await get(`${TRAINSCHEDULE_URI}${simulation.trains[selectedTrain]?.id}/`);
    if(simulation.trains[selectedTrain]) {
      dispatch(updateSelectedProjection({
        id: simulation.trains[selectedTrain].id,
        path: train.path,
      }));
    }

    dispatch(updateContextMenu(undefined));
  };

  const deleteTrain = () => {
    setGoUpdate(true);
    const trains = Array.from(simulation.trains);
    trains.splice(selectedTrain, 1);
    d3.select(`#spaceTime-${selectedTrain}`).remove();
    if (!trains[selectedTrain]) {
      dispatch(updateSelectedTrain(selectedTrain - 1));
    }
    dispatch(persistentUpdateSimulation({ ...simulation, trains }));
    dispatch(updateContextMenu(undefined));
    dispatch(setSuccess({
      title: t('simulation:trainDeleted'),
      text: `Train ID ${contextMenu.id}`,
    }));
/*
    try {
      deleteRequest(`${TRAINSCHEDULE_URI}${contextMenu.id}/`);
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
    }
    */
  };

  const duplicateTrain = async () => {
    setGoUpdate(true);
    const trains = Array.from(simulation.trains);
    const trainDetail = await get(`${TRAINSCHEDULE_URI}${simulation.trains[selectedTrain].id}/`);
    const params = {
      timetable: trainDetail.timetable,
      path: trainDetail.path,
      schedules: [],
    };
    let actualTrainCount = 1;
    for (let nb = 1; nb <= trainCount; nb += 1) {
      const newTrainDelta = (60 * trainDelta * nb);
      const newOriginTime = simulation.trains[selectedTrain].base.stops[0].time + newTrainDelta;
      const newTrainName = trainNameWithNum(trainName, actualTrainCount, trainCount);
      params.schedules.push({
        departure_time: newOriginTime,
        initial_speed: trainDetail.initial_speed,
        labels: trainDetail.labels,
        rolling_stock: trainDetail.rolling_stock,
        train_name: newTrainName,
        allowances: trainDetail.allowances,
      });
      actualTrainCount += trainStep;
    }
    try {
      await post(`${TRAINSCHEDULE_URI}standalone_simulation/`, params);
      getTimetable();
      dispatch(updateContextMenu(undefined));
      dispatch(setSuccess({
        title: t('osrdconf:trainAdded'),
        text: `${trainName}`,
      }));
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
    }
  };

  const closeContextMenu = () => {
    dispatch(updateContextMenu(undefined));
  };

  const changeAllowancesSettings = (type) => {
    dispatch(updateAllowancesSettings({
      ...allowancesSettings,
      [simulation.trains[selectedTrain].id]: {
        ...allowancesSettings[simulation.trains[selectedTrain].id],
        [type]: !allowancesSettings[simulation.trains[selectedTrain].id][type],
      },
    }));
    dispatch(updateMustRedraw(true));
  };

  const changeAllowancesSettingsRadio = (type) => {
    dispatch(updateAllowancesSettings({
      ...allowancesSettings,
      [simulation.trains[selectedTrain].id]: {
        ...allowancesSettings[simulation.trains[selectedTrain].id],
        baseBlocks: (type === 'baseBlocks'),
        allowancesBlocks: (type === 'allowancesBlocks'),
        ecoBlocks: (type === 'ecoBlocks'),
      },
    }));
    dispatch(updateMustRedraw(true));
  };

  useEffect(() => {
    if (goUpdate) {
      setTimeout(() => { dispatch(updateMustRedraw(true)); }, 0);
      setGoUpdate(false);
    }
  }, [simulation.trains]);

  useEffect(() => {
    setTrainName(simulation.trains[selectedTrain].name);
  }, [selectedTrain]);

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
        {simulation.trains[selectedTrain].allowances
          || simulation.trains[selectedTrain].eco ? (
            <div className="row">
              <div className="col-3 font-weight-medium mb-1">
                {t('allowances:blocks')}
              </div>
              <div className="col-9 font-weight-medium mb-1">
                {t('allowances:trainSchedules')}
              </div>
              <div className="col-3">
                <CheckboxRadioSNCF
                  id="occupation-base-blocks"
                  name="occupation-blocks"
                  type="radio"
                  label="&nbsp;"
                  onChange={() => changeAllowancesSettingsRadio('baseBlocks')}
                  checked={
                    allowancesSettings[simulation.trains[selectedTrain].id].baseBlocks
                  }
                />
              </div>
              <div className="col-9">
                <CheckboxRadioSNCF
                  id="occupation-base"
                  name="occupation-base"
                  type="checkbox"
                  onChange={() => changeAllowancesSettings('base')}
                  label={t('allowances:baseTrainSchedule')}
                  checked={
                    allowancesSettings[simulation.trains[selectedTrain].id].base
                  }
                />
              </div>
              {simulation.trains[selectedTrain].allowances && (
                <>
                  <div className="col-3">
                    <CheckboxRadioSNCF
                      id="occupation-allowances-blocks"
                      name="occupation-blocks"
                      type="radio"
                      label="&nbsp;"
                      onChange={() => changeAllowancesSettingsRadio('allowancesBlocks')}
                      checked={
                        allowancesSettings[simulation.trains[selectedTrain].id].allowancesBlocks
                      }
                    />
                  </div>
                  <div className="col-9">
                    <CheckboxRadioSNCF
                      id="occupation-allowances"
                      name="occupation-allowances"
                      type="checkbox"
                      onChange={() => changeAllowancesSettings('allowances')}
                      label={t('allowances:margedTrainSchedule')}
                      checked={
                        allowancesSettings[simulation.trains[selectedTrain].id].allowances
                      }
                    />
                  </div>
                </>
              )}
              {simulation.trains[selectedTrain].eco && (
                <>
                  <div className="col-3">
                    <CheckboxRadioSNCF
                      id="occupation-eco-blocks"
                      name="occupation-blocks"
                      type="radio"
                      label="&nbsp;"
                      onChange={() => changeAllowancesSettingsRadio('ecoBlocks')}
                      checked={
                        allowancesSettings[simulation.trains[selectedTrain].id].ecoBlocks
                      }
                    />
                  </div>
                  <div className="col-9">
                    <CheckboxRadioSNCF
                      id="occupation-eco"
                      name="occupation-eco"
                      type="checkbox"
                      onChange={() => changeAllowancesSettings('eco')}
                      label={t('allowances:ecoTrainSchedule')}
                      checked={
                        allowancesSettings[simulation.trains[selectedTrain].id].eco
                      }
                    />
                  </div>
                </>
              )}
            </div>
          ) : null}
        <div className="d-flex mb-3">
          <span className="mr-2 flex-grow-1">
            <InputSNCF
              type="text"
              label={t('osrdconf:trainScheduleName')}
              id="osrdsimu-name"
              onChange={(e) => setTrainName(e.target.value)}
              value={trainName}
              noMargin
              sm
            />
          </span>
          <span className="mr-2">
            <InputSNCF
              type="number"
              label={t('osrdconf:trainScheduleStep')}
              id="osrdsimu-traincount"
              onChange={(e) => setTrainStep(parseInt(e.target.value, 10))}
              value={trainStep}
              noMargin
              sm
            />
          </span>
        </div>
        <div className="d-flex mb-3">
          <span className="mr-2">
            <InputSNCF
              type="number"
              label={t('osrdconf:trainScheduleCount')}
              id="osrdsimu-traincount"
              onChange={(e) => setTrainCount(e.target.value)}
              value={trainCount}
              noMargin
              sm
            />
          </span>
          <span className="mr-2">
            <InputSNCF
              type="number"
              label={t('osrdconf:trainScheduleDelta')}
              id="osrdsimu-delta"
              onChange={(e) => setTrainDelta(e.target.value)}
              value={trainDelta}
              unit="min"
              noMargin
              sm
            />
          </span>
        </div>
        {goUpdate ? (
          <button type="button" className="btn btn-primary btn-block btn-sm disabled">
            <DotsLoader />
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-block btn-sm" onClick={duplicateTrain}>
            <MdContentCopy />
            <span className="ml-1">{t('simulation:duplicate')}</span>
          </button>
        )}
        <button type="button" className="btn btn-info btn-block btn-sm" onClick={choosePath}>
          <GiPathDistance />
          <span className="ml-1">{t('simulation:choosePath')}</span>
        </button>
        <button type="button" className="btn btn-danger btn-block btn-sm" onClick={deleteTrain}>
          <MdDelete />
          <span className="ml-1">{t('simulation:delete')}</span>
        </button>
        <button type="button" className="btn btn-secondary btn-block btn-sm" onClick={closeContextMenu}>
          {t('translation:common.cancel')}
        </button>
      </div>
    </div>
  ) : null;
}

ContextMenu.propTypes = {
  getTimetable: PropTypes.func.isRequired,
};
