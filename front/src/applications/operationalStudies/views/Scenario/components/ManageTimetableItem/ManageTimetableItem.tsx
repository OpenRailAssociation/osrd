import { useState, useCallback, useEffect, useMemo } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import { compact, pick } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useManageTimetableItemContext } from 'applications/operationalStudies/hooks/useManageTimetableItemContext';
import allowancesPic from 'assets/pictures/components/allowances.svg';
import pahtFindingPic from 'assets/pictures/components/pathfinding.svg';
import simulationSettings from 'assets/pictures/components/simulationSettings.svg';
import rollingStockPic from 'assets/pictures/components/train.svg';
import { type Comfort } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import { useStoreDataForSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/useStoreDataForSpeedLimitByTagSelector';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import Tabs from 'common/Tabs';
import IncompatibleConstraints from 'modules/pathfinding/components/IncompatibleConstraints';
import Itinerary from 'modules/pathfinding/components/Itinerary';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import { RollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector';
import { useStoreDataForRollingStockSelector } from 'modules/rollingStock/components/RollingStockSelector/useStoreDataForRollingStockSelector';
import isMainCategory from 'modules/rollingStock/helpers/category';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import TimesStopsInput from 'modules/timesStops/TimesStopsInput';
import {
  resetUsingSpeedLimits,
  updateRollingStockComfort,
} from 'reducers/osrdconf/operationalStudiesConf';
import {
  getCategory,
  getConstraintDistribution,
  getDestination,
  getOperationalStudiesRollingStockID,
  getOperationalStudiesSpeedLimitByTag,
  getOrigin,
  getPathSteps,
  getStartTime,
} from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';
import { formatKmValue } from 'utils/strings';

import ManageTimetableItemMap from './ManageTimetableItemMap';
import { type MarkerInformation, MARKER_TYPE } from './ManageTimetableItemMap/ItineraryMarkers';
import PowerRestrictionsSelector from './PowerRestrictionsSelector/PowerRestrictionsSelector';
import SimulationSettings from './SimulationSettings';
import TrainSettings from './TrainSettings';

const ManageTimetableItem = () => {
  const [showTrainSettings, setShowTrainSettings] = useState(true);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
  const {
    pathProperties,
    voltageRanges,
    pathStepsAndSuggestedOPs,
    launchPathfinding,
    pathfindingState,
  } = useManageTimetableItemContext();
  const { updateRollingStockID } = useOsrdConfActions();

  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  const pathSteps = useSelector(getPathSteps);
  const speedLimitByTag = useSelector(getOperationalStudiesSpeedLimitByTag);
  const rollingStockId = useSelector(getOperationalStudiesRollingStockID);
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

  const { speedLimitsByTags, dispatchUpdateSpeedLimitByTag } =
    useStoreDataForSpeedLimitByTagSelector({ speedLimitByTag });
  const { rollingStockComfort, rollingStock } = useStoreDataForRollingStockSelector({
    rollingStockId,
  });

  const onSelectRollingStock = useCallback(
    (_rollingStockId: number, comfort: Comfort) => {
      dispatch(updateRollingStockID(_rollingStockId));
      dispatch(updateRollingStockComfort(comfort));
      launchPathfinding(pathSteps, _rollingStockId);
    },
    [pathSteps]
  );

  const onSelectSpeedLimitTag = useCallback(
    (newTag: string | null) => {
      dispatchUpdateSpeedLimitByTag(newTag);
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
      <div className="manage-timetable-item-tab">
        <span className="rolling-stock-img">
          <RollingStock2Img rollingStock={rollingStock} />
        </span>
        <span data-testid="rolling-stock-name-tab" className="rolling-stock-name">
          {rollingStock.name}{' '}
        </span>
      </div>
    ) : (
      <div className="manage-timetable-item-tab">
        <img src={rollingStockPic} alt="rolling stock" />
        <span className="rolling-stock-name">{t('tabs.rollingStock')}</span>
      </div>
    ),
    withWarning: rollingStockId === undefined,
    label: t('tabs.rollingStock'),
    content: (
      <RollingStockSelector
        rollingStockId={rollingStockId}
        rollingStockSelected={rollingStock}
        rollingStockComfort={rollingStockComfort}
        onSelectRollingStock={onSelectRollingStock}
      />
    ),
  };

  const tabPathFinding = {
    id: 'pathfinding',
    title: (
      <div className="manage-timetable-item-tab">
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
    withWarning: !origin || !destination || !pathProperties || pathfindingState.error,
    label: t('tabs.pathFinding'),
    content: (
      <div className="osrd-config-item-container-map" data-testid="map">
        <div className="floating-itinerary">
          <Itinerary rollingStockId={rollingStockId} />
        </div>
        <ManageTimetableItemMap
          pathProperties={pathProperties ? pick(pathProperties, ['length', 'geometry']) : undefined}
          simulationPathSteps={markersInformation}
          pathStepsAndSuggestedOPs={pathStepsAndSuggestedOPs}
        >
          <IncompatibleConstraints pathProperties={pathProperties} />
        </ManageTimetableItemMap>
      </div>
    ),
  };

  const tabTimesStops = {
    id: 'timesStops',
    title: (
      <div className="manage-timetable-item-tab" data-testid="timesStops">
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
      <div className="manage-timetable-item-tab">
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
          dispatchUpdateSpeedLimitByTag={onSelectSpeedLimitTag}
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

  const currentSubCategory = useMemo(() => {
    if (isMainCategory(currentCategory)) return undefined;
    return subCategories.find((option) => option.code === currentCategory.sub_category_code);
  }, [currentCategory, subCategories]);

  const isCategoryWarning = (() => {
    if (!rollingStock || !currentCategory) return false;

    if (isMainCategory(currentCategory)) {
      return (
        currentCategory.main_category !== rollingStock.primary_category &&
        !rollingStock.other_categories.includes(currentCategory.main_category)
      );
    }

    if (currentSubCategory) {
      return currentSubCategory.main_category !== rollingStock.primary_category;
    }

    return false;
  })();

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

export default ManageTimetableItem;
