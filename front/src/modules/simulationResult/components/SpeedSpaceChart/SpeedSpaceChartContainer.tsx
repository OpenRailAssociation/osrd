import { useEffect, useRef, useState } from 'react';

import {
  SpeedSpaceChart,
  type LayerData,
  type PowerRestrictionValues,
} from '@osrd-project/ui-charts';
import { useTranslation } from 'react-i18next';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  RollingStockWithLiveries,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';

import { formatData } from './helpers';

export type SpeedSpaceChartContainerProps = {
  timetableItemSimulation: SimulationResponseSuccess;
  selectedTimetableItemPowerRestrictions?: LayerData<PowerRestrictionValues>[];
  pathProperties: PathPropertiesFormatted;
  height: number;
  rollingStock: RollingStockWithLiveries;
  setHeightOfSpeedSpaceChartContainer: React.Dispatch<React.SetStateAction<number>>;
};

const SPEEDSPACECHART_MIN_HEIGHT = 400;
const SPEEDSPACECHART_BACKGROUND_COLOR = 'transparent';

const SpeedSpaceChartContainer = ({
  timetableItemSimulation,
  selectedTimetableItemPowerRestrictions,
  pathProperties,
  height,
  rollingStock,
  setHeightOfSpeedSpaceChartContainer,
}: SpeedSpaceChartContainerProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'simulationResults' });

  const root = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(root.current?.clientWidth || 0);

  const speedSpaceChartData = formatData(
    timetableItemSimulation,
    rollingStock.length,
    selectedTimetableItemPowerRestrictions,
    pathProperties
  );

  const translations = {
    detailsBoxDisplay: {
      reticleInfos: t('speedSpaceSettings.reticleInfos'),
      energySource: t('speedSpaceSettings.energySource'),
      tractionStatus: t('speedSpaceSettings.tractionStatus'),
      declivities: t('speedSpaceSettings.slopes'),
      electricalProfiles: t('speedSpaceSettings.electricalProfiles'),
      powerRestrictions: t('speedSpaceSettings.powerRestrictions'),
    },
    layersDisplay: {
      context: t('speedSpaceSettings.context'),
      steps: t('speedSpaceSettings.steps'),
      declivities: t('speedSpaceSettings.slopes'),
      speedLimits: t('speedSpaceSettings.speedLimits'),
      temporarySpeedLimits: t('speedSpaceSettings.temporarySpeedLimits'),
      electricalProfiles: t('speedSpaceSettings.electricalProfiles'),
      powerRestrictions: t('speedSpaceSettings.powerRestrictions'),
      speedLimitTags: t('speedSpaceSettings.speedLimitTags'),
    },
  };

  useEffect(() => {
    const updateCanvasSize = () => {
      if (root.current) {
        setContainerWidth(root.current.clientWidth);
      }
    };

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (root.current) {
      resizeObserver.observe(root.current);
    }

    return () => {
      if (root.current) {
        resizeObserver.unobserve(root.current);
      }
    };
  }, []);

  return (
    <div
      ref={root}
      id="container-SpeedSpaceChart"
      data-testid="speed-space-chart"
      className="chart"
      style={{ height: `${height}px` }}
    >
      {containerWidth > 0 && (
        <SpeedSpaceChart
          width={containerWidth || SPEEDSPACECHART_MIN_HEIGHT}
          height={height}
          setHeight={setHeightOfSpeedSpaceChartContainer}
          backgroundColor={SPEEDSPACECHART_BACKGROUND_COLOR}
          data={speedSpaceChartData}
          translations={translations}
        />
      )}
    </div>
  );
};

export default SpeedSpaceChartContainer;
