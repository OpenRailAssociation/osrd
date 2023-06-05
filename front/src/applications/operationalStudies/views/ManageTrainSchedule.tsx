import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import TrainSettings from 'applications/operationalStudies/components/ManageTrainSchedule/TrainSettings';
import TrainAddingSettings from 'applications/operationalStudies/components/ManageTrainSchedule/TrainAddingSettings';
import Itinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary';
import Map from 'applications/operationalStudies/components/ManageTrainSchedule/Map';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import PowerRestrictionSelector from 'applications/operationalStudies/components/ManageTrainSchedule/PowerRestrictionSelector';
import adjustConfWithTrainToModify from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/adjustConfWithTrainToModify';
import ElectricalProfiles from 'applications/operationalStudies/components/ManageTrainSchedule/ElectricalProfiles';
import { TrainSchedule, osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import {
  getPathfindingID,
  getRollingStockID,
  getShouldRunPathfinding,
  getTrainScheduleIDsToModify,
} from 'reducers/osrdconf/selectors';
import { updatePathWithCatenaries, updateShouldRunPathfinding } from 'reducers/osrdconf';
import RollingStockSelector from 'common/RollingStockSelector/WithRollingStockSelector';
import { osrdEditoastApi, CatenaryRange } from 'common/api/osrdEditoastApi';
import Tabs from 'common/Tabs';
import rollingStockPic from 'assets/pictures/components/train.svg';
import pahtFindingPic from 'assets/pictures/components/pathfinding.svg';
import simulationSettings from 'assets/pictures/components/simulationSettings.svg';
import addingSettingsPic from 'assets/pictures/components/addingSettings.svg';

export default function ManageTrainSchedule() {
  const dispatch = useDispatch();
  const shouldRunPathfinding = useSelector(getShouldRunPathfinding);
  const [mustUpdatePathfinding, setMustUpdatePathfinding] = useState<boolean | undefined>(
    undefined
  );
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const rollingStockID = useSelector(getRollingStockID);
  const pathFindingID = useSelector(getPathfindingID);
  const trainScheduleIDsToModify: undefined | number[] = useSelector(getTrainScheduleIDsToModify);
  const [getTrainScheduleById] = osrdMiddlewareApi.endpoints.getTrainScheduleById.useLazyQuery({});
  const [getPathfindingById] = osrdMiddlewareApi.endpoints.getPathfindingById.useLazyQuery({});

  const { pathWithCatenaries } = osrdEditoastApi.useGetPathfindingByPathIdCatenariesQuery(
    { pathId: pathFindingID as number },
    {
      skip: !pathFindingID,
      refetchOnMountOrArgChange: true,
      selectFromResult: (response) => ({
        ...response,
        pathWithCatenaries: response.data?.catenary_ranges,
      }),
    }
  );
  const tabRollingStock = {
    title: (
      <>
        <img src={rollingStockPic} alt="rolling stock" height={24} />
        <span className="ml-2">{t('tabs.rollingStock')}</span>
      </>
    ),
    withWarning: rollingStockID === undefined,
    label: t('tabs.rollingStock'),
    content: <RollingStockSelector />,
  };

  const tabPathFinding = {
    title: (
      <>
        <img src={pahtFindingPic} alt="path finding" height={24} />
        <span className="ml-2">{t('tabs.pathFinding')}</span>
      </>
    ),
    withWarning: pathFindingID === undefined,
    label: t('tabs.pathFinding'),
    content: (
      <div className="row no-gutters">
        <div className="col-xl-6 pr-xl-2">
          {mustUpdatePathfinding !== undefined && <Itinerary mustUpdate={mustUpdatePathfinding} />}
        </div>
        <div className="col-xl-6">
          <div className="osrd-config-item mb-2">
            <div className="osrd-config-item-container osrd-config-item-container-map">
              <Map />
            </div>
          </div>
        </div>
      </div>
    ),
  };

  const tabSimulationSettings = {
    title: (
      <>
        <img src={simulationSettings} alt="simulation settings" height={24} />
        <span className="ml-2">{t('tabs.simulationSettings')}</span>
      </>
    ),
    label: t('tabs.simulationSettings'),
    content: (
      <div className="row no-gutters">
        <div className="col-lg-6 pr-lg-2">
          <ElectricalProfiles />
          <SpeedLimitByTagSelector />
          <PowerRestrictionSelector />
        </div>
      </div>
    ),
  };

  /* // WIP to be added in next PR
  const tabAllowances = {
    title: (
      <>
        <img src={allowancesPic} alt="allowances" height={24} />
        <span className="ml-2">{t('tabs.allowances')}</span>
      </>
    ),
    label: t('tabs.allowances'),
    content: 'marges',
  }; */

  const tabAddingSettings = {
    title: (
      <>
        <img src={addingSettingsPic} alt="adding settings" height={24} />
        <span className="ml-2">{t('tabs.addingSettings')}</span>
      </>
    ),
    label: t('tabs.addingSettings'),
    content: !trainScheduleIDsToModify && <TrainAddingSettings />,
  };

  useEffect(() => {
    if (trainScheduleIDsToModify && trainScheduleIDsToModify.length > 0)
      getTrainScheduleById({ id: trainScheduleIDsToModify[0] })
        .unwrap()
        .then((trainSchedule: TrainSchedule) => {
          if (trainSchedule.path) {
            getPathfindingById({ id: trainSchedule.path })
              .unwrap()
              .then((path) => {
                adjustConfWithTrainToModify(trainSchedule, path, dispatch);
              });
          }
        });
  }, [trainScheduleIDsToModify]);

  useEffect(() => {
    dispatch(updatePathWithCatenaries(pathWithCatenaries as CatenaryRange[]));
  }, [pathWithCatenaries]);

  useEffect(() => {
    setMustUpdatePathfinding(false);
    dispatch(updateShouldRunPathfinding(false));
  }, []);

  useEffect(() => {
    if (shouldRunPathfinding && mustUpdatePathfinding === false) {
      setMustUpdatePathfinding(true);
    }
  }, [shouldRunPathfinding]);

  return (
    <>
      <div className="osrd-config-item-container mb-4">
        <TrainSettings />
      </div>

      <Tabs
        pills
        fullWidth
        tabs={[tabRollingStock, tabPathFinding, tabSimulationSettings, tabAddingSettings]}
      />
    </>
  );
}
