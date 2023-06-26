import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import TrainSettings from 'applications/operationalStudies/components/ManageTrainSchedule/TrainSettings';
import Itinerary from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary';
import Map from 'applications/operationalStudies/components/ManageTrainSchedule/Map';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import PowerRestrictionSelector from 'applications/operationalStudies/components/ManageTrainSchedule/PowerRestrictionSelector';
import adjustConfWithTrainToModify from 'applications/operationalStudies/components/ManageTrainSchedule/helpers/adjustConfWithTrainToModify';
import ElectricalProfiles from 'applications/operationalStudies/components/ManageTrainSchedule/ElectricalProfiles';
import Allowances from 'applications/operationalStudies/components/ManageTrainSchedule/Allowances/Allowances';
import {
  getPathfindingID,
  getRollingStockID,
  getShouldRunPathfinding,
  getTrainScheduleIDsToModify,
} from 'reducers/osrdconf/selectors';
import { updatePathWithCatenaries, updateShouldRunPathfinding } from 'reducers/osrdconf';
import RollingStockSelector from 'common/RollingStockSelector/WithRollingStockSelector';
import { osrdEditoastApi, CatenaryRange, TrainSchedule } from 'common/api/osrdEditoastApi';
import Tabs from 'common/Tabs';
import rollingStockPic from 'assets/pictures/components/train.svg';
import pahtFindingPic from 'assets/pictures/components/pathfinding.svg';
import allowancesPic from 'assets/pictures/components/allowances.svg';
import simulationSettings from 'assets/pictures/components/simulationSettings.svg';
import { lengthFromLineCoordinates } from 'utils/geometry';
import MemoRollingStock2Img from 'common/RollingStockSelector/RollingStock2Img';

export default function ManageTrainSchedule() {
  const dispatch = useDispatch();
  const shouldRunPathfinding = useSelector(getShouldRunPathfinding);
  const [mustUpdatePathfinding, setMustUpdatePathfinding] = useState<boolean>(false);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const rollingStockID = useSelector(getRollingStockID);
  const pathFindingID = useSelector(getPathfindingID);
  const trainScheduleIDsToModify: undefined | number[] = useSelector(getTrainScheduleIDsToModify);
  const [getTrainScheduleById] = osrdEditoastApi.endpoints.getTrainScheduleById.useLazyQuery({});
  const [getPathfindingById] = osrdEditoastApi.endpoints.getPathfindingById.useLazyQuery({});

  // Details for tabs
  const { pathLength } = osrdEditoastApi.useGetPathfindingByIdQuery(
    { id: pathFindingID as number },
    {
      skip: !pathFindingID,
      selectFromResult: (response) => ({
        pathLength:
          Math.round(lengthFromLineCoordinates(response.data?.geographic?.coordinates) * 1000) /
          1000,
      }),
    }
  );
  const { data: rollingStock } = osrdEditoastApi.useGetRollingStockByIdQuery(
    { id: rollingStockID as number },
    {
      skip: !rollingStockID,
    }
  );

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
    title: rollingStock ? (
      <div className="managetrainschedule-tab">
        <span className="rolling-stock">
          <MemoRollingStock2Img rollingStock={rollingStock} />
        </span>
        <span className="ml-2">{rollingStock.name}</span>
      </div>
    ) : (
      <div className="managetrainschedule-tab">
        <img src={rollingStockPic} alt="rolling stock" />
        <span className="ml-2">{t('tabs.rollingStock')}</span>
      </div>
    ),
    withWarning: rollingStockID === undefined,
    label: t('tabs.rollingStock'),
    content: <RollingStockSelector />,
  };

  const tabPathFinding = {
    title: (
      <div className="managetrainschedule-tab">
        <img src={pahtFindingPic} alt="path finding" />
        <span className="ml-2 d-flex align-items-center flex-grow-1 w-100">
          {t('tabs.pathFinding')}
          {!Number.isNaN(pathLength) && (
            <small className="ml-auto pl-1">
              {pathLength}
              km
            </small>
          )}
        </span>
      </div>
    ),
    withWarning: pathFindingID === undefined,
    label: t('tabs.pathFinding'),
    content: (
      <div className="row no-gutters">
        <div className="col-fhd-3 col-hdp-4 col-xl-5 col-lg-6 pr-md-2">
          <Itinerary mustUpdate={mustUpdatePathfinding} />
        </div>
        <div className="col-fhd-9 col-hdp-8 col-xl-7 col-lg-6">
          <div className="osrd-config-item mb-2">
            <div
              className="osrd-config-item-container osrd-config-item-container-map"
              data-testid="map"
            >
              <Map />
            </div>
          </div>
        </div>
      </div>
    ),
  };

  const tabAllowances = {
    title: (
      <div className="managetrainschedule-tab">
        <img src={allowancesPic} alt="allowances" />
        <span className="ml-2">{t('tabs.allowances')}</span>
      </div>
    ),
    label: t('tabs.allowances'),
    content: <Allowances />,
  };

  const tabSimulationSettings = {
    title: (
      <div className="managetrainschedule-tab">
        <img src={simulationSettings} alt="simulation settings" />
        <span className="ml-2">{t('tabs.simulationSettings')}</span>
      </div>
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
      <div className="osrd-config-item-container mb-3">
        <TrainSettings />
      </div>

      <Tabs
        pills
        fullWidth
        fullHeight
        tabs={[tabRollingStock, tabPathFinding, tabAllowances, tabSimulationSettings]}
      />
    </>
  );
}
