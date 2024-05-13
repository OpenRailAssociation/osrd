import React, { useEffect } from 'react';

import { cloneDeep } from 'lodash';
import { useTranslation } from 'react-i18next';
import ReactModal from 'react-modal';
import { useSelector } from 'react-redux';

import STDCM_REQUEST_STATUS from 'applications/stdcm/consts';
import formatStdcmConf from 'applications/stdcm/formatStdcmConf';
import type { StdcmRequestStatus, StdcmV2SuccessResponse } from 'applications/stdcm/types';
import type { PostStdcmApiResponse, SimulationReport } from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { Spinner } from 'common/Loaders';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import createTrain from 'modules/simulationResult/components/SpaceTimeChart/createTrain';
import { CHART_AXES } from 'modules/simulationResult/consts';
import { setFailure } from 'reducers/main';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import {
  updateConsolidatedSimulation,
  updateSelectedTrainId,
  updateSimulation,
  updateSelectedProjection,
} from 'reducers/osrdsimulation/actions';
import type { Train } from 'reducers/osrdsimulation/types';
import { getTrainScheduleV2Activated } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import { checkStdcmConf, formatStdcmPayload } from '../utils/formatStdcmConfV2';

type StdcmRequestModalProps = {
  setCurrentStdcmRequestStatus: (currentStdcmRequestStatus: StdcmRequestStatus) => void;
  currentStdcmRequestStatus: StdcmRequestStatus;
  setStdcmResults: (stdcmResults: PostStdcmApiResponse) => void;
  setStdcmV2Results: (stdcmV2Results: StdcmV2SuccessResponse | undefined) => void;
};

const StdcmRequestModal = ({
  setCurrentStdcmRequestStatus,
  currentStdcmRequestStatus,
  setStdcmResults,
  setStdcmV2Results,
}: StdcmRequestModalProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['translation', 'stdcm']);
  const { getConf } = useOsrdConfSelectors();
  const trainScheduleV2Activated = useSelector(getTrainScheduleV2Activated);
  const osrdconf = useSelector(getConf);

  const [postStdcm] = osrdEditoastApi.endpoints.postStdcm.useMutation();
  const [postV2TimetableByIdStdcm] =
    osrdEditoastApi.endpoints.postV2TimetableByIdStdcm.useMutation();
  const [postTrainScheduleResults] =
    osrdEditoastApi.endpoints.postTrainScheduleResults.useMutation();

  const [getTimetable] = osrdEditoastApi.endpoints.getTimetableById.useLazyQuery();

  const { updateItinerary } = useOsrdConfActions();

  // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
  const controller = new AbortController();

  const { timetableID } = osrdconf;

  useEffect(() => {
    const launchStdcmRequest = async () => {
      const payload = formatStdcmConf(dispatch, t, osrdconf as OsrdStdcmConfState);
      if (payload && timetableID) {
        postStdcm(payload)
          .unwrap()
          .then((result) => {
            setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
            setStdcmResults(result);
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
                    CHART_AXES.SPACE_TIME,
                    trains as Train[] // TODO: remove Train interface
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
                .catch((e) => {
                  dispatch(
                    setFailure(
                      castErrorToFailure(e, {
                        name: t('stdcm:stdcmError'),
                        message: t('translation:common.error'),
                      })
                    )
                  );
                });
            });
          })
          .catch((e) => {
            setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
            dispatch(setFailure(castErrorToFailure(e, { name: t('stdcm:stdcmError') })));
          });
      }
    };

    const launchStdcmRequestV2 = async () => {
      const validConfig = checkStdcmConf(dispatch, t, osrdconf as OsrdStdcmConfState);
      if (validConfig) {
        const payload = formatStdcmPayload(validConfig);
        try {
          const response = await postV2TimetableByIdStdcm(payload).unwrap();
          if (response.status === 'success') {
            setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
            setStdcmV2Results(response);
          } else {
            setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
            dispatch(
              setFailure({
                name: t('stdcm:stdcmError'),
                message: t('translation:common.error'),
              })
            );
          }
        } catch (e) {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
          dispatch(setFailure(castErrorToFailure(e, { name: t('stdcm:stdcmError') })));
        }
      }
    };

    if (currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending) {
      if (trainScheduleV2Activated) {
        launchStdcmRequestV2();
      } else {
        launchStdcmRequest();
      }
    }
  }, [currentStdcmRequestStatus]);

  const cancelStdcmRequest = () => {
    // when http ready https://axios-http.com/docs/cancellation

    controller.abort();
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.canceled);

    const emptySimulation = { trains: [] };
    const consolidatedSimulation = createTrain(CHART_AXES.SPACE_TIME, emptySimulation.trains);
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
};

export default StdcmRequestModal;
