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
  trainScheduleSimulation?: SimulationResponseSuccess;
  selectedTrainSchedulePowerRestrictions?: LayerData<PowerRestrictionValues>[];
  pathProperties?: PathPropertiesFormatted;
  height: number;
  rollingStock?: RollingStockWithLiveries;
  setHeight: React.Dispatch<React.SetStateAction<number>>;
  fetchEtcsBrakingCurves?: () => Promise<void>;
  etcsBrakingCurves?: EtcsBrakingCurves;
  initialLayersDisplay?: Parameters<typeof SpeedSpaceChart>[0]['initialLayersDisplay'];
  isSimulationInvalid?: boolean;
};

const SPEED_DISTANCE_DIAGRAM_MIN_HEIGHT = 400;
const SPEED_DISTANCE_DIAGRAM_BACKGROUND_COLOR = 'transparent';

const SpeedDistanceDiagramWrapper = ({
  trainScheduleSimulation,
  selectedTrainSchedulePowerRestrictions,
  pathProperties,
  height,
  rollingStock,
  setHeight,
  fetchEtcsBrakingCurves,
  etcsBrakingCurves,
  initialLayersDisplay,
  isSimulationInvalid,
}: SpeedDistanceDiagramWrapperProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'simulationResults' });

  const root = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(root.current?.clientWidth || 0);

  const data =
    trainScheduleSimulation && rollingStock
      ? formatData(
          trainScheduleSimulation,
          rollingStock.length,
          selectedTrainSchedulePowerRestrictions,
          pathProperties
        )
      : null;

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
        stop: t('speedDistanceSettings.etcs.stop'),
        transition: t('speedDistanceSettings.etcs.transition'),
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
      className="speed-space-chart-wrapper"
      data-testid="speed-space-chart"
      style={{ height: `${height}px` }}
    >
      {data && containerWidth > 0 ? (
        <SpeedSpaceChart
          width={containerWidth || SPEED_DISTANCE_DIAGRAM_MIN_HEIGHT}
          height={height}
          setHeight={setHeight}
          backgroundColor={SPEED_DISTANCE_DIAGRAM_BACKGROUND_COLOR}
          data={data}
          translations={translations}
          initialLayersDisplay={initialLayersDisplay}
          fetchEtcsBrakingCurves={fetchEtcsBrakingCurves}
          etcsBrakingCurves={etcsBrakingCurves}
        />
      ) : (
        <div className="speed-space-chart-wrapper" style={{ height: `${height}px` }}>
          <span className="no-data" data-testid="no-data-sdd">
            {isSimulationInvalid
              ? t('speedDistanceSettings.invalidSimulation')
              : t('speedDistanceSettings.noData')}
          </span>
        </div>
      )}
    </div>
  );
};

export default SpeedDistanceDiagramWrapper;
