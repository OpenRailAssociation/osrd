import { useRef, useState } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { v4 as uuidV4 } from 'uuid';

import {
  STDCM_REQUEST_STATUS,
  STDCM_TRAIN_ID,
  STDCM_TRAIN_TIMETABLE_ID,
} from 'applications/stdcm/consts';
import type {
  StdcmRequestStatus,
  StdcmSimulation,
  StdcmSimulationInputs,
  StdcmSuccessResponse,
} from 'applications/stdcm/types';
import {
  osrdEditoastApi,
  type PostTimetableByIdStdcmApiArg,
  type PostTimetableByIdStdcmApiResponse,
  type RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import { setFailure } from 'reducers/main';
import { addStdcmSimulations } from 'reducers/osrdconf/stdcmConf';
import { getStdcmConf, getStdcmInfraID } from 'reducers/osrdconf/stdcmConf/selectors';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
import { castErrorToFailure } from 'utils/error';
import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import useStdcmForm from './useStdcmForm';
import { adjustInputByDirection, adjustPayloadByDirection } from '../utils/adjustSimulationInputs';
import fetchPathProperties from '../utils/fetchPathProperties';
import { checkStdcmConf, formatStdcmPayload } from '../utils/formatStdcmConf';
import computeChartData from '../utils/stdcmComputeChartData';

/**
 * Hook to manage the stdcm request with integrated results and chart data handling.
 */
const useStdcm = ({
  showFailureNotification = true,
}: { showFailureNotification?: boolean } = {}) => {
  const [currentStdcmRequestStatus, setCurrentStdcmRequestStatus] = useState<StdcmRequestStatus>(
    STDCM_REQUEST_STATUS.idle
  );

  const dispatch = useAppDispatch();
  const { t } = useTranslation(['translation', 'stdcm']);
  const dateTimeLocale = useDateTimeLocale();
  const osrdconf = useSelector(getStdcmConf);
  const infraId = useSelector(getStdcmInfraID);
  const requestPromise = useRef<ReturnType<typeof postTimetableByIdStdcm>[]>(null);
  const isCancelledRef = useRef(false);

  const currentSimulationInputs = useStdcmForm();

  const [postTimetableByIdStdcm] = osrdEditoastApi.endpoints.postTimetableByIdStdcm.useMutation();

  const { data: stdcmRollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      osrdconf.rollingStockID ? { rollingStockId: osrdconf.rollingStockID } : skipToken
    );

  useStoreDataForSpeedLimitByTagSelector({
    isStdcm: true,
    speedLimitByTag: osrdconf.speedLimitByTag,
  });

  const resetStdcmState = () => {
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.idle);
  };

  const triggerShowFailureNotification = (error: Error) => {
    if (showFailureNotification) {
      dispatch(setFailure(error));
    }
  };

  const createSimulation = async (
    inputs: StdcmSimulationInputs,
    payload: PostTimetableByIdStdcmApiArg,
    response: Extract<PostTimetableByIdStdcmApiResponse, { status: 'success' | 'path_not_found' }>,
    alternativePath?: 'upstream' | 'downstream'
  ): Promise<Omit<StdcmSimulation, 'index'>> => {
    const creationDate = new Date();
    let outputs;
    // If the response is successful compute the chart data.
    if (response.status === 'success') {
      const formattedResponse = {
        ...response,
        rollingStock: stdcmRollingStock,
        creationDate,
        speedLimitByTag: osrdconf.speedLimitByTag,
        simulationPathSteps: osrdconf.stdcmPathSteps,
      } as StdcmSuccessResponse;
      const pathProperties = await fetchPathProperties(
        formattedResponse.pathfinding_result,
        infraId,
        dispatch
      );
      const stdcmTrain: TimetableItem = {
        id: formatEditoastIdToTrainScheduleId(STDCM_TRAIN_ID),
        comfort: payload.body.comfort,
        constraint_distribution: 'MARECO',
        path: payload.body.steps.map((step) => ({ ...step.location, id: uuidV4() })),
        rolling_stock_name: stdcmRollingStock!.name,
        start_time: formattedResponse.departure_time,
        train_name: 'stdcm',
      };
      const chartData = computeChartData(
        formattedResponse,
        stdcmTrain,
        t,
        stdcmRollingStock as RollingStockWithLiveries,
        pathProperties
      );
      outputs = {
        pathProperties,
        results: formattedResponse,
        speedDistanceDiagramData: chartData,
      };
    } else {
      outputs = response;
    }

    return {
      creationDate,
      inputs,
      outputs,
      alternativePath,
    };
  };

  const handleRejection = (error: unknown) => {
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
    triggerShowFailureNotification(
      castErrorToFailure(error, {
        name: t('stdcm:stdcmErrors.requestFailed'),
        message: t('translation:common.error'),
      })
    );
  };

  const handleSuccess = async (
    response: Extract<PostTimetableByIdStdcmApiResponse, { status: 'success' }>,
    payload: PostTimetableByIdStdcmApiArg
  ) => {
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
    dispatch(updateSelectedTrainId(STDCM_TRAIN_TIMETABLE_ID));

    const simulation = await createSimulation(currentSimulationInputs, payload, response);
    if (isCancelledRef.current) return;
    dispatch(addStdcmSimulations([simulation]));
  };

  const handlePathNotFound = async (
    response: Extract<PostTimetableByIdStdcmApiResponse, { status: 'path_not_found' }>,
    payload: PostTimetableByIdStdcmApiArg
  ) => {
    const simulationsToAdd: Omit<StdcmSimulation, 'index'>[] = [];
    try {
      const currentSimulation = await createSimulation(currentSimulationInputs, payload, response);
      simulationsToAdd.push(currentSimulation);

      setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending_additional);

      const payloadUpstream = adjustPayloadByDirection(payload, 'upstream');
      const payloadDownstream = adjustPayloadByDirection(payload, 'downstream');

      const promiseUpstream = postTimetableByIdStdcm(payloadUpstream);
      const promiseDownstream = postTimetableByIdStdcm(payloadDownstream);
      requestPromise.current = [promiseUpstream, promiseDownstream];

      // Run two additional requests for alternative simulations
      const [resUp, resDown] = await Promise.all([
        promiseUpstream.unwrap(),
        promiseDownstream.unwrap(),
      ]);

      if (
        resUp.status === 'preprocessing_simulation_error' ||
        resDown.status === 'preprocessing_simulation_error'
      ) {
        throw new Error('Error in response');
      }

      dispatch(updateSelectedTrainId(STDCM_TRAIN_TIMETABLE_ID));

      if (!isCancelledRef.current) {
        const upstreamInputs = adjustInputByDirection(currentSimulationInputs, 'upstream');
        const downstreamInputs = adjustInputByDirection(currentSimulationInputs, 'downstream');

        const [downstreamSimulation, upstreamSimulation] = await Promise.all([
          createSimulation(downstreamInputs, payloadDownstream, resDown, 'downstream'),
          createSimulation(upstreamInputs, payloadUpstream, resUp, 'upstream'),
        ]);

        simulationsToAdd.push(downstreamSimulation, upstreamSimulation);
        setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        handleRejection(error);
      }
    } finally {
      dispatch(addStdcmSimulations(simulationsToAdd));
    }
  };

  const launchStdcmRequest = async () => {
    resetStdcmState();
    isCancelledRef.current = false;

    const validConfig = checkStdcmConf(dispatch, t, dateTimeLocale, osrdconf);
    if (!validConfig) return;

    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending);
    const payload = formatStdcmPayload(validConfig);

    try {
      const promise = postTimetableByIdStdcm(payload);
      requestPromise.current = [promise];

      const response = await promise.unwrap();

      if (response.status === 'success') {
        await handleSuccess(response, payload);
      } else if (response.status === 'path_not_found') {
        await handlePathNotFound(response, payload);
      } else {
        handleRejection(new Error('Unexpected response status.'));
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handleRejection(err);
      }
    }
  };

  const cancelStdcmRequest = () => {
    isCancelledRef.current = true;
    requestPromise.current?.forEach((promise) => {
      if (typeof promise.abort === 'function') {
        promise.abort();
      }
    });
    requestPromise.current = null;
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.canceled);
  };

  const isPending = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending;
  const isPendingAdditional = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending_additional;
  const isRejected = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.rejected;
  const isCanceled = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.canceled;
  const isCalculationCompleted = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.success;

  return {
    launchStdcmRequest,
    cancelStdcmRequest,
    resetStdcmState,
    isPending,
    isRejected,
    isCanceled,
    isPendingAdditional,
    isCalculationFailed: isRejected,
    isCalculationCompleted,
  };
};

export default useStdcm;
