import { useState } from 'react';

import { cloneDeep } from 'lodash';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import { STDCM_REQUEST_STATUS, STDCM_TRAIN_ID } from 'applications/stdcm/consts';
import formatStdcmConf from 'applications/stdcm/formatStdcmConf';
import type { StdcmRequestStatus, StdcmV2SuccessResponse } from 'applications/stdcm/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type {
  SimulationReport,
  PostStdcmApiResponse,
  TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
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
import { getStdcmV2Activated, getTrainScheduleV2Activated } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import useStdcmResults from './useStdcmResults';
import { checkStdcmConf, formatStdcmPayload } from '../utils/formatStdcmConfV2';

const useStdcm = () => {
  const [stdcmTrainResult, setStdcmTrainResult] = useState<TrainScheduleResult>();
  const [stdcmResults, setStdcmResults] = useState<PostStdcmApiResponse>();
  const [stdcmV2Response, setStdcmV2Response] = useState<StdcmV2SuccessResponse>();
  const [currentStdcmRequestStatus, setCurrentStdcmRequestStatus] = useState<StdcmRequestStatus>(
    STDCM_REQUEST_STATUS.idle
  );
  const [pathProperties, setPathProperties] = useState<ManageTrainSchedulePathProperties>();

  const dispatch = useAppDispatch();
  const { t } = useTranslation(['translation', 'stdcm']);
  const { getConf, getTimetableID } = useOsrdConfSelectors();
  const osrdconf = useSelector(getConf);
  const trainScheduleV2Activated = useSelector(getTrainScheduleV2Activated);
  const stdcmV2Activated = useSelector(getStdcmV2Activated);
  const timetableId = useSelector(getTimetableID);

  const stdcmV2Results = useStdcmResults(stdcmV2Response, stdcmTrainResult, setPathProperties);

  const [postStdcm] = osrdEditoastApi.endpoints.postStdcm.useMutation();
  const [postV2TimetableByIdStdcm] =
    osrdEditoastApi.endpoints.postV2TimetableByIdStdcm.useMutation();
  const [postTrainScheduleResults] =
    osrdEditoastApi.endpoints.postTrainScheduleResults.useMutation();

  const [getTimetable] = osrdEditoastApi.endpoints.getTimetableById.useLazyQuery();

  const { data: stdcmRollingStock } =
    osrdEditoastApi.endpoints.getLightRollingStockByRollingStockId.useQuery(
      {
        rollingStockId: osrdconf.rollingStockID as number,
      },
      { skip: !osrdconf.rollingStockID && !trainScheduleV2Activated }
    );

  const { updateItinerary } = useOsrdConfActions();

  // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
  const controller = new AbortController();

  const { timetableID } = osrdconf;

  const resetResults = () => {
    dispatch(updateSelectedTrainId(undefined));
    dispatch(updateConsolidatedSimulation([]));
    dispatch(updateSimulation({ trains: [] }));
    setStdcmResults(undefined);
  };

  const launchStdcmRequestV1 = async () => {
    const payload = formatStdcmConf(dispatch, t, osrdconf as OsrdStdcmConfState);
    if (payload && timetableID) {
      resetResults();
      postStdcm(payload)
        .unwrap()
        .then((result) => {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
          setStdcmResults(result);
          dispatch(updateItinerary(result.path));

          const fakedNewTrain = {
            ...cloneDeep(result.simulation),
            id: STDCM_TRAIN_ID,
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
                const trains: SimulationReport[] = [...timetableTrains.simulations, fakedNewTrain];
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
        if (
          response.status === 'success' &&
          response.simulation.status === 'success' &&
          stdcmRollingStock
        ) {
          setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.success);
          setStdcmV2Response({
            ...response,
            rollingStock: stdcmRollingStock,
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

  const launchStdcmRequest = async () => {
    setCurrentStdcmRequestStatus(STDCM_REQUEST_STATUS.pending);
    if (trainScheduleV2Activated || stdcmV2Activated) {
      launchStdcmRequestV2();
    } else {
      launchStdcmRequestV1();
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

  return {
    stdcmResults,
    stdcmV2Results,
    launchStdcmRequest,
    currentStdcmRequestStatus,
    cancelStdcmRequest,
    pathProperties,
    setPathProperties,
  };
};

export default useStdcm;
