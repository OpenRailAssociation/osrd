import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import { formatDay } from 'utils/date';

import styles from './styles/SimulationReportStyleSheet';

const RCInfo = ({ departureTime }: { departureTime: string }) => {
  const { t, i18n } = useTranslation('stdcm');

  return (
    <View style={styles.rcInfo.rcInfo}>
      <View style={styles.rcInfo.rcBox} />
      <View style={styles.rcInfo.rcBox}>
        <View style={styles.rcInfo.stdcmApplication}>
          <Text style={styles.rcInfo.applicationDate}>{t('reportSheet.applicationDate')}</Text>
          <Text style={styles.rcInfo.date}>{formatDay(departureTime, i18n.language)}</Text>
        </View>
      </View>
    </View>
  );
};

export default RCInfo;
