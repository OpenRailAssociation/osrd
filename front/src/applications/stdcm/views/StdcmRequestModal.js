import React, { useEffect } from 'react';
// osrd Redux reducers
import { updateConsolidatedSimulation, updateSimulation } from 'reducers/osrdsimulation';

import { KEY_VALUES_FOR_CONSOLIDATED_SIMULATION } from 'applications/osrd/views/OSRDSimulation/OSRDSimulation';
// Generic components
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import PropTypes from 'prop-types';
import ReactModal from 'react-modal';
// OSRD helpers
import createTrain from 'applications/osrd/components/Simulation/SpaceTimeChart/createTrain';
import fakeSimulation from 'applications/stdcm/fakeSimulation';
// Static Data and Assets
import rabbit from 'assets/pictures/KLCW_nc_standard.png';
import { stdcmRequestStatus } from 'applications/stdcm/views/OSRDSTDCM';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

export default function StdcmRequestModal(props) {
  const { t } = useTranslation(['translation', 'osrdconf']);
  const dispatch = useDispatch();

  /*
  NICOLAS WURTZ REMINDER:
  THE MODAL (react) is now open when currentStdcmRequestStatus == pending.
  To adapt these to real data behavior
  1 / stdcmRequest method: retun an axios query which can be canceled. l46-46 resolve with results (simulation data)
  2 / Maange empty results (setCurrentStdcmRequestStatus with stdcmRequestStatus.noResults )
  3 / Manage rejected (400, 501 ?) stdcmRequestStatus.rejected
  4/ manage cancelation from axios inide the 49-50 abort event listener or the l99+ cancelStdcmRequest method
  */

  // Theses are prop-drilled from OSRDSTDCM Component, which is conductor.
  // Remains fit with one-level limit
  const { setCurrentStdcmRequestStatus, currentStdcmRequestStatus } = props;

  // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
  const controller = new AbortController();

  // Returns a promise that will be a fetch or an axios (through react-query)
  const stdcmRequest = async () => {
    try {
      const fakeRequest = new Promise((resolve, reject) => {
        const fakeTener = setTimeout(() => {
          resolve(fakeSimulation);
        }, 5000);

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
    return null;
  };

  useEffect(() => {
    if (currentStdcmRequestStatus === stdcmRequestStatus.pending) {
      stdcmRequest()
        .then((result) => {
          // Update simu in redux with data;
          setCurrentStdcmRequestStatus(stdcmRequestStatus.success);

          // Attention: we need these two object in store to be update. the simulation->consolidated simulaion is usually done by OSRDSimulation, which is bad.
          const consolidatedSimulation = createTrain(
            dispatch,
            KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
            result.trains,
            t
          );
          dispatch(updateConsolidatedSimulation(consolidatedSimulation));
          dispatch(updateSimulation(result));

          console.log('Accomplished Promise');
        })
        .catch((e) => {
          // Update simu in redux with data;

          setCurrentStdcmRequestStatus(stdcmRequestStatus.rejected);
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

  const simulateNoResults = () => {
    console.log('no results');

    controller.abort();

    const emptySimulation = { trains: [] };
    const consolidatedSimulation = createTrain(
      dispatch,
      KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
      emptySimulation.trains,
      t
    );
    dispatch(updateConsolidatedSimulation(consolidatedSimulation));
    dispatch(updateSimulation(emptySimulation));

    setCurrentStdcmRequestStatus(stdcmRequestStatus.noresults);
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
              <div className="text-center p-1">
                <button
                  className="btn btn-sm btn-primary "
                  type="button"
                  onClick={simulateNoResults}
                >
                  SimulateNoResults
                  <span className="sr-only" aria-hidden="true">
                    SimulateNoResults
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
