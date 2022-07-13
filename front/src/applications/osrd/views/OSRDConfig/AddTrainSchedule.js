import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { post } from 'common/requests';
import { updateName } from 'reducers/osrdconf';
import { setFailure, setSuccess } from 'reducers/main.ts';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { time2sec, sec2time } from 'utils/timeManipulation';

import formatConf from 'applications/osrd/components/AddTrainSchedule/formatConf';
import trainNameWithNum from 'applications/osrd/components/AddTrainSchedule/trainNameHelper';

const scheduleURL = '/train_schedule/standalone_simulation/';

export default function AddTrainSchedule(props) {
  const { mustUpdateTimetable, setMustUpdateTimetable } = props;
  const [isWorking, setIsWorking] = useState(false);
  const [trainCount, setTrainCount] = useState(1);
  const [trainStep, setTrainStep] = useState(2);
  const [trainDelta, setTrainDelta] = useState(60);
  const osrdconf = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['translation', 'osrdconf']);
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
        const newOriginTime = originTime + (60 * trainDelta * (nb - 1));
        const trainName = trainNameWithNum(osrdconf.name, actualTrainCount, trainCount);
        /* eslint no-await-in-loop: 0 */
        schedules.push(
          formatConf(
            dispatch, setFailure, t,
            { ...osrdconf, name: trainName },
            newOriginTime,
          ),
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
          {},
        );
        dispatch(setSuccess({
          title: t('osrdconf:trainAdded'),
          text: `${osrdconf.name}: ${sec2time(originTime)}`,
        }));
        setIsWorking(false);
      } catch (e) {
        setIsWorking(false);
        dispatch(setFailure({
          name: e.name,
          message: e.message,
        }));
      }
      setMustUpdateTimetable(!mustUpdateTimetable);
    }
  };

  return (
    <>
      <div className="osrd-config-item">
        <div className="osrd-config-item-container d-flex align-items-end mb-2">
          <span className="mr-2 flex-grow-1">
            <InputSNCF
              type="text"
              label={t('osrdconf:trainScheduleName')}
              id="osrdconf-name"
              onChange={(e) => dispatch(updateName(e.target.value))}
              value={osrdconf.name}
              noMargin
              sm
            />
          </span>
          <span className="mr-2">
            <InputSNCF
              type="number"
              label={t('osrdconf:trainScheduleStep')}
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
              label={t('osrdconf:trainScheduleCount')}
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
              label={t('osrdconf:trainScheduleDelta')}
              id="osrdconf-delta"
              onChange={(e) => setTrainDelta(e.target.value)}
              value={trainDelta}
              unit="min"
              noMargin
              sm
            />
          </span>
          {isWorking ? (
            <button className="btn btn-sm btn-primary disabled" type="button">
              <DotsLoader />
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" type="button" onClick={submitConf}>
              {t('osrdconf:addTrainSchedule')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

AddTrainSchedule.propTypes = {
  mustUpdateTimetable: PropTypes.bool.isRequired,
  setMustUpdateTimetable: PropTypes.func.isRequired,
};
