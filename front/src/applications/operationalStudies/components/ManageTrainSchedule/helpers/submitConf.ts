import formatConf from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/formatConf';

import { time2sec, sec2time } from 'utils/timeManipulation';
import trainNameWithNum from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/trainNameHelper';
import { scheduleURL } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { setFailure, setSuccess } from 'reducers/main';
import { store } from 'Store';
import { post } from 'common/requests';
import getTimetable from 'applications/operationalStudies/components/Scenario/getTimetable';
import { Dispatch } from 'redux';

const submitConf = async (
  dispatch: Dispatch,
  t: (key: string) => string,
  setIsWorking: (isWorking: boolean) => void
) => {
  const { osrdconf } = store.getState();
  // First train tested, and next we put the other trains
  const osrdConfig = formatConf(dispatch, t, osrdconf.simulationConf);
  if (osrdConfig) {
    setIsWorking(true);
    const originTime = time2sec(osrdconf.simulationConf.originTime);
    const schedules = [];
    let actualTrainCount = 1;
    for (let nb = 1; nb <= osrdconf.simulationConf.trainCount; nb += 1) {
      const newOriginTime = originTime + 60 * osrdconf.simulationConf.trainDelta * (nb - 1);
      const trainName = trainNameWithNum(
        osrdconf.simulationConf.name,
        actualTrainCount,
        osrdconf.simulationConf.trainCount
      );
      schedules.push(
        formatConf(dispatch, t, {
          ...osrdconf.simulationConf,
          name: trainName,
          originTime: newOriginTime.toString(),
        })
      );
      actualTrainCount += osrdconf.simulationConf.trainStep;
    }
    try {
      await post(
        scheduleURL,
        {
          timetable: osrdconf.simulationConf.timetableID,
          path: osrdconf.simulationConf.pathfindingID,
          schedules,
        },
        {}
      );
      dispatch(
        setSuccess({
          title: t('trainAdded'),
          text: `${osrdconf.simulationConf.name}: ${sec2time(originTime)}`,
        })
      );
      setIsWorking(false);
      getTimetable(osrdconf.simulationConf.timetableID);
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
