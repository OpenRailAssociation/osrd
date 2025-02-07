import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import styles from 'applications/stdcm/components/SimulationReportSheet/SimulationReportStyleSheet';

import type { SimulationSheetData } from '../SimulationResultExport/types';

interface ConsistProps {
  trainData: SimulationSheetData;
}

const Consist = ({ trainData }: ConsistProps) => {
  const { t } = useTranslation([
    'stdcm-simulation-report-sheet',
    'stdcm',
    'operationalStudies/study',
  ]);
  const { rollingStock, speedLimitByTag } = trainData;

  return (
    <View style={styles.consistAndRoute.consist}>
      <Text style={styles.consistAndRoute.consistTitle}> {t('consist')}</Text>
      <View style={styles.consistAndRoute.consistInfo}>
        <View style={styles.consistAndRoute.consistInfoBox1}>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('speedLimitByTag')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{speedLimitByTag || '-'}</Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('towedMaterial')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>-</Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('maxSpeed')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {`${Math.floor(rollingStock.max_speed * 3.6)} km/h`}
          </Text>
        </View>
        <View style={styles.consistAndRoute.consistInfoBox2}>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('maxWeight')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {`${Math.floor(rollingStock.mass / 1000)} t`}
          </Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('referenceEngine')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {rollingStock.metadata?.reference || '-'}
          </Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('maxLength')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{`${rollingStock.length} m`}</Text>
        </View>
      </View>
    </View>
  );
};

export default Consist;
