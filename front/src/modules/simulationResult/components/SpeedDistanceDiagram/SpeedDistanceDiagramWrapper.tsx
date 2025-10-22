import { useEffect, useRef, useState } from 'react';

import {
  SpeedSpaceChart,
  type LayerData,
  type PowerRestrictionValues,
  type EtcsBrakingCurves,
} from '@osrd-project/ui-charts';
import { useTranslation } from 'react-i18next';

import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import type {
  RollingStockWithLiveries,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';

import { formatData } from './helpers';

export type SpeedDistanceDiagramWrapperProps = {
  timetableItemSimulation: SimulationResponseSuccess;
  selectedTimetableItemPowerRestrictions?: LayerData<PowerRestrictionValues>[];
  pathProperties: PathPropertiesFormatted;
  height: number;
  rollingStock: RollingStockWithLiveries;
  setHeight: React.Dispatch<React.SetStateAction<number>>;
  fetchEtcsBrakingCurves?: () => Promise<void>;
  etcsBrakingCurves?: EtcsBrakingCurves;
};

const SPEED_DISTANCE_DIAGRAM_MIN_HEIGHT = 400;
const SPEED_DISTANCE_DIAGRAM_BACKGROUND_COLOR = 'transparent';

const SpeedDistanceDiagramWrapper = ({
  timetableItemSimulation,
  selectedTimetableItemPowerRestrictions,
  pathProperties,
  height,
  rollingStock,
  setHeight,
  fetchEtcsBrakingCurves,
  etcsBrakingCurves,
}: SpeedDistanceDiagramWrapperProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'simulationResults' });

  const root = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(root.current?.clientWidth || 0);

  const data = formatData(
    timetableItemSimulation,
    rollingStock.length,
    selectedTimetableItemPowerRestrictions,
    pathProperties
  );

  const translations = {
    detailsBoxDisplay: {
      reticleInfos: t('speedDistanceSettings.reticleInfos'),
      energySource: t('speedDistanceSettings.energySource'),
      tractionStatus: t('speedDistanceSettings.tractionStatus'),
      declivities: t('speedDistanceSettings.slopes'),
      etcs: t('speedDistanceSettings.etcs.title'),
      electricalProfiles: t('speedDistanceSettings.electricalProfiles'),
      powerRestrictions: t('speedDistanceSettings.powerRestrictions'),
    },
    layersDisplay: {
      context: t('speedDistanceSettings.context'),
      steps: t('speedDistanceSettings.steps'),
      declivities: t('speedDistanceSettings.slopes'),
      speedLimits: t('speedDistanceSettings.speedLimits'),
      temporarySpeedLimits: t('speedDistanceSettings.temporarySpeedLimits'),
      electricalProfiles: t('speedDistanceSettings.electricalProfiles'),
      powerRestrictions: t('speedDistanceSettings.powerRestrictions'),
      speedLimitTags: t('speedDistanceSettings.speedLimitTags'),
    },
    etcsLayersDisplay: {
      title: t('speedDistanceSettings.etcs.title'),
      etcsBrakingTypes: {
        stopsAndTransitions: t('speedDistanceSettings.etcs.stopsAndTransitions'),
        signals: t('speedDistanceSettings.etcs.signals'),
        spacing: t('speedDistanceSettings.etcs.spacing'),
        routing: t('speedDistanceSettings.etcs.routing'),
      },
      etcsBrakingCurveTypes: {
        indication: t('speedDistanceSettings.etcs.indication'),
        permittedSpeed: t('speedDistanceSettings.etcs.permittedSpeed'),
        guidance: t('speedDistanceSettings.etcs.guidance'),
      },
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
      style={{ height: `${height}px` }}
    >
      {containerWidth > 0 && (
        <SpeedSpaceChart
          width={containerWidth || SPEED_DISTANCE_DIAGRAM_MIN_HEIGHT}
          height={height}
          setHeight={setHeight}
          backgroundColor={SPEED_DISTANCE_DIAGRAM_BACKGROUND_COLOR}
          data={data}
          translations={translations}
          fetchEtcsBrakingCurves={fetchEtcsBrakingCurves}
          etcsBrakingCurves={etcsBrakingCurves}
        />
      )}
    </div>
  );
};

export default SpeedDistanceDiagramWrapper;
