import React, { useState } from 'react';

import { SpeedSpaceChart } from '@osrd-project/ui-speedspacechart';
import type {
  LayerData,
  PowerRestrictionValues,
} from '@osrd-project/ui-speedspacechart/dist/types/chartTypes';
import { useTranslation } from 'react-i18next';
import { CgLoadbar } from 'react-icons/cg';
import { Rnd } from 'react-rnd';

import type {
  SimulationResponseSuccess,
  PathPropertiesFormatted,
} from 'applications/operationalStudies/types';

import { formatData } from './helpers';

export type SpeedSpaceChartV2Props = {
  trainSimulation: SimulationResponseSuccess;
  selectedTrainPowerRestrictions?: LayerData<PowerRestrictionValues>[];
  pathProperties: PathPropertiesFormatted;
  heightOfSpeedSpaceChartContainer: number;
  setHeightOfSpeedSpaceChartContainer: React.Dispatch<React.SetStateAction<number>>;
};

const SPEEDSPACECHART_HEIGHT = 521.5;
const SPEEDSPACECHART_MIN_HEIGHT = 400;
const SPEEDSPACECHART_BACKGROUND_COLOR = 'rgb(247, 246, 238)';
const SPEEDSPACECHART_PADDING_BOTTOM = 22.5;

const SpeedSpaceChartV2 = ({
  trainSimulation,
  selectedTrainPowerRestrictions,
  pathProperties,
  heightOfSpeedSpaceChartContainer,
  setHeightOfSpeedSpaceChartContainer,
}: SpeedSpaceChartV2Props) => {
  const { t } = useTranslation('simulation');

  const [heightOfSpeedSpaceChart, setHeightOfSpeedSpaceChart] = useState(SPEEDSPACECHART_HEIGHT);
  const [baseHeightOfSpeedSpaceChart, setBaseHeightOfSpeedSpaceChart] =
    useState(heightOfSpeedSpaceChart);

  const containerWidth = document.getElementById('container-SpeedSpaceChart')?.clientWidth;

  const speedSpaceChartData = formatData(
    trainSimulation,
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
      }}
      onResizeStart={() => {
        setBaseHeightOfSpeedSpaceChart(heightOfSpeedSpaceChart);
      }}
      onResize={(_e, _dir, _refToElement, delta) => {
        setHeightOfSpeedSpaceChart(baseHeightOfSpeedSpaceChart + delta.height);
      }}
    >
      <div
        id="container-SpeedSpaceChart"
        className="chart"
        style={{ height: `${heightOfSpeedSpaceChartContainer}px` }}
      >
        <span className="chart-title">{t('speedSpaceChart')}</span>
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

export default SpeedSpaceChartV2;
