import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { StdcmSimulationInputs } from 'applications/stdcm/types';
import type { LightRollingStock, RollingStockWithLiveries } from 'common/api/osrdEditoastApi';

import styles from './styles/SimulationReportStyleSheet';

type ConsistProps = {
  speedLimitByTag?: string | null;
  rollingStock: RollingStockWithLiveries | LightRollingStock;
  consist?: StdcmSimulationInputs['consist'];
  consistMass: number;
  consistMaxSpeed: number;
  consistLength: number;
};

const Consist = ({
  speedLimitByTag,
  rollingStock,
  consist,
  consistMass,
  consistMaxSpeed,
  consistLength,
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
          <Text style={styles.consistAndRoute.consistInfoData}>
            {consist?.towedRollingStock?.name ?? '-'}
          </Text>

          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('reportSheet.maxSpeed')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {consistMaxSpeed != null ? `${consistMaxSpeed} km/h` : '-'}
          </Text>
          {consist?.loadingGauge && (
            <>
              <Text style={styles.consistAndRoute.consistInfoTitles}>
                {t('reportSheet.loadingGauge')}
              </Text>
              <Text style={styles.consistAndRoute.consistInfoData}>{consist?.loadingGauge}</Text>
            </>
          )}
        </View>

        <View style={styles.consistAndRoute.consistInfoBox2}>
          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('reportSheet.maxWeight')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {consistMass != null ? `${consistMass} t` : '-'}
          </Text>

          <Text style={styles.consistAndRoute.consistInfoTitles}>
            {t('reportSheet.referenceEngine')}
          </Text>
          <Text style={styles.consistAndRoute.consistInfoData}>{rollingStock.name || '-'}</Text>

          <Text style={styles.consistAndRoute.consistInfoTitles}>{t('reportSheet.maxLength')}</Text>
          <Text style={styles.consistAndRoute.consistInfoData}>
            {consistLength != null ? `${consistLength} m` : '-'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default Consist;
