import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import TrainSettings from 'applications/operationalStudies/components/ManageTrainSchedule/TrainSettings';
import TrainAddingSettings from 'applications/operationalStudies/components/ManageTrainSchedule/TrainAddingSettings';
import Itinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary';
import Map from 'applications/operationalStudies/components/ManageTrainSchedule/Map';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import PowerRestrictionSelector from 'applications/operationalStudies/components/ManageTrainSchedule/PowerRestrictionSelector';
import submitConfAddTrainSchedules from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/submitConfAddTrainSchedules';
import adjustConfWithTrainToModify from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/adjustConfWithTrainToModify';
import { FaPen, FaPlus } from 'react-icons/fa';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import ElectricalProfiles from 'applications/operationalStudies/components/ManageTrainSchedule/ElectricalProfiles';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../consts';
import submitConfUpdateTrainSchedules from '../components/ManageTrainSchedule/helpers/submitConfUpdateTrainSchedules';

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
  const [isWorking, setIsWorking] = useState(false);
  const [getTrainScheduleById] = osrdMiddlewareApi.endpoints.getTrainScheduleById.useLazyQuery({});
  const [getPathfindingById] = osrdMiddlewareApi.endpoints.getPathfindingById.useLazyQuery({});

  function confirmButton() {
    return trainScheduleIDsToModify ? (
      <button
        className="btn btn-warning"
        type="button"
        onClick={() =>
          submitConfUpdateTrainSchedules(
            dispatch,
            t,
            setIsWorking,
            trainScheduleIDsToModify,
            setDisplayTrainScheduleManagement
          )
        }
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
        onClick={() => submitConfAddTrainSchedules(dispatch, t, setIsWorking)}
      >
        <span className="mr-2">
          <FaPlus />
        </span>
        {t('addTrainSchedule')}
      </button>
    );
  }

  useEffect(() => {
    if (trainScheduleIDsToModify && trainScheduleIDsToModify.length > 0)
      getTrainScheduleById({ id: trainScheduleIDsToModify[0] })
        .unwrap()
        .then((trainSchedule) => {
          if (trainSchedule.path) {
            getPathfindingById({ id: trainSchedule.path })
              .unwrap()
              .then((path) => {
                adjustConfWithTrainToModify(trainSchedule, path, dispatch);
              });
          }
        });
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
            <i className="icons-arrow-prev mr-2" />
            {t('returnToSimulationResults')}
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
