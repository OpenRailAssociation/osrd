import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import TrainLabels from 'applications/operationalStudies/components/ManageTrainSchedule/TrainLabels';
import TrainSettings from 'applications/operationalStudies/components/ManageTrainSchedule/TrainSettings';
import Itinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary';
import Map from 'applications/operationalStudies/components/ManageTrainSchedule/Map';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import PowerRestrictionSelector from 'applications/operationalStudies/components/ManageTrainSchedule/PowerRestrictionSelector';
import submitConf from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/submitConf';
import { FaPlus } from 'react-icons/fa';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import ElectricalProfiles from 'applications/operationalStudies/components/ManageTrainSchedule/ElectricalProfiles';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { updateRollingStockID, updateSpeedLimitByTag } from 'reducers/osrdconf';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../consts';

type Props = {
  setDisplayTrainScheduleManagement: (arg0: string) => void;
  trainScheduleIDToModify?: number;
};

export default function ManageTrainSchedule({
  setDisplayTrainScheduleManagement,
  trainScheduleIDToModify,
}: Props) {
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const [isWorking, setIsWorking] = useState(false);
  const [getTrainScheduleById, { data: trainScheduleToModify }] =
    osrdMiddlewareApi.endpoints.getTrainScheduleById.useLazyQuery({});

  function ajustConf2TrainToModify(id: number) {
    getTrainScheduleById({ id })
      .unwrap()
      .then((trainScheduleData) => {
        if (trainScheduleData.rolling_stock)
          dispatch(updateRollingStockID(trainScheduleData.rolling_stock));

        dispatch(updateSpeedLimitByTag(trainScheduleData.speed_limit_tags));
      });
  }

  useEffect(() => {
    if (trainScheduleIDToModify) ajustConf2TrainToModify(trainScheduleIDToModify);
  }, [trainScheduleIDToModify]);

  return (
    <>
      {trainScheduleToModify && <h1>Coucou {trainScheduleToModify.train_name}</h1>}
      <div className="manage-train-schedule-title">
        1.&nbsp;{t('operationalStudies/manageTrainSchedule:indications.chooseRollingStock')}
      </div>
      <div className="row no-gutters">
        <div className="col-xl-6 pr-xl-2">
          <RollingStockSelector />
          <ElectricalProfiles />
        </div>
        <div className="col-xl-6">
          <SpeedLimitByTagSelector />
          <PowerRestrictionSelector />
        </div>
      </div>
      <div className="manage-train-schedule-title">2.&nbsp;{t('indications.choosePath')}</div>
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
      <div className="manage-train-schedule-title">3.&nbsp;{t('indications.configValidate')}</div>
      <TrainLabels />
      {!trainScheduleIDToModify && <TrainSettings />}
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
          )}
        </div>
      </div>
    </>
  );
}
