import { useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';

import { STDCM_REQUEST_STATUS, STDCM_TRAIN_ID } from 'applications/stdcm/consts';
import type {
  StdcmRequestStatus,
  StdcmSuccessResponse,
  StdcmResponse,
  StdcmConflictsResponse,
  StdcmPathProperties,
} from 'applications/stdcm/types';
import {
  osrdEditoastApi,
  type Conflict,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import { setFailure } from 'reducers/main';
import { getStdcmConf } from 'reducers/osrdconf/stdcmConf/selectors';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { formatEditoastTrainIdToTrainScheduleId } from 'utils/trainId';

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
  const [stdcmTrainConflicts, setStdcmTrainConflicts] = useState<Conflict[]>();
  const [stdcmResponse, setStdcmResponse] = useState<StdcmResponse>();
  const [currentStdcmRequestStatus, setCurrentStdcmRequestStatus] = useState<StdcmRequestStatus>(
    STDCM_REQUEST_STATUS.idle
  );
  const [pathProperties, setPathProperties] = useState<StdcmPathProperties>();

  const dispatch = useAppDispatch();
  const { t } = useTranslation(['translation', 'stdcm']);
  const { getTimetableID } = useOsrdConfSelectors();
  const osrdconf = useSelector(getStdcmConf);
  const timetableId = useSelector(getTimetableID);
  const requestPromise = useRef<ReturnType<typeof postTimetableByIdStdcm>>();

  const stdcmResults = useStdcmResults(stdcmResponse, stdcmTrainResult, setPathProperties);

  const [postTimetableByIdStdcm] = osrdEditoastApi.endpoints.postTimetableByIdStdcm.useMutation();

  const { data: stdcmRollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      {
        rollingStockId: osrdconf.rollingStockID!,
      },
      { skip: !osrdconf.rollingStockID }
    );

  const { speedLimitByTag } = useStoreDataForSpeedLimitByTagSelector({ isStdcm: true });

  const resetStdcmState = () => {
    setStdcmTrainResult(undefined);
    setStdcmTrainConflicts(undefined);
    setStdcmResponse(undefined);
    setPathProperties(undefined);
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.idle);
  };

  const triggerShowFailureNotification = (error: Error) => {
    if (showFailureNotification) {
      dispatch(setFailure(error));
    }
  };

  const launchStdcmRequest = async () => {
    setStdcmResponse(undefined);
    setStdcmTrainConflicts(undefined);

    const validConfig = checkStdcmConf(dispatch, t, osrdconf);
    if (validConfig) {
      setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending);
      const payload = formatStdcmPayload(validConfig);
      try {
        const promise = postTimetableByIdStdcm(payload);
        requestPromise.current = promise;

        const response = await promise.unwrap();

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
          dispatch(updateSelectedTrainId(formatEditoastTrainIdToTrainScheduleId(STDCM_TRAIN_ID)));
        } else if (response.status === 'conflicts') {
          setStdcmResponse({
            ...response,
            rollingStock: stdcmRollingStock,
            creationDate: new Date(),
            speedLimitByTag,
            simulationPathSteps: osrdconf.stdcmPathSteps,
            path: response.pathfinding_result,
          } as StdcmConflictsResponse);
          setStdcmTrainConflicts(response.conflicts); // Set conflicts
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success); // Conflicts but still success in this case
        } else {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
          triggerShowFailureNotification({
            name: t('stdcm:stdcmErrors.requestFailed'),
            message: t('translation:common.error'),
          });
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
          triggerShowFailureNotification(
            castErrorToFailure(e, {
              name: t('stdcm:stdcmErrors.requestFailed'),
              message: t('translation:common.error'),
            })
          );
        }
      }
    }
  };

  const cancelStdcmRequest = () => {
    if (typeof requestPromise.current?.abort === 'function') {
      requestPromise.current.abort();
    }
    requestPromise.current = undefined;
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.canceled);
  };

  const isPending = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending;
  const isRejected = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.rejected;
  const isCanceled = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.canceled;
  const hasConflicts = (stdcmTrainConflicts?.length ?? 0) > 0;

  return {
    stdcmResults,
    launchStdcmRequest,
    cancelStdcmRequest,
    resetStdcmState,
    pathProperties,
    setPathProperties,
    isPending,
    isRejected,
    isCanceled,
    stdcmTrainConflicts,
    hasConflicts,
    isCalculationFailed: isRejected,
  };
};

export default useStdcm;
