import React from 'react';
import formatConf from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/formatConf';
import { setFailure, setSuccess } from 'reducers/main';
import { store } from 'Store';
import getSimulationResults from 'applications/operationalStudies/components/Scenario/getSimulationResults';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useDispatch, useSelector } from 'react-redux';
import { getTrainScheduleIDsToModify } from 'reducers/osrdconf/selectors';
import { updateReloadTimetable } from 'reducers/osrdsimulation/actions';
import { useTranslation } from 'react-i18next';
import { FaPen } from 'react-icons/fa';
import { getSelectedTrainId } from 'reducers/osrdsimulation/selectors';

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
  const selectedTrainId = useSelector(getSelectedTrainId);
  const trainScheduleIDsToModify: undefined | number[] = useSelector(getTrainScheduleIDsToModify);
  const [getTimetable] = osrdEditoastApi.endpoints.getTimetableById.useLazyQuery();
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
      trainScheduleIDsToModify &&
      osrdconf.simulationConf.pathfindingID
    ) {
      setIsWorking(true);
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
            }).unwrap();
          })
        );
        dispatch(updateReloadTimetable(true));
        dispatch(
          setSuccess({
            title: t('trainUpdated'),
            text: `${osrdconf.simulationConf.name}: ${osrdconf.simulationConf.departureTime}`,
          })
        );
        setIsWorking(false);
        setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
        dispatch(updateTrainScheduleIDsToModify(undefined));
        const timetable = await getTimetable({
          id: osrdconf.simulationConf.timetableID as number,
        }).unwrap();
        dispatch(updateReloadTimetable(false));
        getSimulationResults(timetable, selectedTrainId);
      } catch (e: unknown) {
        setIsWorking(false);
        dispatch(updateReloadTimetable(false));
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
