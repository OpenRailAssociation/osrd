import { useEffect, useRef, useState } from 'react';

import {
  SpeedSpaceChart,
  type LayerData,
  type PowerRestrictionValues,
} from '@osrd-project/ui-charts';
import { useTranslation } from 'react-i18next';
import { CgLoadbar } from 'react-icons/cg';
import { Rnd } from 'react-rnd';

import type {
  SimulationResponseSuccess,
  PathPropertiesFormatted,
} from 'applications/operationalStudies/types';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';

import { formatData } from './helpers';

export type SpeedSpaceChartContainerProps = {
  trainSimulation: SimulationResponseSuccess;
  selectedTrainPowerRestrictions?: LayerData<PowerRestrictionValues>[];
  pathProperties: PathPropertiesFormatted;
  heightOfSpeedSpaceChartContainer: number;
  rollingStock: RollingStockWithLiveries;
  setHeightOfSpeedSpaceChartContainer: React.Dispatch<React.SetStateAction<number>>;
};

const SPEEDSPACECHART_HEIGHT = 521.5;
const SPEEDSPACECHART_MIN_HEIGHT = 400;
const SPEEDSPACECHART_BACKGROUND_COLOR = 'rgb(247, 246, 238)';
const SPEEDSPACECHART_PADDING_BOTTOM = 22.5;

const SpeedSpaceChartContainer = ({
  trainSimulation,
  selectedTrainPowerRestrictions,
  pathProperties,
  heightOfSpeedSpaceChartContainer,
  rollingStock,
  setHeightOfSpeedSpaceChartContainer,
}: SpeedSpaceChartContainerProps) => {
  const { t } = useTranslation('simulation');

  const [heightOfSpeedSpaceChart, setHeightOfSpeedSpaceChart] = useState(SPEEDSPACECHART_HEIGHT);
  const [baseHeightOfSpeedSpaceChart, setBaseHeightOfSpeedSpaceChart] =
    useState(heightOfSpeedSpaceChart);

  const root = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(root.current?.clientWidth || 0);

  const speedSpaceChartData = formatData(
    trainSimulation,
    rollingStock.length,
    selectedTrainPowerRestrictions,
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
    <Rnd
      default={{
        x: 0,
        y: 0,
        width: '100%',
        height: `${heightOfSpeedSpaceChartContainer}px`,
      }}
      size={{
        width: '100%',
        height: `${heightOfSpeedSpaceChartContainer + SPEEDSPACECHART_PADDING_BOTTOM}px`,
      }}
      minHeight={SPEEDSPACECHART_MIN_HEIGHT}
      disableDragging
      enableResizing={{
        bottom: true,
        top: false,
        topLeft: false,
        topRight: false,
        left: false,
        right: false,
      }}
      onResizeStart={() => {
        setBaseHeightOfSpeedSpaceChart(heightOfSpeedSpaceChart);
      }}
      onResize={(_e, _dir, _refToElement, delta) => {
        setHeightOfSpeedSpaceChart(baseHeightOfSpeedSpaceChart + delta.height);
      }}
    >
      <div
        ref={root}
        id="container-SpeedSpaceChart"
        className="chart"
        style={{ height: `${heightOfSpeedSpaceChartContainer}px` }}
      >
        <p className="mt-2 mb-3 ml-3 font-weight-bold">{t('speedSpaceChart')}</p>
        {containerWidth && (
          <SpeedSpaceChart
            width={containerWidth || SPEEDSPACECHART_MIN_HEIGHT}
            height={heightOfSpeedSpaceChart - SPEEDSPACECHART_PADDING_BOTTOM}
            setHeight={setHeightOfSpeedSpaceChartContainer}
            backgroundColor={SPEEDSPACECHART_BACKGROUND_COLOR}
            data={speedSpaceChartData}
            translations={translations}
          />
        )}
        <div className="handle-tab-resize">
          <CgLoadbar />
        </div>
      </div>
    </Rnd>
  );
};

export default SpeedSpaceChartContainer;
