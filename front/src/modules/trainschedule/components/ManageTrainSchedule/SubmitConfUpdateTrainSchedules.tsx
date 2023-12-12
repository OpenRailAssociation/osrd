import React from 'react';
import formatConf from 'modules/trainschedule/components/ManageTrainSchedule/helpers/formatConf';
import { setFailure, setSuccess } from 'reducers/main';
import { store } from 'store';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useDispatch, useSelector } from 'react-redux';
import { getTrainScheduleIDsToModify } from 'reducers/osrdconf/selectors';
import { useTranslation } from 'react-i18next';
import { FaPen } from 'react-icons/fa';
import { updateSelectedProjection, updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import { extractMessageFromError } from 'utils/error';

type SubmitConfUpdateTrainSchedulesProps = {
  setIsWorking: (isWorking: boolean) => void;
  setDisplayTrainScheduleManagement: (arg0: string) => void;
};

// Refacto in a component to prepare the migration of the patch in editoast (need to be a React component to use hooks inside like rtk's)

export default function SubmitConfUpdateTrainSchedules({
  setIsWorking,
  setDisplayTrainScheduleManagement,
}: SubmitConfUpdateTrainSchedulesProps) {
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);
  const [patchTrainSchedules] = osrdEditoastApi.endpoints.patchTrainSchedule.useMutation();

  async function submitConfUpdateTrainSchedules() {
    const { osrdconf } = store.getState();

    // First train tested, and next we put the other trains
    const simulationConf = formatConf(dispatch, t, osrdconf.simulationConf, true);
    if (!osrdconf.simulationConf.pathfindingID) {
      dispatch(
        setFailure({
          name: t('errorMessages.error'),
          message: t(`errorMessages.noPathfinding`),
        })
      );
    } else if (
      simulationConf &&
      osrdconf.simulationConf.pathfindingID &&
      trainScheduleIDsToModify.length > 0
    ) {
      setIsWorking(true);
      let callSuccess = true;
      try {
        await Promise.all(
          trainScheduleIDsToModify.map(async (trainScheduleID) => {
            await patchTrainSchedules({
              body: [
                {
                  id: trainScheduleID,
                  ...simulationConf,
                  path_id: osrdconf.simulationConf.pathfindingID,
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
              text: `${osrdconf.simulationConf.name}: ${osrdconf.simulationConf.departureTime}`,
            })
          );
          dispatch(updateSelectedTrainId(trainScheduleIDsToModify[0]));
          dispatch(
            updateSelectedProjection({
              id: trainScheduleIDsToModify[0],
              path: osrdconf.simulationConf.pathfindingID,
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
