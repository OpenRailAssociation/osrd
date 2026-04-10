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
  StdcmProgressPoint,
  StdcmProgressPoints,
  StdcmRequestStatus,
  StdcmSimulation,
  StdcmSimulationInputs,
  StdcmSuccessResponse,
} from 'applications/stdcm/types';
import {
  osrdEditoastApi,
  type PostTimetableByIdStdcmApiArg,
  type RollingStockWithLiveries,
  type StdcmResponseWithTraceId,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { addStdcmSimulations } from 'reducers/osrdconf/stdcmConf';
import { getStdcmConf, getStdcmInfraID } from 'reducers/osrdconf/stdcmConf/selectors';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
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
  const dateTimeLocale = useDateTimeLocale();
  const osrdconf = useSelector(getStdcmConf);
  const infraId = useSelector(getStdcmInfraID);
  const abortRequests = useRef<Array<() => void>>(null);
  const isCancelledRef = useRef(false);
  const progressPoints = useRef<StdcmProgressPoints>([]);

  const currentSimulationInputs = useStdcmForm();

  const postTimetableByIdStdcm = osrdEditoastApi.endpoints.postTimetableByIdStdcm;

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
      const stdcmTrain: Omit<TimetableItem, 'train_schedule_set_id'> = {
        id: STDCM_TRAIN_ID,
        comfort: payload.body.comfort,
        constraint_distribution: 'MARECO',
        path: payload.body.steps.map((step) => ({
          location: step.location,
          id: uuidV4(),
        })),
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
    response: Extract<StdcmResponseWithTraceId, { status: 'success' }>,
    payload: PostTimetableByIdStdcmApiArg
  ) => {
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
    dispatch(updateSelectedTrainId(STDCM_TRAIN_TIMETABLE_ID));

    const simulation = await createSimulation(currentSimulationInputs, payload, response);
    dispatch(addStdcmSimulations([simulation]));
  };

  const handlePathNotFound = async (
    response: Extract<StdcmResponseWithTraceId, { status: 'path_not_found' }>,
    payload: PostTimetableByIdStdcmApiArg
  ) => {
    const simulationsToAdd: Omit<StdcmSimulation, 'index'>[] = [];
    try {
      const currentSimulation = await createSimulation(currentSimulationInputs, payload, response);
      simulationsToAdd.push(currentSimulation);

      setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending_additional);

      const payloadUpstream = adjustPayloadByDirection(payload, 'upstream');
      const payloadDownstream = adjustPayloadByDirection(payload, 'downstream');

      const upstream = postTimetableByIdStdcm(payloadUpstream);
      const downstream = postTimetableByIdStdcm(payloadDownstream);
      abortRequests.current = [upstream.unsubscribe, downstream.unsubscribe];

      const promiseUpstream = upstream.runAndAwaitResult();
      const promiseDownstream = downstream.runAndAwaitResult();

      // Run two additional requests for alternative simulations
      const [resUp, resDown] = await Promise.all([promiseUpstream, promiseDownstream]);

      // Handle error cases
      if (resUp.status === 'internal_error') throw new Error(resUp.error.message);
      if (resDown.status === 'internal_error') throw new Error(resDown.error.message);
      if (
        resUp.status === 'preprocessing_simulation_error' ||
        resDown.status === 'preprocessing_simulation_error'
      )
        throw new Error('Error in response');

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
    progressPoints.current = [];

    const validConfig = checkStdcmConf(dispatch, t, dateTimeLocale, osrdconf);
    if (!validConfig) return;

    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending);
    const payload = formatStdcmPayload(validConfig);

    try {
      const { subscribe, unsubscribe } = postTimetableByIdStdcm(payload);
      abortRequests.current = [unsubscribe];
      // This Map acts as a spatial grid.
      // The key is built from rounded coordinates (toFixed(1)),
      // allowing nearby points to be grouped into the same grid cell
      // and avoiding storing too many very close points
      const pointsOnGrid = new Map<string, StdcmProgressPoint>();

      // We can receive many points at the same timestamp. To avoid displaying them at once,
      // we track the number of nodes received at the same timestamp to be able to add a delay
      let lastPointReceivedAt = { timestamp: Date.now(), nb: 0 };
      // Listen to events
      await subscribe(async (event) => {
        switch (event.event) {
          case 'error': {
            if (event.error.name !== 'AbortError') handleRejection(event.error);
            break;
          }
          case 'ongoing': {
            setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.in_progress);
            const now = Date.now();
            if (now > lastPointReceivedAt.timestamp) {
              lastPointReceivedAt = { timestamp: Date.now(), nb: 0 };
            } else {
              lastPointReceivedAt.nb++;
            }
            const newPoint = {
              geoPoint: event.data.point,
              animationStartTime: lastPointReceivedAt.timestamp + 10 * lastPointReceivedAt.nb,
            };
            const newPointKey = newPoint.geoPoint.coordinates.map((n) => n.toFixed(1)).join('/');
            const pointOnGrid = pointsOnGrid.get(newPointKey);

            if (!pointOnGrid) {
              pointsOnGrid.set(newPointKey, newPoint);
              // If a point is already present, we check that its animation is ended before to replace it to avoid blink effect
              // and we set that if this new point override a previous one
            } else if (now - pointOnGrid.animationStartTime > 2000) {
              pointsOnGrid.set(newPointKey, { ...newPoint, skipFadeIn: true });
            }
            progressPoints.current = [...pointsOnGrid.values()];
            break;
          }
          case 'completed': {
            const result = event.data;
            switch (result.status) {
              case 'path_not_found':
                await handlePathNotFound(result, payload);
                break;
              case 'success':
                await handleSuccess(result, payload);
                break;
              case 'preprocessing_simulation_error':
                await handleRejection(result.error);
                break;
              case 'internal_error':
                await handleRejection(result.error);
            }
            break;
          }
        }
      });
    } catch (err) {
      handleRejection(err);
    }
  };

  const cancelStdcmRequest = () => {
    isCancelledRef.current = true;
    abortRequests.current?.forEach((abortFn) => {
      abortFn();
    });
    abortRequests.current = null;
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
