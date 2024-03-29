import React from 'react';

import { Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import formatConf from 'modules/trainschedule/components/ManageTrainSchedule/helpers/formatConf';
import { setFailure, setSuccess } from 'reducers/main';
import { updateSelectedProjection, updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

type SubmitConfUpdateTrainSchedulesProps = {
  setIsWorking: (isWorking: boolean) => void;
  setDisplayTrainScheduleManagement: (arg0: string) => void;
  setTrainResultsToFetch: (trainScheduleIds?: number[]) => void;
};

// Refacto in a component to prepare the migration of the patch in editoast (need to be a React component to use hooks inside like rtk's)

const SubmitConfUpdateTrainSchedulesV2 = ({
  setIsWorking,
  setDisplayTrainScheduleManagement,
  setTrainResultsToFetch,
}: SubmitConfUpdateTrainSchedulesProps) => {
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
                callSuccess = false;
                dispatch(setFailure(castErrorToFailure(e)));
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
      } catch (e) {
        setIsWorking(false);
        dispatch(setFailure(castErrorToFailure(e)));
      }
    }
  }
  return (
    <button
      className="btn btn-warning"
      type="button"
      onClick={submitConfUpdateTrainSchedules}
      data-testid="submit-edit-train-schedule"
    >
      <span className="mr-2">
        <Pencil size="lg" />
      </span>
      {t('updateTrainSchedule')}
    </button>
  );
};

export default SubmitConfUpdateTrainSchedulesV2;
