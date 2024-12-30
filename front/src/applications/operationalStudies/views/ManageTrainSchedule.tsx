import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import useSetupItineraryForTrainUpdate from 'applications/operationalStudies/hooks/useSetupItineraryForTrainUpdate';
import allowancesPic from 'assets/pictures/components/allowances.svg';
import pahtFindingPic from 'assets/pictures/components/pathfinding.svg';
import simulationSettings from 'assets/pictures/components/simulationSettings.svg';
import rollingStockPic from 'assets/pictures/components/train.svg';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import Tabs from 'common/Tabs';
import IncompatibleConstraints from 'modules/pathfinding/components/IncompatibleConstraints';
import Itinerary from 'modules/pathfinding/components/Itinerary/Itinerary';
import PowerRestrictionsSelector from 'modules/powerRestriction/components/PowerRestrictionsSelector';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { RollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import TimesStopsInput from 'modules/timesStops/TimesStopsInput';
import { Map } from 'modules/trainschedule/components/ManageTrainSchedule';
import SimulationSettings from 'modules/trainschedule/components/ManageTrainSchedule/SimulationSettings';
import TrainSettings from 'modules/trainschedule/components/ManageTrainSchedule/TrainSettings';
import {
  getConstraintDistribution,
  getDestination,
  getOrigin,
  getPathSteps,
  getStartTime,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { formatKmValue } from 'utils/strings';

import { useManageTrainScheduleContext } from '../hooks/useManageTrainScheduleContext';

type ManageTrainScheduleProps = {
  trainIdToEdit?: number;
};

const ManageTrainSchedule = ({ trainIdToEdit }: ManageTrainScheduleProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const { pathProperties, voltageRanges, pathStepsAndSuggestedOPs } =
    useManageTrainScheduleContext();

  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const pathSteps = useSelector(getPathSteps);
  const constraintDistribution = useSelector(getConstraintDistribution);
  const startTime = useSelector(getStartTime);

  const { speedLimitByTag, speedLimitsByTags, dispatchUpdateSpeedLimitByTag } =
    useStoreDataForSpeedLimitByTagSelector();
  const { rollingStockId, rollingStockComfort, rollingStock } =
    useStoreDataForRollingStockSelector();

  // TODO TS2 : test this hook in simulation results issue
  if (trainIdToEdit) {
    useSetupItineraryForTrainUpdate(trainIdToEdit);
  }

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
          {pathProperties && destination && destination.positionOnPath && (
            <small className="ml-auto pl-1">
              {formatKmValue(destination.positionOnPath, 'millimeters')}
            </small>
          )}
        </span>
      </div>
    ),
    withWarning: !origin || !destination || !pathProperties,
    label: t('tabs.pathFinding'),
    content: (
      <div className="osrd-config-item-container-map" data-testid="map">
        <div className="floating-itinerary">
          <Itinerary />
        </div>
        <Map pathProperties={pathProperties} simulationPathSteps={compact(pathSteps)}>
          <IncompatibleConstraints pathProperties={pathProperties} />
        </Map>
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
    // If pathProperties is defined we know that pathSteps won't have any null values
    content: (
      <TimesStopsInput
        pathStepsAndSuggestedOPs={pathStepsAndSuggestedOPs}
        startTime={new Date(startTime)}
        pathSteps={compact(pathSteps)}
      />
    ),
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
        <SimulationSettings
          selectedSpeedLimitByTag={speedLimitByTag}
          speedLimitsByTags={speedLimitsByTags}
          dispatchUpdateSpeedLimitByTag={dispatchUpdateSpeedLimitByTag}
          constraintDistribution={constraintDistribution}
        />
        {rollingStock && isElectric(rollingStock.effort_curves.modes) && pathProperties && (
          <PowerRestrictionsSelector
            rollingStockModes={rollingStock.effort_curves.modes}
            rollingStockPowerRestrictions={rollingStock.power_restrictions}
            voltageRanges={voltageRanges}
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

export default ManageTrainSchedule;
