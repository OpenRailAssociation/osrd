import { useState } from 'react';

import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { STDCM_REQUEST_STATUS, STDCM_TRAIN_ID } from 'applications/stdcm/consts';
import type { StdcmRequestStatus, StdcmV2SuccessResponse } from 'applications/stdcm/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import createTrain from 'modules/simulationResult/components/SpaceTimeChart/createTrain';
import { CHART_AXES } from 'modules/simulationResult/consts';
import { setFailure } from 'reducers/main';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import {
  updateConsolidatedSimulation,
  updateSelectedTrainId,
  updateSimulation,
} from 'reducers/osrdsimulation/actions';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import useStdcmResults from './useStdcmResults';
import { checkStdcmConf, formatStdcmPayload } from '../utils/formatStdcmConfV2';

const useStdcm = () => {
  const [stdcmTrainResult, setStdcmTrainResult] = useState<TrainScheduleResult>();
  const [stdcmV2Response, setStdcmV2Response] = useState<StdcmV2SuccessResponse>();
  const [currentStdcmRequestStatus, setCurrentStdcmRequestStatus] = useState<StdcmRequestStatus>(
    STDCM_REQUEST_STATUS.idle
  );
  const [pathProperties, setPathProperties] = useState<ManageTrainSchedulePathProperties>();

  const dispatch = useAppDispatch();
  const { t } = useTranslation(['translation', 'stdcm']);
  const { getConf, getTimetableID } = useOsrdConfSelectors();
  const osrdconf = useSelector(getConf);
  const timetableId = useSelector(getTimetableID);

  const stdcmV2Results = useStdcmResults(stdcmV2Response, stdcmTrainResult, setPathProperties);

  const [postV2TimetableByIdStdcm] =
    osrdEditoastApi.endpoints.postV2TimetableByIdStdcm.useMutation();

  const { data: stdcmRollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      {
        rollingStockId: osrdconf.rollingStockID as number,
      },
      { skip: !osrdconf.rollingStockID }
    );

  // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
  const controller = new AbortController();

  const { speedLimitByTag } = useStoreDataForSpeedLimitByTagSelector();

  const launchStdcmRequest = async () => {
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending);

    const validConfig = checkStdcmConf(dispatch, t, osrdconf as OsrdStdcmConfState);
    if (validConfig) {
      const payload = formatStdcmPayload(validConfig);
      try {
        const response = await postV2TimetableByIdStdcm(payload).unwrap();
        if (
          response.status === 'success' &&
          response.simulation.status === 'success' &&
          stdcmRollingStock
        ) {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
          setStdcmV2Response({
            ...response,
            rollingStock: stdcmRollingStock,
            creationDate: new Date(),
            speedLimitByTag,
          } as StdcmV2SuccessResponse);

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
    } else {
      setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.rejected);
    }
  };

  const cancelStdcmRequest = () => {
    // when http ready https://axios-http.com/docs/cancellation

    controller.abort();
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.canceled);

    const emptySimulation = { trains: [] };
    const consolidatedSimulation = createTrain(CHART_AXES.SPACE_TIME, emptySimulation.trains);
    dispatch(updateConsolidatedSimulation(consolidatedSimulation));
    dispatch(updateSimulation(emptySimulation));
  };

  const isPending = currentStdcmRequestStatus === STDCM_REQUEST_STATUS.pending;

  return {
    stdcmV2Results,
    launchStdcmRequest,
    currentStdcmRequestStatus,
    cancelStdcmRequest,
    pathProperties,
    setPathProperties,
    isPending,
  };
};

export default useStdcm;
