import React, { useEffect } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import allowancesPic from 'assets/pictures/components/allowances.svg';
import pahtFindingPic from 'assets/pictures/components/pathfinding.svg';
import simulationSettings from 'assets/pictures/components/simulationSettings.svg';
import rollingStockPic from 'assets/pictures/components/train.svg';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { RangedValue } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import Tabs from 'common/Tabs';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { RollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import { Itinerary, Map } from 'modules/trainschedule/components/ManageTrainSchedule';
import Allowances from 'modules/trainschedule/components/ManageTrainSchedule/Allowances/Allowances';
import ElectricalProfiles from 'modules/trainschedule/components/ManageTrainSchedule/ElectricalProfiles';
import adjustConfWithTrainToModify from 'modules/trainschedule/components/ManageTrainSchedule/helpers/adjustConfWithTrainToModify';
import PowerRestrictionsSelector from 'modules/trainschedule/components/ManageTrainSchedule/PowerRestrictionsSelector';
import TrainSettings from 'modules/trainschedule/components/ManageTrainSchedule/TrainSettings';
import { useAppDispatch } from 'store';
import { formatKmValue } from 'utils/strings';

export default function ManageTrainSchedule() {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const { getPathfindingID, getTrainScheduleIDsToModify, getUsingElectricalProfiles } =
    useOsrdConfSelectors();
  const pathFindingID = useSelector(getPathfindingID);
  const trainScheduleIDsToModify = useSelector(getTrainScheduleIDsToModify);
  const usingElectricalProfiles = useSelector(getUsingElectricalProfiles);
  const [getTrainScheduleById] = osrdEditoastApi.endpoints.getTrainScheduleById.useLazyQuery({});
  const [getPathfindingById] = osrdEditoastApi.endpoints.getPathfindingByPathfindingId.useLazyQuery(
    {}
  );
  const osrdActions = useOsrdConfActions();

  const { speedLimitByTag, speedLimitsByTags, dispatchUpdateSpeedLimitByTag } =
    useStoreDataForSpeedLimitByTagSelector();

  const { rollingStockId, rollingStockComfort, rollingStock } =
    useStoreDataForRollingStockSelector();

  // Details for tabs
  const { data: pathFinding } = osrdEditoastApi.endpoints.getPathfindingByPathfindingId.useQuery(
    { pathfindingId: pathFindingID as number },
    {
      skip: !pathFindingID,
    }
  );

  const { data: pathWithElectrifications = { electrification_ranges: [] as RangedValue[] } } =
    osrdEditoastApi.endpoints.getPathfindingByPathfindingIdElectrifications.useQuery(
      { pathfindingId: pathFindingID as number },
      { skip: !pathFindingID }
    );

  const tabRollingStock = {
    id: 'rollingstock',
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
    withWarning: rollingStockId === undefined,
    label: t('tabs.rollingStock'),
    content: (
      <RollingStockSelector
        rollingStockSelected={rollingStock}
        rollingStockComfort={rollingStockComfort}
      />
    ),
  };

  const tabPathFinding = {
    id: 'pathfinding',
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
    id: 'allowances',
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
    id: 'simulation-settings',
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
            <SpeedLimitByTagSelector
              selectedSpeedLimitByTag={speedLimitByTag}
              speedLimitsByTags={speedLimitsByTags}
              dispatchUpdateSpeedLimitByTag={dispatchUpdateSpeedLimitByTag}
            />
          </div>
        </div>
        {rollingStock && isElectric(rollingStock.effort_curves.modes) && (
          <PowerRestrictionsSelector
            rollingStockModes={rollingStock.effort_curves.modes}
            rollingStockPowerRestrictions={rollingStock.power_restrictions}
            pathElectrificationRanges={pathWithElectrifications.electrification_ranges}
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
                adjustConfWithTrainToModify(
                  trainSchedule,
                  path,
                  dispatch,
                  usingElectricalProfiles,
                  osrdActions
                );
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
