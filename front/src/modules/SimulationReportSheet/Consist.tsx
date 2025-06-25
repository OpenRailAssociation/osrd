import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import styles from './styles/SimulationReportStyleSheet';

type ConsistProps = {
  rollingStockName: string;
  mass: number;
  maxSpeed: number;
  length: number;
  speedLimitByTag?: string | null;
  loadingGauge?: string;
  towedRollingStockName?: string;
};

const Consist = ({
  rollingStockName,
  mass,
  maxSpeed,
  length,
  speedLimitByTag,
  loadingGauge,
  towedRollingStockName,
}: ConsistProps) => {
  const { t } = useTranslation('stdcm');

  return (
    <View style={styles.consistAndRoute.consist}>
      <Text style={styles.consistAndRoute.consistTitle}>{t('reportSheet.consist')}</Text>
      <View style={styles.consistAndRoute.consistInfo}>
        <View style={styles.consistAndRoute.consistInfoBox1}>
          <Text style={styles.consistAndRoute.consistInfoTitles}>
            {t('reportSheet.speedLimitByTag')}
          </Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{speedLimitByTag || '-'}</Text>

          <Text style={styles.consistAndRoute.consistInfoTitles}>
            {t('reportSheet.towedMaterial')}
          </Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{towedRollingStockName ?? '-'}</Text>

          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('reportSheet.maxSpeed')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {maxSpeed != null ? `${maxSpeed} km/h` : '-'}
          </Text>
          {loadingGauge && (
            <>
              <Text style={styles.consistAndRoute.consistInfoTitles}>
                {t('reportSheet.loadingGauge')}
              </Text>
              <Text style={styles.consistAndRoute.consistInfoData}>{loadingGauge}</Text>
            </>
          )}
        </View>

        <View style={styles.consistAndRoute.consistInfoBox2}>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('reportSheet.maxWeight')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {mass != null ? `${mass} t` : '-'}
          </Text>

          <Text style={styles.consistAndRoute.consistInfoTitles}>
            {t('reportSheet.referenceEngine')}
          </Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{rollingStockName || '-'}</Text>

          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('reportSheet.maxLength')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {length != null ? `${length} m` : '-'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default Consist;
