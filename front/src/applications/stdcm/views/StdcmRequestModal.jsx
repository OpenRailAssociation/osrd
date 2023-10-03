import React, { useEffect } from 'react';
import { cloneDeep } from 'lodash';
// osrd Redux reducers
import {
  updateConsolidatedSimulation,
  updateMustRedraw,
  updateSelectedTrainId,
  updateSimulation,
  updateSelectedProjection,
} from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import { KEY_VALUES_FOR_CONSOLIDATED_SIMULATION } from 'modules/simulationResult/components/simulationResultsConsts';
import { getConf } from 'reducers/osrdconf/selectors';
// Generic components
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import PropTypes from 'prop-types';
import ReactModal from 'react-modal';
// OSRD helpers
import createTrain from 'modules/simulationResult/components/SpaceTimeChart/createTrain';
import formatStdcmConf from 'applications/stdcm/formatStcmConf';
// Static Data and Assets
import { setFailure } from 'reducers/main';
import { STDCM_REQUEST_STATUS } from 'applications/operationalStudies/consts';
import { updateItinerary } from 'reducers/osrdconf';
import { useTranslation } from 'react-i18next';
import { Spinner } from 'common/Loader';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

export default function StdcmRequestModal(props) {
  const { t } = useTranslation([
    'translation',
    'operationalStudies/manageTrainSchedule',
    'translation',
  ]);
  const osrdconf = useSelector(getConf);
  const dispatch = useDispatch();

  const [postStdcm] = osrdEditoastApi.endpoints.postStdcm.useMutation();
  const [getTrainScheduleResults] =
    osrdEditoastApi.endpoints.getTrainScheduleResults.useLazyQuery();

  // Theses are prop-drilled from OSRDSTDCM Component, which is conductor.
  // Remains fit with one-level limit
  const { setCurrentStdcmRequestStatus, currentStdcmRequestStatus } = props;

  // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
  const controller = new AbortController();

  const timetableId = osrdconf.timetableID;

  // Returns a promise that will be a fetch or an axios (through react-query)
  const stdcmRequest = async () => {
    const params = formatStdcmConf(dispatch, setFailure, t, osrdconf);
    return postStdcm(params).unwrap();
  };

  useEffect(() => {
    if (currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending && timetableId) {
      stdcmRequest()
        .then((result) => {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
          dispatch(updateItinerary(result.path));

          const fakedNewTrain = {
            ...cloneDeep(result.simulation),
            id: 1500,
            isStdcm: true,
          };

          fakedNewTrain.base.stops = fakedNewTrain.base.head_positions[0].map(
            (headPosition, index) => ({
              id: fakedNewTrain.id,
              name: `stop ${index}`,
              time: headPosition.time,
              position: headPosition.position,
              duration: 0,
            })
          );

          getTrainScheduleResults({
            timetableId,
            pathId: result.path.id,
          })
            .unwrap()
            .then((timetableTrains) => {
              const trains = [...timetableTrains, fakedNewTrain];
              const consolidatedSimulation = createTrain(
                dispatch,
                KEY_VALUES_FOR_CONSOLIDATED_SIMULATION,
                trains,
                t
              );
              dispatch(updateConsolidatedSimulation(consolidatedSimulation));
              dispatch(updateSimulation({ trains }));
              dispatch(updateSelectedTrainId(fakedNewTrain.id));

              dispatch(
                updateSelectedProjection({
                  id: fakedNewTrain.id,
                  path: result.path,
                })
              );

              dispatch(updateMustRedraw(true));
            })
            .catch(() => {
              dispatch(
                setFailure({
                  name: t('operationalStudies/manageTrainSchedule:errorMessages.stdcmError'),
                  message: t('translation:common.error'),
                })
              );
            });
        })
        .catch((e) => {
          // Update simu in redux with data;
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);

          dispatch(
            setFailure({
              name: t('operationalStudies/manageTrainSchedule:errorMessages.stdcmError'),
              message: e?.response?.data?.message, // axios error, def is ok
            })
          );
        });
    }
  }, [currentStdcmRequestStatus]);

  const cancelStdcmRequest = () => {
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
            <h1>{t('operationalStudies/manageTrainSchedule:stdcmComputation')}</h1>
          </ModalHeaderSNCF>
          <ModalBodySNCF>
            <div className="d-flex flex-column text-center">
              {currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending && (
                <div className="d-flex align-items-center justify-content-center mb-3">
                  <span className="mr-2">
                    {t('operationalStudies/manageTrainSchedule:pleaseWait')}
                  </span>
                  <Spinner />
                </div>
              )}

              <div className="text-center p-1">
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={cancelStdcmRequest}
                >
                  {t('operationalStudies/manageTrainSchedule:cancelRequest')}
                  <span className="sr-only" aria-hidden="true">
                    {t('operationalStudies/manageTrainSchedule:cancelRequest')}
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
