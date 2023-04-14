import formatConf from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/formatConf';

import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { setFailure, setSuccess } from 'reducers/main';
import { store } from 'Store';
import { patch } from 'common/requests';
import getTimetable from 'applications/operationalStudies/components/Scenario/getTimetable';
import { Dispatch } from 'redux';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';

const submitConfUpdateTrainSchedules = (
  dispatch: Dispatch,
  t: (key: string) => string,
  setIsWorking: (isWorking: boolean) => void,
  trainScheduleIDsToModify: number[],
  setDisplayTrainScheduleManagement: (arg0: string) => void
) => {
  const { osrdconf } = store.getState();
  // First train tested, and next we put the other trains
  const simulationConf = formatConf(dispatch, t, osrdconf.simulationConf, true);
  if (simulationConf) {
    setIsWorking(true);
    try {
      trainScheduleIDsToModify.forEach(async (trainScheduleID) => {
        await patch(
          `${trainscheduleURI + trainScheduleID}/`,
          {
            ...simulationConf,
            timetable: osrdconf.simulationConf.timetableID,
            path: osrdconf.simulationConf.pathfindingID,
          },
          {}
        );
        dispatch(
          setSuccess({
            title: t('trainAdded'),
            text: `${osrdconf.simulationConf.name}: ${osrdconf.simulationConf.departureTime}`,
          })
        );
      });
      setIsWorking(false);
      getTimetable(osrdconf.simulationConf.timetableID);
      setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
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
};

export default submitConfUpdateTrainSchedules;
