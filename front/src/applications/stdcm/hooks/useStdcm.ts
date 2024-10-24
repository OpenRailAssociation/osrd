import { useState } from 'react';

import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { STDCM_REQUEST_STATUS, STDCM_TRAIN_ID } from 'applications/stdcm/consts';
import type { StdcmRequestStatus, StdcmSuccessResponse } from 'applications/stdcm/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import { setFailure } from 'reducers/main';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import useStdcmResults from './useStdcmResults';
import { checkStdcmConf, formatStdcmPayload } from '../utils/formatStdcmConf';

/**
 * Hook to manage the stdcm request
 * @param showFailureNotification boolean to show or not the failure notification.
 * Sometimes we don't want to handle failure using the default behaviour by display the snackbar.
 * We want to keep the component which call the stdcm hook to handle the failure.
 *
 * @returns object with all the necessary information to manage the stdcm request/response
 */
const useStdcm = ({
  showFailureNotification = true,
}: { showFailureNotification?: boolean } = {}) => {
  const [stdcmTrainResult, setStdcmTrainResult] = useState<TrainScheduleResult>();
  const [stdcmResponse, setStdcmResponse] = useState<StdcmSuccessResponse>();
  const [currentStdcmRequestStatus, setCurrentStdcmRequestStatus] = useState<StdcmRequestStatus>(
    STDCM_REQUEST_STATUS.idle
  );
  const [pathProperties, setPathProperties] = useState<ManageTrainSchedulePathProperties>();
  const [isStdcmResultsEmpty, setIsStdcmResultsEmpty] = useState(false);

  const dispatch = useAppDispatch();
  const { t } = useTranslation(['translation', 'stdcm']);
  const { getConf, getTimetableID } = useOsrdConfSelectors();
  const osrdconf = useSelector(getConf) as OsrdStdcmConfState;
  const timetableId = useSelector(getTimetableID);

  const stdcmResults = useStdcmResults(stdcmResponse, stdcmTrainResult, setPathProperties);

  const [postTimetableByIdStdcm] = osrdEditoastApi.endpoints.postTimetableByIdStdcm.useMutation();

  const { data: stdcmRollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      {
        rollingStockId: osrdconf.rollingStockID!,
      },
      { skip: !osrdconf.rollingStockID }
    );

  // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
  const controller = new AbortController();

  const { speedLimitByTag } = useStoreDataForSpeedLimitByTagSelector({ isStdcm: true });

  const triggerShowFailureNotification = (error: Error) => {
    if (showFailureNotification) {
      dispatch(setFailure(error));
    }
  };

  const launchStdcmRequest = async () => {
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending);
    setIsStdcmResultsEmpty(false);
    setStdcmResponse(undefined);

    const validConfig = checkStdcmConf(dispatch, t, osrdconf);
    if (validConfig) {
      const payload = formatStdcmPayload(validConfig);
      try {
        const response = await postTimetableByIdStdcm(payload).unwrap();
        if (
          response.status === 'success' &&
          response.simulation.status === 'success' &&
          stdcmRollingStock
        ) {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
          setStdcmResponse({
            ...response,
            rollingStock: stdcmRollingStock,
            creationDate: new Date(),
            speedLimitByTag,
            simulationPathSteps: osrdconf.stdcmPathSteps,
          } as StdcmSuccessResponse);

          const stdcmTrain: TrainScheduleResult = {
            id: STDCM_TRAIN_ID,
            timetable_id: timetableId!,
            comfort: payload.body.comfort,
            constraint_distribution: 'MARECO',
            path: payload.body.steps.map((step) => ({ ...step.location, id: nextId() })),
            rolling_stock_name: stdcmRollingStock.name,
            start_time: response.departure_time,
            train_name: 'stdcm',
          };
          setStdcmTrainResult(stdcmTrain);
          dispatch(updateSelectedTrainId(STDCM_TRAIN_ID));
        } else {
          // When the back-end send back result with status 'path_not_found' we consider that the result is empty
          setIsStdcmResultsEmpty(response.status === 'path_not_found');
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
          triggerShowFailureNotification({
            name: t('stdcm:stdcmErrors.requestFailed'),
            message: t('translation:common.error'),
          });
        }
      } catch (e) {
        setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
        triggerShowFailureNotification(
          castErrorToFailure(e, { name: t('stdcm:stdcmErrors.requestFailed') })
        );
      }
    } else {
      setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
    }
  };

  const cancelStdcmRequest = () => {
    // when http ready https://axios-http.com/docs/cancellation

    controller.abort();
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.canceled);
  };

  const isPending = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending;
  const isSuccessful = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.success;
  const isRejected = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.rejected;

  return {
    stdcmResults,
    launchStdcmRequest,
    currentStdcmRequestStatus,
    cancelStdcmRequest,
    pathProperties,
    setPathProperties,
    isPending,
    isSuccessful,
    isRejected,
    isStdcmResultsEmpty,
  };
};

export default useStdcm;
