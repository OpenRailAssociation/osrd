import {
  KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
  timetableURI,
  trainscheduleURI,
} from 'applications/osrd/views/OSRDSimulation/OSRDSimulation';
import React, { useEffect, useState } from 'react';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { setFailure, setSuccess } from 'reducers/main.ts';
// osrd Redux reducers
import {
  updateAllowancesSettings,
  updateConsolidatedSimulation,
  updateMustRedraw,
  updateSelectedProjection,
  updateSelectedTrain,
  updateSimulation,
} from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import { MAIN_API } from 'config/config';
// Generic components
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import PropTypes from 'prop-types';
import ReactModal from 'react-modal';
// OSRD helpers
import createTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/createTrain';
import fakeSimulation from 'applications/stdcm/fakeSimulation';
import formatStdcmConf from 'applications/stdcm/formatStcmConf';
// Static Data and Assets
import rabbit from 'assets/pictures/KLCW_nc_standard.png';
import { stdcmRequestStatus } from 'applications/stdcm/views/OSRDSTDCM';
import { useTranslation } from 'react-i18next';

export default function StdcmRequestModal(props) {
  const { t } = useTranslation(['translation', 'osrdconf']);
  const osrdconf = useSelector((state) => state.osrdconf);
  const { timetableID } = useSelector((state) => state.osrdconf);
  const { allowancesSettings, selectedProjection } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const dispatch = useDispatch();


  // Theses are prop-drilled from OSRDSTDCM Component, which is conductor.
  // Remains fit with one-level limit
  const { setCurrentStdcmRequestStatus, currentStdcmRequestStatus } = props;

  // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
  const controller = new AbortController();

  const stdcmURL = `${MAIN_API.proxy}/stdcm/`;

  // Returns a promise that will be a fetch or an axios (through react-query)
  const stdcmRequest = async () => {
    const params = formatStdcmConf(dispatch, setFailure, t, osrdconf);

    return axios.post(stdcmURL, params, {});
  };

  useEffect(() => {
    if (currentStdcmRequestStatus === stdcmRequestStatus.pending) {
      stdcmRequest()
        .then((result) => {
          setCurrentStdcmRequestStatus(stdcmRequestStatus.success);

          // Attention: we need these two object in store to be update. the simulation->consolidated simulaion is usually done by OSRDSimulation, which is bad.

          // We need to adapt the result simulation data to the format needed for the timetable and the speedspace diagram

          const fakedNewTrain = result.data.simulation;
          fakedNewTrain.id = 1500;

          fakedNewTrain.base.stops = fakedNewTrain.base.head_positions[0].map(
            (headPosition, index) => ({
              id: 1500,
              name: `stop ${index}`,
              time: headPosition.time,
              position: headPosition.position,
              duration: 0,
            })
          );

          const newSimulation = { ...simulation };

          console.log('simulation clone', newSimulation);

          newSimulation.trains = [...newSimulation.trains, fakedNewTrain];

          //const newSimulationsTrains = [...simulation.trains, fakedNewTrain]

          const newAllowancesSettings = { ...allowancesSettings };

          if (!newAllowancesSettings[1500]) {
            newAllowancesSettings[1500] = {
              base: true,
              baseBlocks: true,
              eco: true,
              ecoBlocks: false,
            };
          }

          dispatch(updateAllowancesSettings(newAllowancesSettings));

          dispatch(updateMustRedraw(true));

          console.log(newSimulation);

          const consolidatedSimulation = createTrain(
            dispatch,
            KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
            newSimulation.trains,
            t
          );
          dispatch(updateConsolidatedSimulation(consolidatedSimulation));
          dispatch(updateSimulation(newSimulation));
          dispatch(updateSelectedTrain(newSimulation.trains.length - 1));

          console.log('Accomplished Promise', result);
        })
        .catch((e) => {
          // Update simu in redux with data;

          setCurrentStdcmRequestStatus(stdcmRequestStatus.rejected);

          dispatch(
            setFailure({
              name: t('osrdconf:errorMessages.stdcmError'),
              message: e?.response?.data?.message, // axios error, def is ok
            })
          );

          console.log('rejected Promise', e);
        });
    }
  }, [currentStdcmRequestStatus]);

  const cancelStdcmRequest = () => {
    console.log('cancel request');
    // when http ready https://axios-http.com/docs/cancellation

    controller.abort();
    setCurrentStdcmRequestStatus(stdcmRequestStatus.canceled);

    const emptySimulation = { trains: [] };
    const consolidatedSimulation = createTrain(
      dispatch,
      KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
      emptySimulation.trains,
      t
    );
    dispatch(updateConsolidatedSimulation(consolidatedSimulation));
    dispatch(updateSimulation(emptySimulation));
  };

  return (
    <ReactModal
      isOpen={currentStdcmRequestStatus === stdcmRequestStatus.pending}
      htmlID="stdcmRequestModal"
      className="modal-dialog-centered"
      style={{ overlay: { zIndex: 3 } }}
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <ModalHeaderSNCF>
            <h1>{t('osrdconf:stdcmComputation')}</h1>
            <button className="btn btn-only-icon close" type="button" onClick={cancelStdcmRequest}>
              <i className="icons-close" />
            </button>
          </ModalHeaderSNCF>
          <ModalBodySNCF>
            <div className="d-flex flex-column text-center">
              {currentStdcmRequestStatus === stdcmRequestStatus.pending && (
                <>
                  <div className="">
                    <img src={rabbit} alt="runnning stdcm" width="50%" />
                  </div>
                  <div className="p-1 text-info">{t('osrdconf:searchingItinerary')}</div>
                  <div className="p-1 text-info">{t('osrdconf:pleaseWait')}</div>
                  <div className="p-1">
                    <div className="spinner-border" role="status">
                      <span className="sr-only">Loading...</span>
                    </div>
                  </div>
                </>
              )}

              <div className="text-center p-1">
                <button
                  className="btn btn-sm btn-primary "
                  type="button"
                  onClick={cancelStdcmRequest}
                >
                  {t('osrdconf:cancelRequest')}
                  <span className="sr-only" aria-hidden="true">
                    {t('osrdconf:cancelRequest')}
                  </span>
                </button>
              </div>
            </div>
          </ModalBodySNCF>
        </div>
      </div>
    </ReactModal>
  );
}

StdcmRequestModal.propTypes = {
  setCurrentStdcmRequestStatus: PropTypes.func.isRequired,
  currentStdcmRequestStatus: PropTypes.string.isRequired,
};
