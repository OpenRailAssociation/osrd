import { useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';

import {
  STDCM_REQUEST_STATUS,
  STDCM_TRAIN_ID,
  STDCM_TRAIN_TIMETABLE_ID,
} from 'applications/stdcm/consts';
import type {
  StdcmRequestStatus,
  StdcmResponse,
  StdcmSimulation,
  StdcmSimulationInputs,
} from 'applications/stdcm/types';
import {
  osrdEditoastApi,
  type PostTimetableByIdStdcmApiArg,
  type PostTimetableByIdStdcmApiResponse,
  type RollingStockWithLiveries,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import { setFailure } from 'reducers/main';
import { addStdcmSimulations } from 'reducers/osrdconf/stdcmConf';
import {
  getStdcmConf,
  getStdcmTimetableID,
  getStdcmInfraID,
} from 'reducers/osrdconf/stdcmConf/selectors';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

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
  const osrdconf = useSelector(getStdcmConf);
  const timetableId = useSelector(getStdcmTimetableID);
  const infraId = useSelector(getStdcmInfraID);
  const requestPromise = useRef<ReturnType<typeof postTimetableByIdStdcm>>();
  const currentSimulationInputs = useStdcmForm();

  const [postTimetableByIdStdcm] = osrdEditoastApi.endpoints.postTimetableByIdStdcm.useMutation();

  const { data: stdcmRollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      { rollingStockId: osrdconf.rollingStockID! },
      { skip: !osrdconf.rollingStockID }
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
    response: Extract<PostTimetableByIdStdcmApiResponse, { status: 'success' | 'conflicts' }>,
    alternativePath?: 'upstream' | 'downstream'
  ): Promise<Omit<StdcmSimulation, 'index'>> => {
    const formattedResponse = {
      ...response,
      rollingStock: stdcmRollingStock,
      creationDate: new Date(),
      speedLimitByTag: osrdconf.speedLimitByTag,
      simulationPathSteps: osrdconf.stdcmPathSteps,
      path: response.status === 'conflicts' ? response.pathfinding_result : response.path,
    } as StdcmResponse;

    const pathProperties = await fetchPathProperties(formattedResponse.path, infraId, dispatch);

    // If the response is successful compute the chart data, otherwise only include conflicts.
    let outputs;
    if (formattedResponse.status === 'success') {
      const stdcmTrain: TrainScheduleResult = {
        id: STDCM_TRAIN_ID,
        timetable_id: timetableId,
        comfort: payload.body.comfort,
        constraint_distribution: 'MARECO',
        path: payload.body.steps.map((step) => ({ ...step.location, id: nextId() })),
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
        speedSpaceChartData: chartData,
      };
    } else {
      outputs = { pathProperties, conflicts: formattedResponse.conflicts };
    }

    return {
      creationDate: formattedResponse.creationDate,
      inputs,
      outputs,
      alternativePath,
    };
  };

  const handleSuccess = async (
    response: Extract<PostTimetableByIdStdcmApiResponse, { status: 'success' }>,
    payload: PostTimetableByIdStdcmApiArg
  ) => {
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
    dispatch(updateSelectedTrainId(STDCM_TRAIN_TIMETABLE_ID));

    const simulation = await createSimulation(currentSimulationInputs, payload, response);
    dispatch(addStdcmSimulations([simulation]));
  };

  const handleConflicts = async (
    response: Extract<PostTimetableByIdStdcmApiResponse, { status: 'conflicts' }>,
    payload: PostTimetableByIdStdcmApiArg
  ) => {
    try {
      setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending_additional);

      const payloadUpstream = adjustPayloadByDirection(payload, 'upstream');
      const payloadDownstream = adjustPayloadByDirection(payload, 'downstream');

      // run two additional requests with different payloads for alternative simulations
      const [resUp, resDown] = await Promise.all([
        postTimetableByIdStdcm(payloadUpstream).unwrap(),
        postTimetableByIdStdcm(payloadDownstream).unwrap(),
      ]);

      if (
        resUp.status === 'preprocessing_simulation_error' ||
        resDown.status === 'preprocessing_simulation_error'
      ) {
        throw new Error('Error in response');
      }

      dispatch(updateSelectedTrainId(STDCM_TRAIN_TIMETABLE_ID));

      const upstreamInputs = adjustInputByDirection(currentSimulationInputs, 'upstream');
      const downstreamInputs = adjustInputByDirection(currentSimulationInputs, 'downstream');

      const [currentSimulation, downstreamSimulation, upstreamSimulation] = await Promise.all([
        createSimulation(currentSimulationInputs, payload, response, undefined),
        createSimulation(downstreamInputs, payloadDownstream, resDown, 'downstream'),
        createSimulation(upstreamInputs, payloadUpstream, resUp, 'upstream'),
      ]);

      dispatch(addStdcmSimulations([currentSimulation, downstreamSimulation, upstreamSimulation]));

      setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
    } catch (error) {
      setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
      triggerShowFailureNotification(
        castErrorToFailure(error, {
          name: t('stdcm:stdcmErrors.requestFailed'),
          message: t('translation:common.error'),
        })
      );
    }
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

  const launchStdcmRequest = async () => {
    resetStdcmState();

    const validConfig = checkStdcmConf(dispatch, t, osrdconf);
    if (!validConfig) return;

    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending);
    const payload = formatStdcmPayload(validConfig);

    try {
      const promise = postTimetableByIdStdcm(payload);
      requestPromise.current = promise;

      const response = await promise.unwrap();

      if (response.status === 'success') {
        await handleSuccess(response, payload);
      } else if (response.status === 'conflicts') {
        await handleConflicts(response, payload);
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
    if (typeof requestPromise.current?.abort === 'function') {
      requestPromise.current.abort();
    }
    requestPromise.current = undefined;
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
