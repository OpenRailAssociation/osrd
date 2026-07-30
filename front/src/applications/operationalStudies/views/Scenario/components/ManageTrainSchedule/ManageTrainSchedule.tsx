import { useState, useCallback, useEffect, useMemo } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { compact, pick } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useManageTrainScheduleContext } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import allowancesPic from 'assets/pictures/components/allowances.svg';
import pahtFindingPic from 'assets/pictures/components/pathfinding.svg';
import simulationSettings from 'assets/pictures/components/simulationSettings.svg';
import rollingStockPic from 'assets/pictures/components/train.svg';
import { type Comfort, type LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { type MarkerInformation, MARKER_TYPE } from 'common/Map/components/ItineraryMarkers';
import { useInfraID, useOsrdConfActions } from 'common/osrdContext';
import useSpeedLimitTags from 'common/SpeedLimitTagSelector/useSpeedLimitTags';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import Tabs from 'common/Tabs';
import IncompatibleConstraints from 'modules/pathfinding/components/IncompatibleConstraints';
import Itinerary from 'modules/pathfinding/components/Itinerary';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { RollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import { checkCategoryWarning, findSubCategory } from 'modules/rollingStock/helpers/category';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import TimesStopsInput from 'modules/timesStops/TimesStopsInput';
import {
  resetUsingSpeedLimits,
  updateRollingStockComfort,
  updateRollingStockName,
} from 'reducers/osrdconf/operationalStudiesConf';
import {
  getCategory,
  getConstraintDistribution,
  getDestination,
  getOperationalStudiesRollingStockID,
  getOperationalStudiesSpeedLimitByTag,
  getOrigin,
  getPathSteps,
  getRollingStockName,
  getStartTime,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';
import { formatKmValue } from 'utils/strings';

import ManageTrainScheduleMap from './ManageTrainScheduleMap';
import PowerRestrictionsSelector from './PowerRestrictionsSelector/PowerRestrictionsSelector';
import SimulationSettings from './SimulationSettings';
import TrainSettings from './TrainSettings';

const ManageTrainSchedule = () => {
  const [showTrainSettings, setShowTrainSettings] = useState(true);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });
  const {
    pathProperties,
    voltageRanges,
    pathStepsAndSuggestedOPs,
    launchPathfinding,
    pathfindingState,
  } = useManageTrainScheduleContext();
  const { updateRollingStockID, updateSpeedLimitByTag } = useOsrdConfActions();

  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const pathSteps = useSelector(getPathSteps);
  const selectedSpeedLimitTag = useSelector(getOperationalStudiesSpeedLimitByTag);
  const rollingStockId = useSelector(getOperationalStudiesRollingStockID);
  const rollingStockName = useSelector(getRollingStockName);
  const currentCategory = useSelector(getCategory);

  const markersInformation = useMemo(
    () =>
      pathSteps.reduce<MarkerInformation[]>((acc, step, index) => {
        if (!step) return acc;

        let pointType = MARKER_TYPE.VIA;

        if (index === 0) {
          pointType = MARKER_TYPE.ORIGIN;
        } else if (index === pathSteps.length - 1) {
          pointType = MARKER_TYPE.DESTINATION;
        }
        acc.push({
          ...step,
          pointType,
        });

        return acc;
      }, []),
    [pathSteps]
  );

  const constraintDistribution = useSelector(getConstraintDistribution);
  const startTime = useSelector(getStartTime);

  const infraID = useInfraID();
  const speedLimitTags = useSpeedLimitTags(infraID);
  const { rollingStockComfort, rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId,
  });

  const onSelectRollingStock = useCallback(
    (selectedRollingStock: LightRollingStockWithLiveries, comfort: Comfort) => {
      dispatch(updateRollingStockID(selectedRollingStock.id));
      dispatch(updateRollingStockName(selectedRollingStock.name));
      dispatch(updateRollingStockComfort(comfort));
      launchPathfinding(pathSteps, selectedRollingStock.id);
    },
    [pathSteps]
  );

  const onSelectSpeedLimitTag = useCallback(
    (newTag: string | null) => {
      dispatch(updateSpeedLimitByTag(newTag));
      launchPathfinding(pathSteps, rollingStockId, {
        isInitialization: false,
        speedLimitTag: newTag,
      });
    },
    [pathSteps, rollingStockId]
  );

  const tabRollingStock = {
    id: 'rollingstock',
    title: rollingStock ? (
      <div className="manage-train-schedule-tab">
        <span className="rolling-stock-img">
          <RollingStock2Img rollingStock={rollingStock} />
        </span>
        <span data-testid="rolling-stock-name-tab" className="rolling-stock-name">
          {rollingStock.name}{' '}
        </span>
      </div>
    ) : (
      <div className="manage-train-schedule-tab">
        <img src={rollingStockPic} alt="rolling stock" />
        <span className="rolling-stock-name">{t('tabs.rollingStock')}</span>
      </div>
    ),
    label: t('tabs.rollingStock'),
    content: (
      <div className="rolling-stock-tab">
        {!rollingStock && (
          <span className="unrecognized-rolling-stock">
            {rollingStockName
              ? t('tabs.unrecognizedRollingStock', { rollingStockName })
              : t('tabs.unspecifiedRollingStock')}
          </span>
        )}
        <RollingStockSelector
          rollingStockId={rollingStockId}
          rollingStockSelected={rollingStock}
          rollingStockComfort={rollingStockComfort}
          onSelectRollingStock={onSelectRollingStock}
        />
      </div>
    ),
  };

  const tabPathFinding = {
    id: 'pathfinding',
    title: (
      <div className="manage-train-schedule-tab">
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
    withWarning:
      !origin || !destination || (rollingStock && (!pathProperties || pathfindingState.error)),
    label: t('tabs.pathFinding'),
    content: (
      <div className="osrd-config-item-container-map" data-testid="map">
        <div className="floating-itinerary">
          <Itinerary rollingStockId={rollingStockId} />
        </div>
        <ManageTrainScheduleMap
          pathProperties={pathProperties ? pick(pathProperties, ['length', 'geometry']) : undefined}
          simulationPathSteps={markersInformation}
          pathStepsAndSuggestedOPs={pathStepsAndSuggestedOPs}
        >
          <IncompatibleConstraints
            geometry={pathProperties?.geometry}
            pathLength={pathProperties?.length}
            incompatibleConstraints={pathProperties?.incompatibleConstraints}
          />
        </ManageTrainScheduleMap>
      </div>
    ),
  };

  const tabTimesStops = {
    id: 'timesStops',
    title: (
      <div className="manage-train-schedule-tab" data-testid="timesStops">
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
        pathfindingState={pathfindingState}
      />
    ),
  };

  const tabSimulationSettings = {
    id: 'simulation-settings',
    title: (
      <div className="manage-train-schedule-tab">
        <img src={simulationSettings} alt="simulation settings" />
        <span className="ml-2">{t('tabs.simulationSettings')}</span>
      </div>
    ),
    label: t('tabs.simulationSettings'),
    content: (
      <div>
        <SimulationSettings
          selectedSpeedLimitTag={selectedSpeedLimitTag}
          speedLimitTags={speedLimitTags}
          updateSpeedLimitTag={onSelectSpeedLimitTag}
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

  // reset usingSpeedLimits when unmounting, to prevent user from being able to create a train
  // without speed limits
  useEffect(
    () => () => {
      dispatch(resetUsingSpeedLimits());
    },
    []
  );

  const subCategories = useSubCategoryContext();

  const currentSubCategory = useMemo(
    () => findSubCategory(subCategories, currentCategory),
    [currentCategory, subCategories]
  );

  const isCategoryWarning = checkCategoryWarning(rollingStock, currentCategory, currentSubCategory);

  const categoryWarning = isCategoryWarning ? t('categoryMismatch') : undefined;
  return (
    <>
      <div className="osrd-config-item-container mb-3">
        {showTrainSettings && <TrainSettings />}
        <button
          type="button"
          className="toggle-train-settings"
          onClick={() => setShowTrainSettings(!showTrainSettings)}
        >
          {showTrainSettings ? <ChevronUp /> : <ChevronDown />}
          <span className="ml-2">
            {showTrainSettings ? t('hideTrainSettings') : t('showTrainSettings')}
          </span>
        </button>
      </div>

      <Tabs
        pills
        fullWidth
        fullHeight
        tabs={[tabRollingStock, tabPathFinding, tabTimesStops, tabSimulationSettings]}
        warning={categoryWarning}
      />
    </>
  );
};

export default ManageTrainSchedule;
