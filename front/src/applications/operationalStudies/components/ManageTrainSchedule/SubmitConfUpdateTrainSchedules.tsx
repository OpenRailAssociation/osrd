import React from 'react';
import formatConf from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/formatConf';
import { setFailure, setSuccess } from 'reducers/main';
import { store } from 'Store';
import getTimetable from 'applications/operationalStudies/components/Scenario/getTimetable';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useDispatch, useSelector } from 'react-redux';
import { getTrainScheduleIDsToModify } from 'reducers/osrdconf/selectors';
import { updateReloadTimetable } from 'reducers/osrdsimulation/actions';
import { useTranslation } from 'react-i18next';
import { FaPen } from 'react-icons/fa';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';

type Props = {
  setIsWorking: (isWorking: boolean) => void;
  setDisplayTrainScheduleManagement: (arg0: string) => void;
};

// Refacto in a component to prepare the migration of the patch in editoast (need to be a React component to use hooks inside like rtk's)

export default function SubmitConfUpdateTrainSchedules({
  setIsWorking,
  setDisplayTrainScheduleManagement,
}: Props) {
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const trainScheduleIDsToModify: undefined | number[] = useSelector(getTrainScheduleIDsToModify);
  const [getTimetableWithTrainSchedulesDetails] = osrdEditoastApi.useLazyGetTimetableByIdQuery();
  const [patchTrainSchedules] = osrdMiddlewareApi.usePatchTrainScheduleByIdMutation();

  async function submitConfUpdateTrainSchedules() {
    const { osrdconf } = store.getState();

    // First train tested, and next we put the other trains
    const simulationConf = formatConf(dispatch, t, osrdconf.simulationConf, true);
    if (simulationConf && trainScheduleIDsToModify) {
      setIsWorking(true);
      try {
        await Promise.resolve(dispatch(updateReloadTimetable(true)));
        trainScheduleIDsToModify.forEach(async (trainScheduleID) => {
          await patchTrainSchedules({
            id: trainScheduleID,
            writableTrainSchedule: {
              ...simulationConf,
              timetable: osrdconf.simulationConf.timetableID,
              path: osrdconf.simulationConf.pathfindingID,
            },
          }).unwrap();
          dispatch(
            setSuccess({
              title: t('trainUpdated'),
              text: `${osrdconf.simulationConf.name}: ${osrdconf.simulationConf.departureTime}`,
            })
          );
        });
        setIsWorking(false);
        setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
        dispatch(updateTrainScheduleIDsToModify(undefined));
        const timetable = await getTimetableWithTrainSchedulesDetails({
          id: osrdconf.simulationConf.timetableID as number,
        }).unwrap();
        await Promise.resolve(dispatch(updateReloadTimetable(false)));
        getTimetable(timetable);
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
