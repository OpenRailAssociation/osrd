import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { MdContentCopy, MdDelete } from 'react-icons/md';
import { GiPathDistance } from 'react-icons/gi';
import { get, post, deleteRequest } from 'common/requests';
import {
  updateContextMenu, updateMarginsSettings, updateSimulation, updateSelectedProjection,
  updateSelectedTrain, updateMustRedraw,
} from 'reducers/osrdsimulation';
import { setSuccess, setFailure } from 'reducers/main.ts';
import { timeShiftTrain } from 'applications/osrd/components/Helpers/ChartHelpers';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import trainNameWithNum from 'applications/osrd/components/AddTrainSchedule/trainNameHelper';
import { sec2time } from 'utils/timeManipulation';
import DotsLoader from 'common/DotsLoader/DotsLoader';

const TRAINSCHEDULE_URI = '/train_schedule/';

export default function ContextMenu() {
  const {
    contextMenu, marginsSettings, selectedTrain, simulation,
  } = useSelector((state) => state.osrdsimulation);
  const { t } = useTranslation(['translation', 'simulation', 'osrdconf', 'margins']);
  const dispatch = useDispatch();
  const [goUpdate, setGoUpdate] = useState(false);
  const [trainName, setTrainName] = useState(simulation.trains[selectedTrain].name);
  const [trainCount, setTrainCount] = useState(1);
  const [trainStep, setTrainStep] = useState(2);
  const [trainDelta, setTrainDelta] = useState(20);

  const choosePath = async () => {
    const firstTrain = await get(`${TRAINSCHEDULE_URI}${simulation.trains[selectedTrain].id}/`);
    dispatch(updateSelectedProjection(firstTrain.path));
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

  const getAndDuplicateTrain = async (id, newOriginTime, newTrainName) => {
    try {
      const trainDetail = await get(`${TRAINSCHEDULE_URI}${id}/`);
      const params = {
        departure_time: newOriginTime,
        initial_speed: trainDetail.initial_speed,
        labels: trainDetail.labels,
        path: trainDetail.path,
        rolling_stock: trainDetail.rolling_stock,
        timetable: trainDetail.timetable,
        train_name: newTrainName,
        margins: trainDetail.margins,
      };
      const result = await post(TRAINSCHEDULE_URI, params);
      return result.id;
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
    }
    return false;
  };

  const duplicateTrain = async () => {
    setGoUpdate(true);
    const trains = Array.from(simulation.trains);
    const newMarginsSettings = { ...marginsSettings };
    let actualTrainCount = 1;
    for (let nb = 1; nb <= trainCount; nb += 1) {
      const newTrainDelta = (60 * trainDelta * nb);
      const newOriginTime = simulation.trains[selectedTrain].base.stops[0].time + newTrainDelta;
      const newTrainName = trainNameWithNum(trainName, actualTrainCount, trainCount);
      const newTrain = {
        ...timeShiftTrain(trains[selectedTrain], newTrainDelta),
        name: newTrainName,
      };
      newTrain.id = await getAndDuplicateTrain(
        simulation.trains[selectedTrain].id, newOriginTime, newTrainName,
      );
      if (newTrain.id) {
        trains.splice(selectedTrain + nb, 0, newTrain);
        // Create margins settings for each train if not set
        newMarginsSettings[newTrain.id] = {
          base: true,
          baseBlocks: false,
          margins: true,
          marginsBlocks: false,
          eco: true,
          ecoBlocks: true,
        };
        dispatch(setSuccess({
          title: t('osrdconf:trainAdded'),
          text: `${trainName}: ${sec2time(newOriginTime)}`,
        }));
      }
      actualTrainCount += trainStep;
    }
    dispatch(updateMarginsSettings(newMarginsSettings));
    dispatch(updateSimulation({ ...simulation, trains }));
    dispatch(updateSelectedTrain(selectedTrain + 1));
    dispatch(updateContextMenu(undefined));
  };

  const closeContextMenu = () => {
    dispatch(updateContextMenu(undefined));
  };

  const changeMarginsSettings = (type) => {
    dispatch(updateMarginsSettings({
      ...marginsSettings,
      [simulation.trains[selectedTrain].id]: {
        ...marginsSettings[simulation.trains[selectedTrain].id],
        [type]: !marginsSettings[simulation.trains[selectedTrain].id][type],
      },
    }));
    dispatch(updateMustRedraw(true));
  };

  const changeMarginsSettingsRadio = (type) => {
    dispatch(updateMarginsSettings({
      ...marginsSettings,
      [simulation.trains[selectedTrain].id]: {
        ...marginsSettings[simulation.trains[selectedTrain].id],
        baseBlocks: (type === 'baseBlocks'),
        marginsBlocks: (type === 'marginsBlocks'),
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
        {simulation.trains[selectedTrain].margins
          || simulation.trains[selectedTrain].eco ? (
            <div className="row">
              <div className="col-3 font-weight-medium mb-1">
                {t('margins:blocks')}
              </div>
              <div className="col-9 font-weight-medium mb-1">
                {t('margins:trainSchedules')}
              </div>
              <div className="col-3">
                <CheckboxRadioSNCF
                  id="occupation-base-blocks"
                  name="occupation-blocks"
                  type="radio"
                  label="&nbsp;"
                  onChange={() => changeMarginsSettingsRadio('baseBlocks')}
                  checked={
                    marginsSettings[simulation.trains[selectedTrain].id].baseBlocks
                  }
                />
              </div>
              <div className="col-9">
                <CheckboxRadioSNCF
                  id="occupation-base"
                  name="occupation-base"
                  type="checkbox"
                  onChange={() => changeMarginsSettings('base')}
                  label={t('margins:baseTrainSchedule')}
                  checked={
                    marginsSettings[simulation.trains[selectedTrain].id].base
                  }
                />
              </div>
              {simulation.trains[selectedTrain].margins && (
                <>
                  <div className="col-3">
                    <CheckboxRadioSNCF
                      id="occupation-margins-blocks"
                      name="occupation-blocks"
                      type="radio"
                      label="&nbsp;"
                      onChange={() => changeMarginsSettingsRadio('marginsBlocks')}
                      checked={
                        marginsSettings[simulation.trains[selectedTrain].id].marginsBlocks
                      }
                    />
                  </div>
                  <div className="col-9">
                    <CheckboxRadioSNCF
                      id="occupation-margins"
                      name="occupation-margins"
                      type="checkbox"
                      onChange={() => changeMarginsSettings('margins')}
                      label={t('margins:margedTrainSchedule')}
                      checked={
                        marginsSettings[simulation.trains[selectedTrain].id].margins
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
                      onChange={() => changeMarginsSettingsRadio('ecoBlocks')}
                      checked={
                        marginsSettings[simulation.trains[selectedTrain].id].ecoBlocks
                      }
                    />
                  </div>
                  <div className="col-9">
                    <CheckboxRadioSNCF
                      id="occupation-eco"
                      name="occupation-eco"
                      type="checkbox"
                      onChange={() => changeMarginsSettings('eco')}
                      label={t('margins:ecoTrainSchedule')}
                      checked={
                        marginsSettings[simulation.trains[selectedTrain].id].eco
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
