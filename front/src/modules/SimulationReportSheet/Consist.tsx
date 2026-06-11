import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import { truncateText } from 'utils/strings';

import styles from './styles/SimulationReportStyleSheet';
import type { ConsistChangeData } from './types';

const MassDisplay = ({
  mass,
  consistChanges,
}: {
  mass: string;
  consistChanges: ConsistChangeData[];
}) => {
  if (consistChanges.length > 0) {
    return (
      <View>
        <Text style={styles.consistAndRoute.consistInfoData}>1. {mass}</Text>;
        {consistChanges.map((consist, index) => (
          <Text
            style={styles.consistAndRoute.consistInfoData}
            key={`consist-change-mass-${index}`}
          >{`${index + 2}. ${consist.totalMass}`}</Text>
        ))}
      </View>
    );
  }
  return <Text style={styles.consistAndRoute.consistInfoData}>{mass}</Text>;
};

const LengthDisplay = ({
  length,
  consistChanges,
}: {
  length: string;
  consistChanges: ConsistChangeData[];
}) => {
  if (consistChanges.length > 0) {
    return (
      <View>
        <Text style={styles.consistAndRoute.consistInfoData}>1. {length}</Text>;
        {consistChanges.map((consist, index) => (
          <Text
            style={styles.consistAndRoute.consistInfoData}
            key={`consist-change-length-${index}`}
          >{`${index + 2}. ${consist.totalLength}`}</Text>
        ))}
      </View>
    );
  }
  return <Text style={styles.consistAndRoute.consistInfoData}>{length}</Text>;
};

const TowedRollingStockDisplay = ({
  towedRollingStockName,
  consistChanges,
}: {
  towedRollingStockName?: string;
  consistChanges: ConsistChangeData[];
}) => {
  if (consistChanges.length > 0) {
    return (
      <View>
        <Text style={styles.consistAndRoute.consistInfoData}>
          1. {towedRollingStockName ?? '-'}
        </Text>
        {consistChanges.map((consistChange, index) => (
          <Text
            style={styles.consistAndRoute.consistInfoData}
            key={`consist-change-towed-rolling-stock-${index}`}
          >{`${index + 2}. ${consistChange.towedRollingStockName ?? '-'}`}</Text>
        ))}
      </View>
    );
  }

  return <Text style={styles.consistAndRoute.consistInfoData}>{towedRollingStockName ?? '-'}</Text>;
};

const RollingStockDisplay = ({
  rollingStockName,
  consistChanges,
}: {
  rollingStockName: string;
  consistChanges: ConsistChangeData[];
}) => {
  if (consistChanges.length > 0) {
    return (
      <View>
        <Text style={styles.consistAndRoute.consistInfoData}>1. {rollingStockName}</Text>;
        {consistChanges.map((consistChange, index) => (
          <Text
            style={styles.consistAndRoute.consistInfoData}
            key={`consist-change-towed-rolling-stock-${index}`}
          >{`${index + 2}. ${consistChange.rollingStockName}`}</Text>
        ))}
      </View>
    );
  }

  return <Text style={styles.consistAndRoute.consistInfoData}>{rollingStockName}</Text>;
};

const NO_CONSIST_CHANGES: ConsistChangeData[] = [];

type ConsistProps = {
  rollingStockName: string;
  mass: string;
  maxSpeed: string;
  length: string;
  speedLimitByTag?: string | null;
  loadingGauge?: string;
  towedRollingStockName?: string;
  consistChanges: ConsistChangeData[];
};

const Consist = ({
  rollingStockName,
  mass,
  maxSpeed,
  length,
  speedLimitByTag,
  loadingGauge,
  towedRollingStockName,
  consistChanges = NO_CONSIST_CHANGES,
}: ConsistProps) => {
  const { t } = useTranslation('stdcm');

  return (
    <View style={styles.consistAndRoute.consist}>
      <Text style={styles.consistAndRoute.consistTitle}>{t('reportSheet.consist')}</Text>
      <View style={styles.consistAndRoute.consistInfo}>
        <View style={styles.consistAndRoute.consistInfoBox1}>
          <View style={styles.consistAndRoute.consistInfoSection}>
            <Text style={styles.consistAndRoute.consistInfoTitles}>
              {t('reportSheet.consistChange')}
            </Text>
            <View>
              {consistChanges.map((consistChange, index) => (
                <Text
                  style={styles.consistAndRoute.consistInfoData}
                  key={`consist-change-name-${index}`}
                >{`\u2022 ${truncateText(consistChange.name, 10)} ${consistChange.secondaryCode}`}</Text>
              ))}
            </View>
          </View>
          <View style={styles.consistAndRoute.consistInfoSection}>
            <Text style={styles.consistAndRoute.consistInfoTitles}>
              {t('reportSheet.speedLimitByTag')}
            </Text>
            <Text style={styles.consistAndRoute.consistInfoData}>{speedLimitByTag || '-'}</Text>
          </View>
          <View style={styles.consistAndRoute.consistInfoSection}>
            <Text style={styles.consistAndRoute.consistInfoTitles}>
              {t('reportSheet.towedMaterial')}
            </Text>
            <TowedRollingStockDisplay
              towedRollingStockName={towedRollingStockName}
              consistChanges={consistChanges}
            />
          </View>
          <View style={styles.consistAndRoute.consistInfoSection}>
            <Text style={styles.consistAndRoute.consistInfoTitles}>
              {t('reportSheet.maxSpeed')}
            </Text>
            <Text style={styles.consistAndRoute.consistInfoData}>{maxSpeed}</Text>
          </View>
          {loadingGauge && (
            <View style={styles.consistAndRoute.consistInfoSection}>
              <Text style={styles.consistAndRoute.consistInfoTitles}>
                {t('reportSheet.loadingGauge')}
              </Text>
              <Text style={styles.consistAndRoute.consistInfoData}>{loadingGauge}</Text>
            </View>
          )}
        </View>

        <View style={styles.consistAndRoute.consistInfoBox2}>
          <View style={styles.consistAndRoute.consistInfoSection}>
            <Text style={styles.consistAndRoute.consistInfoTitles}>
              {t('reportSheet.maxWeight')}
            </Text>
            <MassDisplay mass={mass} consistChanges={consistChanges} />
          </View>

          <View style={styles.consistAndRoute.consistInfoSection}>
            <Text style={styles.consistAndRoute.consistInfoTitles}>
              {t('reportSheet.referenceEngine')}
            </Text>
            <RollingStockDisplay
              rollingStockName={rollingStockName}
              consistChanges={consistChanges}
            />
          </View>

          <View style={styles.consistAndRoute.consistInfoSection}>
            <Text style={styles.consistAndRoute.consistInfoTitles}>
              {t('reportSheet.maxLength')}
            </Text>
            <LengthDisplay length={length} consistChanges={consistChanges} />
          </View>
        </View>
      </View>
    </View>
  );
};

export default Consist;
