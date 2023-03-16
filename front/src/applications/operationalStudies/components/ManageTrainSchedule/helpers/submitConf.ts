import formatConf from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/formatConf';

import { time2sec, sec2time } from 'utils/timeManipulation';
import trainNameWithNum from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/trainNameHelper';
import { scheduleURL } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { setFailure, setSuccess } from 'reducers/main';
import { store } from 'Store';
import { post } from 'common/requests';
import getTimetable from 'applications/operationalStudies/components/Scenario/getTimetable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const submitConf = async (dispatch: any, t: any, setIsWorking: (isWorking: boolean) => void) => {
  const { osrdconf } = store.getState();
  // First train tested, and next we put the other trains
  const osrdConfig = formatConf(dispatch, t, osrdconf);
  if (osrdConfig) {
    setIsWorking(true);
    const originTime = time2sec(osrdconf.originTime);
    const schedules = [];
    let actualTrainCount = 1;
    for (let nb = 1; nb <= osrdconf.trainCount; nb += 1) {
      const newOriginTime = originTime + 60 * osrdconf.trainDelta * (nb - 1);
      const trainName = trainNameWithNum(osrdconf.name, actualTrainCount, osrdconf.trainCount);
      schedules.push(
        formatConf(dispatch, t, {
          ...osrdconf,
          name: trainName,
          originTime: newOriginTime.toString(),
        })
      );
      actualTrainCount += osrdconf.trainStep;
    }
    try {
      await post(
        scheduleURL,
        {
          timetable: osrdconf.timetableID,
          path: osrdconf.pathfindingID,
          schedules,
        },
        {}
      );
      dispatch(
        setSuccess({
          title: t('trainAdded'),
          text: `${osrdconf.name}: ${sec2time(originTime)}`,
        })
      );
      setIsWorking(false);
      getTimetable();
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

export default submitConf;
