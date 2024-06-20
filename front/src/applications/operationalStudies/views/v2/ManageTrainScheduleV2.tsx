import React, { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type {
  ElectrificationValue,
  ManageTrainSchedulePathProperties,
} from 'applications/operationalStudies/types';
import allowancesPic from 'assets/pictures/components/allowances.svg';
import pahtFindingPic from 'assets/pictures/components/pathfinding.svg';
import simulationSettings from 'assets/pictures/components/simulationSettings.svg';
import rollingStockPic from 'assets/pictures/components/train.svg';
import type { RangedValueV2 } from 'common/api/osrdEditoastApi';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import { useOsrdConfSelectors } from 'common/osrdContext';
import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import Tabs from 'common/Tabs';
import ItineraryV2 from 'modules/pathfinding/components/Itinerary/ItineraryV2';
import PowerRestrictionsSelectorV2 from 'modules/powerRestriction/components/PowerRestrictionsSelectorV2';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { RollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { isElectric } from 'modules/rollingStock/helpers/electric';
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

  const [initialPowerRestrictions, setInitialPowerRestrictions] = useState<RangedValueV2[]>([]);

  const isElectrification = (
    value: ElectrificationValue
  ): value is { type: 'electrification'; voltage: string } => value.type === 'electrification';

  const pathElectrificationRanges = (): IntervalItem[] => {
    if (!pathProperties || !pathProperties.electrifications) return [];

    const boundaries = [0, ...pathProperties.electrifications.boundaries, pathProperties.length];
    const values = [...pathProperties.electrifications.values];

    const ranges: RangedValueV2[] = [];
    let start = boundaries[0];
    let currentVoltage = isElectrification(values[0]) ? values[0].voltage : '';

    for (let i = 1; i < values.length; i += 1) {
      const currentValue = values[i];
      if (isElectrification(currentValue) && currentValue.voltage !== currentVoltage) {
        ranges.push({
          begin: start,
          end: boundaries[i],
          value: currentVoltage,
        });
        start = boundaries[i];
        currentVoltage = currentValue.voltage;
      }
    }

    // Add the last segment
    ranges.push({
      begin: start,
      end: boundaries[boundaries.length - 1],
      value: currentVoltage,
    });
    setInitialPowerRestrictions(ranges);
    return ranges;
  };

  useMemo(() => {
    if (!pathProperties) return [];

    return pathElectrificationRanges().map((electrificationRange) => ({
      begin: electrificationRange.begin,
      end: electrificationRange.end,
      value: `${electrificationRange.value}`,
    }));
  }, [pathProperties]);

  // const trackSections = pathProperties?.trackSectionRanges || [];

  // const [cumulativeSums, setCumulativeSums] = useState<number[]>([]);

  // useEffect(() => {
  //   if (trackSections.length > 0) {
  //     const cumulative = trackSections.reduce((acc, section) => {
  //       const lastSum = acc.length > 0 ? acc[acc.length - 1] : 0;
  //       acc.push(lastSum + section.end);
  //       return acc;
  //     }, []);

  //     setCumulativeSums(cumulative);
  //   }
  // }, [trackSections]);

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
        {rollingStock && isElectric(rollingStock.effort_curves.modes) && (
          <PowerRestrictionsSelectorV2
            rollingStockModes={rollingStock.effort_curves.modes}
            rollingStockPowerRestrictions={rollingStock.power_restrictions}
            pathElectrificationRanges={initialPowerRestrictions}
            pathProperties={pathProperties}
          />
        )}
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
