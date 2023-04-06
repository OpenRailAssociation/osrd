import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import TrainSettings from 'applications/operationalStudies/components/ManageTrainSchedule/TrainSettings';
import TrainAddingSettings from 'applications/operationalStudies/components/ManageTrainSchedule/TrainAddingSettings';
import Itinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary';
import Map from 'applications/operationalStudies/components/ManageTrainSchedule/Map';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import PowerRestrictionSelector from 'applications/operationalStudies/components/ManageTrainSchedule/PowerRestrictionSelector';
import submitConf from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/submitConf';
import { FaPen, FaPlus } from 'react-icons/fa';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import ElectricalProfiles from 'applications/operationalStudies/components/ManageTrainSchedule/ElectricalProfiles';
import { osrdMiddlewareApi, TrainSchedule } from 'common/api/osrdMiddlewareApi';
import {
  updateLabels,
  updateRollingStockID,
  updateSpeedLimitByTag,
  toggleUsingElectricalProfiles,
  updateName,
  updateDepartureTime,
  updateInitialSpeed,
  updatePathfindingID,
} from 'reducers/osrdconf';
import { getUsingElectricalProfiles } from 'reducers/osrdconf/selectors';
import { sec2time } from 'utils/timeManipulation';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../consts';

type Props = {
  setDisplayTrainScheduleManagement: (arg0: string) => void;
  trainScheduleIDsToModify?: number[];
};

export default function ManageTrainSchedule({
  setDisplayTrainScheduleManagement,
  trainScheduleIDsToModify,
}: Props) {
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const usingElectricalProfiles = useSelector(getUsingElectricalProfiles);
  const [isWorking, setIsWorking] = useState(false);
  const [getTrainScheduleById] = osrdMiddlewareApi.endpoints.getTrainScheduleById.useLazyQuery({});

  function confirmButton() {
    return trainScheduleIDsToModify ? (
      <button
        className="btn btn-warning"
        type="button"
        onClick={() => submitConf(dispatch, t, setIsWorking)}
      >
        <span className="mr-2">
          <FaPen />
        </span>
        {t('updateTrainSchedule')}
      </button>
    ) : (
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => submitConf(dispatch, t, setIsWorking)}
      >
        <span className="mr-2">
          <FaPlus />
        </span>
        {t('addTrainSchedule')}
      </button>
    );
  }

  function ajustConf2TrainToModify(id: number) {
    getTrainScheduleById({ id })
      .unwrap()
      .then((trainScheduleData: TrainSchedule) => {
        if (trainScheduleData.rolling_stock)
          dispatch(updateRollingStockID(trainScheduleData.rolling_stock));
        if (trainScheduleData.options?.ignore_electrical_profiles === usingElectricalProfiles)
          dispatch(toggleUsingElectricalProfiles());

        dispatch(updateSpeedLimitByTag(trainScheduleData.speed_limit_tags));
        dispatch(updateLabels(trainScheduleData.labels));

        if (trainScheduleData.train_name) dispatch(updateName(trainScheduleData.train_name));
        if (trainScheduleData.departure_time)
          dispatch(updateDepartureTime(sec2time(trainScheduleData.departure_time)));
        dispatch(updateInitialSpeed(trainScheduleData.initial_speed || 0));

        dispatch(updatePathfindingID(trainScheduleData.path));
      });
  }

  useEffect(() => {
    if (trainScheduleIDsToModify && trainScheduleIDsToModify.length > 0)
      ajustConf2TrainToModify(trainScheduleIDsToModify[0]);
  }, [trainScheduleIDsToModify]);

  return (
    <>
      <div className="osrd-config-item-container mb-4">
        <TrainSettings />
      </div>

      <div className="row no-gutters">
        <div className="col-lg-6 pr-lg-2">
          <RollingStockSelector />
          <ElectricalProfiles />
        </div>
        <div className="col-lg-6">
          <SpeedLimitByTagSelector />
          <PowerRestrictionSelector />
        </div>
      </div>

      <div className="row no-gutters">
        <div className="col-xl-6 pr-xl-2">
          <Itinerary />
        </div>
        <div className="col-xl-6">
          <div className="osrd-config-item mb-2">
            <div className="osrd-config-item-container osrd-config-item-container-map">
              <Map />
            </div>
          </div>
        </div>
      </div>

      {!trainScheduleIDsToModify && <TrainAddingSettings />}
      <div className="osrd-config-item" data-testid="add-train-schedules">
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
            confirmButton()
          )}
        </div>
      </div>
    </>
  );
}
