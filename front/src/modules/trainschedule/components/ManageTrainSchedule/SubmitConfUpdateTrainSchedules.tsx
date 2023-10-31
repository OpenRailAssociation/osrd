import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { FaPen } from 'react-icons/fa';

import { extractMessageFromError } from 'utils/error';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';

import formatConf from 'modules/trainschedule/components/ManageTrainSchedule/helpers/formatConf';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';

import { setFailure, setSuccess } from 'reducers/main';
import { updateSelectedProjection, updateSelectedTrainId } from 'reducers/osrdsimulation/actions';

type SubmitConfUpdateTrainSchedulesProps = {
  setIsWorking: (isWorking: boolean) => void;
  setDisplayTrainScheduleManagement: (arg0: string) => void;
};

// Refacto in a component to prepare the migration of the patch in editoast (need to be a React component to use hooks inside like rtk's)

export default function SubmitConfUpdateTrainSchedules({
  setIsWorking,
  setDisplayTrainScheduleManagement,
}: SubmitConfUpdateTrainSchedulesProps) {
  const { getTrainScheduleIDsToModify } = useOsrdConfSelectors();
  const { updateTrainScheduleIDsToModify } = useOsrdConfActions();
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);
  const [patchTrainSchedules] = osrdEditoastApi.endpoints.patchTrainSchedule.useMutation();

  async function submitConfUpdateTrainSchedules() {
    const { getConf, getPathfindingID, getName, getDepartureTime } = useOsrdConfSelectors();
    const simulationConf = useSelector(getConf);
    const pathfindingID = useSelector(getPathfindingID);
    const confName = useSelector(getName);
    const departureTime = useSelector(getDepartureTime);

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
        <FaPen />
      </span>
      {t('updateTrainSchedule')}
    </button>
  );
}
