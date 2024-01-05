import React, { useEffect } from 'react';
import { cloneDeep } from 'lodash';
// osrd Redux reducers
import {
  updateConsolidatedSimulation,
  updateSelectedTrainId,
  updateSimulation,
  updateSelectedProjection,
} from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import { CHART_AXES } from 'modules/simulationResult/consts';
// Generic components
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ReactModal from 'react-modal';
// OSRD helpers
import createTrain from 'modules/simulationResult/components/SpaceTimeChart/createTrain';
import formatStdcmConf from 'applications/stdcm/formatStdcmConf';
// Static Data and Assets
import { setFailure } from 'reducers/main';
import STDCM_REQUEST_STATUS from 'applications/stdcm/consts';
import { useTranslation } from 'react-i18next';
import { Spinner } from 'common/Loaders';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { SimulationReport } from 'common/api/osrdEditoastApi';
import type { StdcmRequestStatus } from 'applications/stdcm/types';
import { extractMessageFromError, extractStatusFromError } from 'utils/error';
import { Train } from 'reducers/osrdsimulation/types';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/consts';

type StdcmRequestModalProps = {
  setCurrentStdcmRequestStatus: (currentStdcmRequestStatus: StdcmRequestStatus) => void;
  currentStdcmRequestStatus: StdcmRequestStatus;
};

export default function StdcmRequestModal(props: StdcmRequestModalProps) {
  const { t } = useTranslation(['translation', 'stdcm']);
  const { getConf } = useOsrdConfSelectors();
  const osrdconf = useSelector(getConf);
  const dispatch = useDispatch();

  const [postStdcm] = osrdEditoastApi.endpoints.postStdcm.useMutation();
  const [postTrainScheduleResults] =
    osrdEditoastApi.endpoints.postTrainScheduleResults.useMutation();

  const [getTimetable] = osrdEditoastApi.endpoints.getTimetableById.useLazyQuery();

  const { updateItinerary } = useOsrdConfActions();

  // Theses are prop-drilled from OSRDSTDCM Component, which is conductor.
  // Remains fit with one-level limit
  const { setCurrentStdcmRequestStatus, currentStdcmRequestStatus } = props;

  // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
  const controller = new AbortController();

  const { timetableID } = osrdconf;

  useEffect(() => {
    const payload = formatStdcmConf(dispatch, t, osrdconf as OsrdStdcmConfState);
    if (payload && currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending && timetableID) {
      postStdcm(payload)
        .unwrap()
        .then((result) => {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
          if ('path' in result && 'simulation' in result) {
            dispatch(updateItinerary(result.path));

            const fakedNewTrain = {
              ...cloneDeep(result.simulation),
              id: 1500,
              isStdcm: true,
            };
            getTimetable({ id: timetableID }).then(({ data: timetable }) => {
              const trainIdsToFetch =
                timetable?.train_schedule_summaries.map((train) => train.id) ?? [];
              postTrainScheduleResults({
                body: {
                  path_id: result.path.id,
                  train_ids: trainIdsToFetch,
                },
              })
                .unwrap()
                .then((timetableTrains) => {
                  const trains: SimulationReport[] = [
                    ...timetableTrains.simulations,
                    fakedNewTrain,
                  ];
                  const consolidatedSimulation = createTrain(
                    dispatch,
                    CHART_AXES.SPACE_TIME,
                    trains as Train[], // TODO: remove Train interface
                    t
                  );
                  dispatch(updateConsolidatedSimulation(consolidatedSimulation));
                  dispatch(updateSimulation({ trains }));
                  dispatch(updateSelectedTrainId(fakedNewTrain.id));

                  dispatch(
                    updateSelectedProjection({
                      id: fakedNewTrain.id,
                      path: result.path.id,
                    })
                  );
                })
                .catch(() => {
                  dispatch(
                    setFailure({
                      name: t('stdcm:stdcmError'),
                      message: t('translation:common.error'),
                    })
                  );
                });
            });
          }
        })
        .catch((e) => {
          const errorMessage = extractMessageFromError(e);
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
          dispatch(
            setFailure({
              name: t('stdcm:stdcmError'),
              message:
                extractStatusFromError(e) === 400 && errorMessage === 'No path could be found'
                  ? t('stdcm:stdcmErrorNoPaths')
                  : errorMessage,
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
      CHART_AXES.SPACE_TIME,
      emptySimulation.trains,
      t
    );
    dispatch(updateConsolidatedSimulation(consolidatedSimulation));
    dispatch(updateSimulation(emptySimulation));
  };

  return (
    <ReactModal
      isOpen={currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending}
      id="stdcmRequestModal"
      className="modal-dialog-centered"
      style={{ overlay: { zIndex: 3 } }}
      ariaHideApp={false}
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <ModalHeaderSNCF>
            <h1>{t('stdcm:stdcmComputation')}</h1>
          </ModalHeaderSNCF>
          <ModalBodySNCF>
            <div className="d-flex flex-column text-center">
              {currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending && (
                <div className="d-flex align-items-center justify-content-center mb-3">
                  <span className="mr-2">{t('stdcm:pleaseWait')}</span>
                  <Spinner />
                </div>
              )}

              <div className="text-center p-1">
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={cancelStdcmRequest}
                >
                  {t('stdcm:cancelRequest')}
                  <span className="sr-only" aria-hidden="true">
                    {t('stdcm:cancelRequest')}
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
