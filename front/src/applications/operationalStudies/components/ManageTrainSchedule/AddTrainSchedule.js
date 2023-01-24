import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { post } from 'common/requests';
import { updateName } from 'reducers/osrdconf';
import { setFailure, setSuccess } from 'reducers/main';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { time2sec, sec2time } from 'utils/timeManipulation';
import debounce from 'lodash/debounce';
import { FaPlus } from 'react-icons/fa';

import formatConf from 'applications/operationalStudies/components/ManageTrainSchedule/AddTrainSchedule/formatConf';
import trainNameWithNum from 'applications/operationalStudies/components/ManageTrainSchedule/AddTrainSchedule/trainNameHelper';
import { scheduleURL } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import getTimetable from '../Scenario/getTimetable';

export default function AddTrainSchedule(props) {
  const { setDisplayTrainScheduleManagement } = props;
  const [name, setName] = useState(undefined);
  const [isWorking, setIsWorking] = useState(false);
  const [trainCount, setTrainCount] = useState(1);
  const [trainStep, setTrainStep] = useState(2);
  const [trainDelta, setTrainDelta] = useState(15);
  const osrdconf = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useDispatch();

  const submitConf = async () => {
    // First train tested, and next we put the other trains
    const osrdConfig = formatConf(dispatch, setFailure, t, osrdconf, osrdconf.originTime);
    if (osrdConfig) {
      setIsWorking(true);
      const originTime = time2sec(osrdconf.originTime);
      const schedules = [];
      let actualTrainCount = 1;
      for (let nb = 1; nb <= trainCount; nb += 1) {
        const newOriginTime = originTime + 60 * trainDelta * (nb - 1);
        const trainName = trainNameWithNum(osrdconf.name, actualTrainCount, trainCount);
        /* eslint no-await-in-loop: 0 */
        schedules.push(
          formatConf(dispatch, setFailure, t, { ...osrdconf, name: trainName }, newOriginTime)
        );
        actualTrainCount += trainStep;
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
        setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
      } catch (e) {
        setIsWorking(false);
        dispatch(
          setFailure({
            name: e.name,
            message: t(`errorMessages.${e.message}`),
          })
        );
      }
    }
  };

  const debouncedUpdateName = debounce((newName) => {
    dispatch(updateName(newName));
  }, 300);

  const handleNameChange = useCallback((newName) => {
    setName(newName);
    debouncedUpdateName(newName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setName(osrdconf.name);
  }, [osrdconf]);

  return (
    <div className="osrd-config-item" data-testid="add-train-schedules">
      <div className="osrd-config-item-container d-flex align-items-end mb-2">
        <span className="mr-2 flex-grow-1">
          <InputSNCF
            type="text"
            label={t('trainScheduleName')}
            id="osrdconf-name"
            onChange={(e) => handleNameChange(e.target.value)}
            value={name}
            noMargin
            sm
          />
        </span>
        <span className="mr-2">
          <InputSNCF
            type="number"
            label={t('trainScheduleStep')}
            id="osrdconf-traincount"
            onChange={(e) => setTrainStep(parseInt(e.target.value, 10))}
            value={trainStep}
            noMargin
            sm
          />
        </span>
        <span className="mr-2">
          <InputSNCF
            type="number"
            label={t('trainScheduleCount')}
            id="osrdconf-traincount"
            onChange={(e) => setTrainCount(e.target.value)}
            value={trainCount}
            noMargin
            sm
          />
        </span>
        <span className="mr-2">
          <InputSNCF
            type="number"
            label={t('trainScheduleDelta')}
            id="osrdconf-delta"
            onChange={(e) => setTrainDelta(e.target.value)}
            value={trainDelta}
            unit="min"
            noMargin
            sm
          />
        </span>
      </div>
      <div className="d-flex justify-content-end">
        <button
          className="btn btn-secondary mr-2"
          type="button"
          onClick={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none)}
        >
          {t('cancelAddTrainSchedule')}
        </button>
        {isWorking ? (
          <button className="btn btn-primary disabled" type="button">
            <DotsLoader />
          </button>
        ) : (
          <button className="btn btn-primary" type="button" onClick={submitConf}>
            <span className="mr-2">
              <FaPlus />
            </span>
            {t('addTrainSchedule')}
          </button>
        )}
      </div>
    </div>
  );
}

AddTrainSchedule.propTypes = {
  setDisplayTrainScheduleManagement: PropTypes.func.isRequired,
};
