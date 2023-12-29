import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import TrainSettings from 'modules/trainschedule/components/ManageTrainSchedule/TrainSettings';
import Itinerary from 'modules/trainschedule/components/ManageTrainSchedule/Itinerary/Itinerary';
import Map from 'modules/trainschedule/components/ManageTrainSchedule/Map';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import PowerRestrictionsSelector from 'modules/trainschedule/components/ManageTrainSchedule/PowerRestrictionsSelector';
import adjustConfWithTrainToModify from 'modules/trainschedule/components/ManageTrainSchedule/helpers/adjustConfWithTrainToModify';
import ElectricalProfiles from 'modules/trainschedule/components/ManageTrainSchedule/ElectricalProfiles';
import Allowances from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/Allowances';
import {
  getPathfindingID,
  getRollingStockID,
  getTrainScheduleIDsToModify,
} from 'reducers/osrdconf/selectors';
import { osrdEditoastApi, RangedValue } from 'common/api/osrdEditoastApi';
import { RollingStockSelectorCard } from 'modules/rollingStock/components/RollingStockSelector';
import Tabs from 'common/Tabs';
import rollingStockPic from 'assets/pictures/components/train.svg';
import pahtFindingPic from 'assets/pictures/components/pathfinding.svg';
import allowancesPic from 'assets/pictures/components/allowances.svg';
import simulationSettings from 'assets/pictures/components/simulationSettings.svg';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import { formatKmValue } from 'utils/strings';

export default function ManageTrainSchedule() {
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const rollingStockID = useSelector(getRollingStockID);
  const pathFindingID = useSelector(getPathfindingID);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);
  const [getTrainScheduleById] = osrdEditoastApi.endpoints.getTrainScheduleById.useLazyQuery({});
  const [getPathfindingById] = osrdEditoastApi.endpoints.getPathfindingByPathfindingId.useLazyQuery(
    {}
  );

  // Details for tabs
  const { data: pathFinding } = osrdEditoastApi.useGetPathfindingByPathfindingIdQuery(
    { pathfindingId: pathFindingID as number },
    {
      skip: !pathFindingID,
    }
  );

  const { data: rollingStock } = osrdEditoastApi.endpoints.getRollingStockByRollingStockId.useQuery(
    {
      rollingStockId: rollingStockID as number,
    },
    {
      skip: !rollingStockID,
    }
  );

  const { data: pathWithCatenaries = { catenary_ranges: [] as RangedValue[] } } =
    osrdEditoastApi.endpoints.getPathfindingByPathfindingIdCatenaries.useQuery(
      { pathfindingId: pathFindingID as number },
      { skip: !pathFindingID }
    );

  const tabRollingStock = {
    title: rollingStock ? (
      <div className="managetrainschedule-tab">
        <span className="rolling-stock">
          <RollingStock2Img rollingStock={rollingStock} />
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
    content: rollingStock ? (
      <RollingStockSelectorCard
        rollingStockSelected={rollingStock}
        image={<RollingStock2Img rollingStock={rollingStock} />}
      />
    ) : (
      <RollingStockSelectorCard />
    ),
  };

  const tabPathFinding = {
    title: (
      <div className="managetrainschedule-tab">
        <img src={pahtFindingPic} alt="path finding" />
        <span className="ml-2 d-flex align-items-center flex-grow-1 w-100">
          {t('tabs.pathFinding')}
          {pathFinding?.length && !Number.isNaN(pathFinding.length) && (
            <small className="ml-auto pl-1">
              {pathFinding.length && formatKmValue(pathFinding.length / 1000, 3)}
            </small>
          )}
        </span>
      </div>
    ),
    withWarning: pathFindingID === undefined,
    label: t('tabs.pathFinding'),
    content: (
      <div className="osrd-config-item-container-map" data-testid="map">
        <div className="floating-itinerary">
          <Itinerary path={pathFinding} />
        </div>
        <Map />
      </div>
    ),
  };

  const tabAllowances = {
    title: (
      <div className="managetrainschedule-tab" data-testid="allowances">
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
      <div>
        <div className="row no-gutters">
          <div className="col-lg-6 pr-lg-2">
            <ElectricalProfiles />
            <SpeedLimitByTagSelector />
          </div>
        </div>
        {rollingStock && isElectric(rollingStock.effort_curves) && (
          <PowerRestrictionsSelector
            rollingStockModes={rollingStock.effort_curves.modes}
            rollingStockPowerRestrictions={rollingStock.power_restrictions}
            pathCatenaryRanges={pathWithCatenaries.catenary_ranges}
          />
        )}
      </div>
    ),
  };

  useEffect(() => {
    if (trainScheduleIDsToModify.length > 0)
      getTrainScheduleById({ id: trainScheduleIDsToModify[0] })
        .unwrap()
        .then((trainSchedule) => {
          if (trainSchedule.path_id) {
            getPathfindingById({ pathfindingId: trainSchedule.path_id })
              .unwrap()
              .then((path) => {
                adjustConfWithTrainToModify(trainSchedule, path, dispatch);
              });
          }
        });
  }, [trainScheduleIDsToModify]);

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
