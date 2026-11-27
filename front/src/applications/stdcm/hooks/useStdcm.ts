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
  StdcmProgressPoints,
  StdcmRequestStatus,
  StdcmSimulation,
  StdcmSimulationInputs,
  StdcmSuccessResponse,
} from 'applications/stdcm/types';
import {
  osrdEditoastApi,
  type PostTimetableByIdStdcmApiArg,
  type StdcmResponseWithTraceId,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { addStdcmSimulations } from 'reducers/osrdconf/stdcmConf';
import { getStdcmConf, getStdcmInfraID } from 'reducers/osrdconf/stdcmConf/selectors';
import { updateSelectedTrain } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
import { castErrorToFailure } from 'utils/error';

import { adjustInputByDirection, adjustPayloadByDirection } from '../utils/adjustSimulationInputs';
import fetchPathNotFoundDetails from '../utils/fetchPathNotFoundDetails';
import fetchPathProperties from '../utils/fetchPathProperties';
import { checkStdcmConf, formatStdcmPayload } from '../utils/formatStdcmConf';
import computeChartData from '../utils/stdcmComputeChartData';
import useStdcmForm from './useStdcmForm';

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
  const abortController = useRef<AbortController>(null);
  const isCancelledRef = useRef(false);
  const progressPoints = useRef<StdcmProgressPoints>([]);

  const currentSimulationInputs = useStdcmForm();

  const postTimetableByIdStdcm = osrdEditoastApi.endpoints.postTimetableByIdStdcm;
  const getPostTimetableByIdStdcmPromise = async (
    args: PostTimetableByIdStdcmApiArg,
    signal: AbortSignal,
    type: 'upstream' | 'downstream'
  ): Promise<StdcmResponseWithTraceId> => {
    for await (const event of postTimetableByIdStdcm(args, signal)) {
      switch (event.event) {
        case 'ongoing': {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.in_progress);
          progressPoints.current = [
            ...progressPoints.current,
            {
              type,
              geoPoint: event.data.point,
              animationStartTime: Date.now(),
            },
          ];
          break;
        }
        case 'completed': {
          return { ...event.data, traceId: event.traceId };
        }
      }
    }
    throw new Error('Missing completed event in stdcm response');
  };

  const { data: stdcmRollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      osrdconf.rollingStockID ? { rollingStockId: osrdconf.rollingStockID } : skipToken
    );

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
    response: Extract<StdcmResponseWithTraceId, { status: 'success' | 'path_not_found' }>,
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
      const stdcmTrain: Omit<TrainScheduleResponse, 'timetable_id'> = {
        id: STDCM_TRAIN_ID,
        comfort: payload.body.comfort,
        constraint_distribution: 'MARECO',
        path: payload.body.steps.map((step) => ({
          location: step.pathfinding_item.location,
          key: uuidV4(),
        })),
        rolling_stock_name: stdcmRollingStock!.name,
        start_time: new Date(formattedResponse.departure_time).getTime(),
        train_name: 'stdcm',
      };
      const chartData = computeChartData(
        formattedResponse,
        stdcmTrain,
        t,
        stdcmRollingStock!,
        pathProperties
      );
      outputs = {
        pathProperties,
        results: formattedResponse,
        speedDistanceDiagramData: chartData,
      };
    } else {
      outputs = await fetchPathNotFoundDetails(response, infraId, dispatch);
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
    response: Extract<StdcmResponseWithTraceId, { status: 'success' }>,
    payload: PostTimetableByIdStdcmApiArg
  ) => {
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
    dispatch(updateSelectedTrain({ id: STDCM_TRAIN_TIMETABLE_ID, by: 'timetable' }));

    const simulation = await createSimulation(currentSimulationInputs, payload, response);
    dispatch(addStdcmSimulations([simulation]));
  };

  const handlePathNotFound = async (
    response: Extract<StdcmResponseWithTraceId, { status: 'path_not_found' }>,
    payload: PostTimetableByIdStdcmApiArg
  ) => {
    const simulationsToAdd: Omit<StdcmSimulation, 'index'>[] = [];
    try {
      setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending_additional);

      const payloadUpstream = adjustPayloadByDirection(payload, 'upstream');
      const payloadDownstream = adjustPayloadByDirection(payload, 'downstream');

      abortController.current = new AbortController();
      const promiseUpstream = getPostTimetableByIdStdcmPromise(
        payloadUpstream,
        abortController.current.signal,
        'upstream'
      );
      const promiseDownstream = getPostTimetableByIdStdcmPromise(
        payloadDownstream,
        abortController.current.signal,
        'downstream'
      );

      // The failure explanation of the current simulation is fetched while the two
      // additional requests for alternative simulations are running.
      const currentSimulation = await createSimulation(currentSimulationInputs, payload, response);
      simulationsToAdd.push(currentSimulation);

      const [resUp, resDown] = await Promise.all([promiseUpstream, promiseDownstream]);

      // Handle error cases
      if (resUp.status === 'internal_error') throw new Error(resUp.error.message);
      if (resDown.status === 'internal_error') throw new Error(resDown.error.message);
      if (
        resUp.status === 'preprocessing_simulation_error' ||
        resDown.status === 'preprocessing_simulation_error'
      )
        throw new Error('Error in response');

      dispatch(updateSelectedTrain({ id: STDCM_TRAIN_TIMETABLE_ID, by: 'timetable' }));

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
      abortController.current?.abort(); // Abort the other request if one failed
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
    progressPoints.current = [];

    const validConfig = checkStdcmConf(dispatch, t, dateTimeLocale, osrdconf);
    if (!validConfig) return;

    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending);
    const payload = formatStdcmPayload(validConfig);

    try {
      abortController.current = new AbortController();
      // Listen to events
      for await (const event of postTimetableByIdStdcm(payload, abortController.current.signal)) {
        switch (event.event) {
          case 'ongoing': {
            setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.in_progress);
            progressPoints.current = [
              ...progressPoints.current,
              {
                type: 'normal',
                geoPoint: event.data.point,
                animationStartTime: Date.now(),
              },
            ];
            break;
          }
          case 'completed': {
            const result: StdcmResponseWithTraceId = { ...event.data, traceId: event.traceId };
            switch (result.status) {
              case 'path_not_found':
                await handlePathNotFound(result, payload);
                break;
              case 'success':
                await handleSuccess(result, payload);
                break;
              case 'preprocessing_simulation_error':
                handleRejection(result.error);
                break;
              case 'internal_error':
                handleRejection(result.error);
            }
            return;
          }
        }
      }
      throw new Error('Missing completed event in stdcm response');
    } catch (err) {
      if (!(err instanceof DOMException) || err.name !== 'AbortError') {
        handleRejection(err);
      }
    }
  };

  const cancelStdcmRequest = () => {
    isCancelledRef.current = true;
    abortController.current?.abort();
    abortController.current = null;
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.canceled);
  };

  return {
    launchStdcmRequest,
    cancelStdcmRequest,
    resetStdcmState,
    progressPoints,
    requestStatus: currentStdcmRequestStatus,
  };
};

export default useStdcm;
