import React, { useEffect, useRef } from 'react';
import { updateConsolidatedSimulation, updateSimulation } from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import { KEY_VALUES_FOR_CONSOLIDATED_SIMULATION } from 'applications/osrd/views/OSRDSimulation/OSRDSimulation';
import Loader from 'common/Loader';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import PropTypes from 'prop-types';
import axios from 'axios';
import createTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/createTrain';
import fakeSimulation from '../fakeSimulation';
import rabbit from 'assets/pictures/KLCW_nc_standard.png';
import { stdcmRequestStatus } from 'applications/stdcm/views/OSRDSTDCM';
import { useTranslation } from 'react-i18next';

export default function StdcmRequestModal(props) {
  const { t } = useTranslation(['translation', 'osrdconf']);
  const dispatch = useDispatch();

  const { setCurrentStdcmRequestStatus, currentStdcmRequestStatus } = props;

  // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
  const controller = new AbortController();

  // Returns a promise that will be a fetch or an axios (through react-query)
  const stdcmRequest = async () => {
    try {
      const fakeRequest = new Promise((resolve, reject) => {
        const fakeTener = setTimeout(() => {
           resolve(fakeSimulation);
        }, 6000);

        controller.signal.addEventListener('abort', () => {
          console.log('abort mess');
          clearTimeout(fakeTener);
          setCurrentStdcmRequestStatus(stdcmRequestStatus.canceled);
        });
      });

      return fakeRequest;
      // When http ready, do:
      /*
      // build the request and update on await result

      // manage rejected (400) status
      */
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (currentStdcmRequestStatus === stdcmRequestStatus.pending) {
      stdcmRequest().then((result) => {
        // Update simu in redux with data;
        setCurrentStdcmRequestStatus(stdcmRequestStatus.success);

        // Attention: we need these two object in store to be update. the simulation->consolidated simulaion is usually done by OSRDSimulation, which is bad.
        const consolidatedSimulation = (
          createTrain(dispatch, KEY_VALUES_FOR_CONSOLIDATED_SIMULATION, result.trains, t));
        dispatch(updateConsolidatedSimulation(consolidatedSimulation));
        dispatch(updateSimulation(result));
        // Close the modal
        console.log('Accomplished Promise');
      }).catch((e) => {
        // Update simu in redux with data;
        // Close the modal
        setCurrentStdcmRequestStatus(stdcmRequestStatus.rejected);
        console.log('rejected Promise', e);
      });
    }
  }, [currentStdcmRequestStatus]);

  const cancelStdcmRequest = (e) => {
    console.log('cancel request');
    // when http ready https://axios-http.com/docs/cancellation
    // cancelTokenSource.current.cancel();
    controller.abort();
    setCurrentStdcmRequestStatus(stdcmRequestStatus.canceled);

    const emptySimulation = { trains: [] };
    const consolidatedSimulation = (
      createTrain(dispatch, KEY_VALUES_FOR_CONSOLIDATED_SIMULATION, emptySimulation.trains, t));
    dispatch(updateConsolidatedSimulation(consolidatedSimulation));
    dispatch(updateSimulation(emptySimulation));
  };

  const simulateNoResults = (e) => {
    console.log('no results');

    controller.abort();

    const emptySimulation = { trains: [] };
    const consolidatedSimulation = (
      createTrain(dispatch, KEY_VALUES_FOR_CONSOLIDATED_SIMULATION, emptySimulation.trains, t));
    dispatch(updateConsolidatedSimulation(consolidatedSimulation));
    dispatch(updateSimulation(emptySimulation));

    setCurrentStdcmRequestStatus(stdcmRequestStatus.noresults);
  };

  return (
    <ModalSNCF htmlID="stdcmRequestModal">
      <ModalHeaderSNCF>
        <h1>{t('osrdconf:stdcmComputation')}</h1>
        <button className="btn btn-only-icon close" type="button" data-dismiss="modal">
          <i className="icons-close" />
        </button>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="d-flex flex-column text-center">

          { currentStdcmRequestStatus === stdcmRequestStatus.pending
          && (
            <>
             <div className="">
            <img src={rabbit} width="50%" />
          </div>
          <div className="p-1 text-info">
            {t('osrdconf:searchingItinerary')}
          </div>
              <div className="p-1 text-info">
                {t('osrdconf:pleaseWait')}
              </div>
              <div className="p-1">
                <div className="spinner-border" role="status">
                  <span className="sr-only">Loading...</span>
                </div>
              </div>
            </>
          ) }

          <div className="text-center p-1">
            <button className="btn btn-sm btn-primary " type="button" onClick={cancelStdcmRequest}>
              {t('osrdconf:cancelRequest')}
              <span className="sr-only" aria-hidden="true">{t('osrdconf:cancelRequest')}</span>
            </button>
          </div>
          { currentStdcmRequestStatus === stdcmRequestStatus.canceled
          && (
          <div className="text-center p-1">
            <button className="btn btn-sm btn-primary " type="button" onClick={simulateNoResults}>
              SimulateNoResults
              <span className="sr-only" aria-hidden="true">SimulateNoResults</span>
            </button>
          </div>
          )
}
        </div>
      </ModalBodySNCF>

    </ModalSNCF>
  );
}
