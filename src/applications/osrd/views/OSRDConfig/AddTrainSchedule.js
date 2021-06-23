import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import nextId from 'react-id-generator';
import { post } from 'common/requests';
import { updateName } from 'reducers/osrdconf';
import {
  redirectToGraph, updateSimulation, toggleWorkingStatus,
} from 'reducers/osrdsimulation';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import AlertSNCF from 'common/BootstrapSNCF/AlertSNCF';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { time2sec } from 'utils/timeManipulation';

import formatConf from 'applications/osrd/components/AddTrainSchedule/formatConf';

const osrdURI = '/osrd/simulate';
const scheduleURL = '/osrd/train_schedule'

export default function AddTrainSchedule() {
  const [errorMessagesState, setErrorMessages] = useState([]);
  const [isWorking, setIsWorking] = useState(false);
  const [trainCount, setTrainCount] = useState(1);
  const [trainDelta, setTrainDelta] = useState(60);
  const osrdconf = useSelector((state) => state.osrdconf);
  const osrdsimulation = useSelector((state) => state.osrdsimulation);
  const { t } = useTranslation(['translation', 'osrdconf']);
  const dispatch = useDispatch();

  const submitConf = () => {
    setIsWorking(true);
    // First train tested, and next we put the other trains
    const originTime = time2sec(osrdconf.originTime);
    const osrdConfig = formatConf(setErrorMessages, t, osrdconf, originTime);
    if (osrdConfig !== false) {
      try {
        for (let nb = 1; nb <= trainCount; nb += 1) {
          post(
            scheduleURL,
            formatConf(setErrorMessages, t, osrdconf, originTime + (60 * trainDelta * (nb - 1))),
            {},
          );
        }
      } catch (e) {
        console.log(e);
      }
      setIsWorking(false);
    }
  };

  return (
    <>
      <div className="osrd-config-item">
        <div className="osrd-config-item-container d-flex align-items-end mb-2">
          <span className="mr-2 flex-grow-1">
            <InputSNCF
              type="text"
              label={t('osrdconf:trainScheduleName')}
              id="osrdconf-name"
              onChange={(e) => dispatch(updateName(e.target.value))}
              value={osrdconf.name}
              noMargin
              sm
            />
          </span>
          <span className="mr-2">
            <InputSNCF
              type="number"
              label={t('osrdconf:trainScheduleCount')}
              id="osrdconf-traincount"
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
              id="osrdconf-delta"
              onChange={(e) => setTrainDelta(e.target.value)}
              value={trainDelta}
              noMargin
              sm
            />
          </span>
          <button className="btn btn-sm btn-primary" type="button" onClick={submitConf}>
            {isWorking ? <DotsLoader /> : t('osrdconf:addTrainSchedule')}
          </button>
        </div>
        {errorMessagesState.length > 0
          ? (
            <AlertSNCF title={t('translation:common.error')}>
              <ul className="mt-1 mb-0">
                {errorMessagesState.map((message) => <li key={nextId()}>{message}</li>)}
              </ul>
            </AlertSNCF>
          ) : null}
      </div>
    </>
  );
}
