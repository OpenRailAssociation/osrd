import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { StdcmSimulationInputs, StdcmSuccessResponse } from 'applications/stdcm/types';

import styles from './SimulationReportStyleSheet';

interface ConsistProps {
  stdcmData: StdcmSuccessResponse;
  consist: StdcmSimulationInputs['consist'];
  consistMass: number;
  consistLength: number;
  consistMaxSpeed: number;
}

const Consist = ({
  stdcmData,
  consist,
  consistMass,
  consistLength,
  consistMaxSpeed,
}: ConsistProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);
  const { rollingStock, speedLimitByTag } = stdcmData;

  return (
    <View style={styles.consistAndRoute.consist}>
      <Text style={styles.consistAndRoute.consistTitle}> {t('consist')}</Text>
      <View style={styles.consistAndRoute.consistInfo}>
        <View style={styles.consistAndRoute.consistInfoBox1}>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('speedLimitByTag')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{speedLimitByTag || '-'}</Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('towedMaterial')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {consist?.towedRollingStock?.name ?? '-'}
          </Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('maxSpeed')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {`${Math.floor(consistMaxSpeed)} km/h`}
          </Text>
        </View>
        <View style={styles.consistAndRoute.consistInfoBox2}>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('maxWeight')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {`${Math.floor(consistMass)} t`}
          </Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('referenceEngine')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{rollingStock.name}</Text>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('maxLength')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{`${consistLength} m`}</Text>
        </View>
      </View>
    </View>
  );
};

export default Consist;
