import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { StdcmSuccessResponse, StdcmSimulationInputs } from 'applications/stdcm/types';

import styles from './style/SimulationReportStyleSheet';
import type { SimulationSheetData } from '../SimulationResultExport/types';

interface ConsistProps {
  stdcmData?: StdcmSuccessResponse;
  consist?: StdcmSimulationInputs['consist'];
  consistMass?: number;
  consistLength?: number;
  consistMaxSpeed?: number;
  trainData?: SimulationSheetData;
}

const Consist = ({
  stdcmData,
  consist,
  consistMass,
  consistLength,
  consistMaxSpeed,
  trainData,
}: ConsistProps) => {
  const { t } = useTranslation([
    'stdcm-simulation-report-sheet',
    'stdcm',
    'operationalStudies/study',
  ]);

  const rollingStock = stdcmData?.rollingStock || trainData?.rollingStock;
  const speedLimitByTag = stdcmData?.speedLimitByTag || trainData?.speedLimitByTag;
  const maxSpeed =
    consistMaxSpeed ?? (rollingStock ? Math.floor(rollingStock.max_speed * 3.6) : undefined);
  const maxWeight =
    consistMass ?? (rollingStock ? Math.floor(rollingStock.mass / 1000) : undefined);
  const maxLength = consistLength ?? rollingStock?.length;
  const referenceEngine = rollingStock?.metadata?.reference || rollingStock?.name || '-';
  const towedMaterial = consist?.towedRollingStock?.name ?? '-';

  return (
    <View style={styles.consistAndRoute.consist}>
      <Text style={styles.consistAndRoute.consistTitle}>{t('consist')}</Text>
      <View style={styles.consistAndRoute.consistInfo}>
        <View style={styles.consistAndRoute.consistInfoBox1}>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('speedLimitByTag')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{speedLimitByTag || '-'}</Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('towedMaterial')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{towedMaterial}</Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('maxSpeed')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {maxSpeed ? `${maxSpeed} km/h` : '-'}
          </Text>
        </View>
        <View style={styles.consistAndRoute.consistInfoBox2}>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('maxWeight')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {maxWeight ? `${maxWeight} t` : '-'}
          </Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('referenceEngine')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{referenceEngine}</Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('maxLength')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {maxLength ? `${maxLength} m` : '-'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default Consist;
