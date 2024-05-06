import React, { useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import allowancesPic from 'assets/pictures/components/allowances.svg';
import pahtFindingPic from 'assets/pictures/components/pathfinding.svg';
import simulationSettings from 'assets/pictures/components/simulationSettings.svg';
import rollingStockPic from 'assets/pictures/components/train.svg';
import { useOsrdConfSelectors } from 'common/osrdContext';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import Tabs from 'common/Tabs';
import ItineraryV2 from 'modules/pathfinding/components/Itinerary/ItineraryV2';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { RollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { Map } from 'modules/trainschedule/components/ManageTrainSchedule';
import ElectricalProfiles from 'modules/trainschedule/components/ManageTrainSchedule/ElectricalProfiles';
import TrainSettings from 'modules/trainschedule/components/ManageTrainSchedule/TrainSettings';
import { formatKmValue } from 'utils/strings';

const ManageTrainScheduleV2 = () => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const { getOriginV2, getDestinationV2 } = useOsrdConfSelectors();
  const origin = useSelector(getOriginV2);
  const destination = useSelector(getDestinationV2);

  const [pathProperties, setPathProperties] = useState<ManageTrainSchedulePathProperties>();

  const { speedLimitByTag, speedLimitsByTags, dispatchUpdateSpeedLimitByTag } =
    useStoreDataForSpeedLimitByTagSelector();

  const { rollingStockId, rollingStockComfort, rollingStock } =
    useStoreDataForRollingStockSelector();

  // TODO TS2 : test this hook in simulation results issue
  // useSetupItineraryForTrainUpdate(setPathProperties);

  // const { data: pathWithElectrifications = { electrification_ranges: [] as RangedValue[] } } =
  //   osrdEditoastApi.endpoints.getPathfindingByPathfindingIdElectrifications.useQuery(
  //     { pathfindingId: pathFindingID as number },
  //     { skip: !pathFindingID }
  //   );

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
          {destination && destination.positionOnPath && (
            <small className="ml-auto pl-1">
              {formatKmValue(destination.positionOnPath, 'millimeters')}
            </small>
          )}
        </span>
      </div>
    ),
    withWarning: !origin || !destination,
    label: t('tabs.pathFinding'),
    content: (
      <div className="osrd-config-item-container-map" data-testid="map">
        <div className="floating-itinerary">
          <ItineraryV2 pathProperties={pathProperties} setPathProperties={setPathProperties} />
        </div>
        <Map geometry={pathProperties?.geometry} pathProperties={pathProperties} />
      </div>
    ),
  };

  const tabTimesStops = {
    id: 'timesStops',
    title: (
      <div className="managetrainschedule-tab" data-testid="timesStops">
        <img src={allowancesPic} alt="times" />
        <span className="ml-2">{t('tabs.timesStops')}</span>
      </div>
    ),
    label: t('tabs.timesStops'),
    content: null,
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
        {/* {rollingStock && isElectric(rollingStock.effort_curves.modes) && (
          <PowerRestrictionsSelectorV2
            rollingStockModes={rollingStock.effort_curves.modes}
            rollingStockPowerRestrictions={rollingStock.power_restrictions}
            pathElectrificationRanges={pathWithElectrifications.electrification_ranges}
          />
        )} */}
      </div>
    ),
  };

  return (
    <>
      <div className="osrd-config-item-container mb-3">
        <TrainSettings />
      </div>

      <Tabs
        pills
        fullWidth
        fullHeight
        tabs={[tabRollingStock, tabPathFinding, tabTimesStops, tabSimulationSettings]}
      />
    </>
  );
};

export default ManageTrainScheduleV2;
