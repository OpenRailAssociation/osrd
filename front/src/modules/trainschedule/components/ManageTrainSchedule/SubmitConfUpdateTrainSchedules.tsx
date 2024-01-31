import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { extractMessageFromError } from 'utils/error';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';

import formatConf from 'modules/trainschedule/components/ManageTrainSchedule/helpers/formatConf';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';

import { useAppDispatch } from 'store';
import { setFailure, setSuccess } from 'reducers/main';
import { updateSelectedProjection, updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import { Pencil } from '@osrd-project/ui-icons';

type SubmitConfUpdateTrainSchedulesProps = {
  setIsWorking: (isWorking: boolean) => void;
  setDisplayTrainScheduleManagement: (arg0: string) => void;
  setTrainResultsToFetch: (trainScheduleIds?: number[]) => void;
};

// Refacto in a component to prepare the migration of the patch in editoast (need to be a React component to use hooks inside like rtk's)

export default function SubmitConfUpdateTrainSchedules({
  setIsWorking,
  setDisplayTrainScheduleManagement,
  setTrainResultsToFetch,
}: SubmitConfUpdateTrainSchedulesProps) {
  const { getTrainScheduleIDsToModify, getConf, getPathfindingID, getName, getDepartureTime } =
    useOsrdConfSelectors();
  const confName = useSelector(getName);
  const simulationConf = useSelector(getConf);
  const pathfindingID = useSelector(getPathfindingID);
  const departureTime = useSelector(getDepartureTime);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);

  const { updateTrainScheduleIDsToModify } = useOsrdConfActions();
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  const [patchTrainSchedules] = osrdEditoastApi.endpoints.patchTrainSchedule.useMutation();

  async function submitConfUpdateTrainSchedules() {
    // First train tested, and next we put the other trains
    const formattedSimulationConf = formatConf(dispatch, t, simulationConf, true);
    if (!pathfindingID) {
      dispatch(
        setFailure({
          name: t('errorMessages.error'),
          message: t(`errorMessages.noPathfinding`),
        })
      );
    } else if (formattedSimulationConf && trainScheduleIDsToModify.length > 0) {
      setIsWorking(true);
      let callSuccess = true;
      try {
        await Promise.all(
          trainScheduleIDsToModify.map(async (trainScheduleID) => {
            await patchTrainSchedules({
              body: [
                {
                  id: trainScheduleID,
                  ...formattedSimulationConf,
                  path_id: pathfindingID,
                },
              ],
            })
              .unwrap()
              .catch((e) => {
                extractMessageFromError(e);
                callSuccess = false;
                dispatch(
                  setFailure({
                    name: t('errorMessages.error'),
                    message: t(`errorMessages.${e.data.type}`),
                  })
                );
              });
          })
        );
        if (callSuccess) {
          setTrainResultsToFetch(trainScheduleIDsToModify);
          dispatch(
            setSuccess({
              title: t('trainUpdated'),
              text: `${confName}: ${departureTime}`,
            })
          );
          dispatch(updateSelectedTrainId(trainScheduleIDsToModify[0]));
          dispatch(
            updateSelectedProjection({
              id: trainScheduleIDsToModify[0],
              path: pathfindingID,
            })
          );
          setIsWorking(false);
          setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
          dispatch(updateTrainScheduleIDsToModify([]));
        }
      } catch (e: unknown) {
        setIsWorking(false);
        if (e instanceof Error) {
          dispatch(
            setFailure({
              name: e.name,
              message: t(`errorMessages.${e.message}`),
            })
          );
        }
      }
    }
  }
  return (
    <button className="btn btn-warning" type="button" onClick={submitConfUpdateTrainSchedules}>
      <span className="mr-2">
        <Pencil size="lg" />
      </span>
      {t('updateTrainSchedule')}
    </button>
  );
}
