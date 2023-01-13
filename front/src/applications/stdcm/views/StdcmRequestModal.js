import React, { useEffect } from 'react';
import { get, post } from 'common/requests';
// osrd Redux reducers
import {
  updateAllowancesSettings,
  updateConsolidatedSimulation,
  updateMustRedraw,
  updateSelectedTrain,
  updateSimulation,
  updateSelectedProjection,
} from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import {
  KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
  trainscheduleURI,
} from 'applications/operationalStudies/components/Simulation/consts';

// Generic components
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import PropTypes from 'prop-types';
import ReactModal from 'react-modal';
// OSRD helpers
import createTrain from 'applications/operationalStudies/components/Simulation/SpaceTimeChart/createTrain';
import formatStdcmConf from 'applications/stdcm/formatStcmConf';
// Static Data and Assets
import rabbit from 'assets/pictures/KLCW_nc_standard.png';
import { setFailure } from 'reducers/main';
import { STDCM_REQUEST_STATUS } from 'applications/operationalStudies/consts';
import { updateItinerary } from 'reducers/osrdconf';
import { useTranslation } from 'react-i18next';

const timetableURI = '/timetable/';

export default function StdcmRequestModal(props) {
  const { t } = useTranslation(['translation', 'osrdconf']);
  const osrdconf = useSelector((state) => state.osrdconf);

  const { allowancesSettings } = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();

  // Theses are prop-drilled from OSRDSTDCM Component, which is conductor.
  // Remains fit with one-level limit
  const { setCurrentStdcmRequestStatus, currentStdcmRequestStatus } = props;

  // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
  const controller = new AbortController();

  const stdcmURL = `/stdcm/`;

  // Returns a promise that will be a fetch or an axios (through react-query)
  const stdcmRequest = async () => {
    const params = formatStdcmConf(dispatch, setFailure, t, osrdconf);

    return post(stdcmURL, params, {});
  };

  useEffect(() => {
    if (currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending) {
      stdcmRequest()
        .then((result) => {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
          dispatch(updateItinerary(result.path));

          const fakedNewTrain = result.simulation;
          fakedNewTrain.id = 1500;
          fakedNewTrain.isStdcm = true;

          fakedNewTrain.base.stops = fakedNewTrain.base.head_positions[0].map(
            (headPosition, index) => ({
              id: fakedNewTrain.id,
              name: `stop ${index}`,
              time: headPosition.time,
              position: headPosition.position,
              duration: 0,
            })
          );

          // ask for timetable with the new path
          get(`${timetableURI}${osrdconf.timetableID}/`).then((timetable) => {
            const trainIds = timetable.train_schedules.map((train_schedule) => train_schedule.id);
            get(`${trainscheduleURI}results/`, {
              train_ids: trainIds.join(','),
              path: result.path.id,
            }).then((simulationLocal) => {
              const newSimulation = {};
              newSimulation.trains = [...simulationLocal];
              newSimulation.trains = [...newSimulation.trains, fakedNewTrain];
              const consolidatedSimulation = createTrain(
                dispatch,
                KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
                newSimulation.trains,
                t
              );
              dispatch(updateConsolidatedSimulation(consolidatedSimulation));
              dispatch(updateSimulation(newSimulation));
              dispatch(updateSelectedTrain(newSimulation.trains.length - 1));

              // Create margins settings for each train if not set
              const newAllowancesSettings = { ...allowancesSettings };
              simulationLocal.forEach((train) => {
                if (!newAllowancesSettings[train.id]) {
                  newAllowancesSettings[train.id] = {
                    base: true,
                    baseBlocks: true,
                    eco: true,
                    ecoBlocks: false,
                  };
                }
              });

              if (!newAllowancesSettings[fakedNewTrain.id]) {
                newAllowancesSettings[fakedNewTrain.id] = {
                  base: true,
                  baseBlocks: true,
                  eco: true,
                  ecoBlocks: false,
                };
                dispatch(updateAllowancesSettings(newAllowancesSettings));
              }

              dispatch(
                updateSelectedProjection({
                  id: fakedNewTrain.id,
                  path: result.path,
                })
              );

              dispatch(updateMustRedraw(true));
            });
          });
        })
        .catch((e) => {
          // Update simu in redux with data;

          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);

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
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.canceled);

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
      isOpen={currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending}
      htmlID="stdcmRequestModal"
      className="modal-dialog-centered"
      style={{ overlay: { zIndex: 3 } }}
      ariaHideApp={false}
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
              {currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending && (
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
